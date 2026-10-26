/**
 * Cyborg Supermarket - Authentication & RBAC Service
 */

const crypto = require('crypto');
const db = require('../../database/db');

// In local environment, we use native crypto HMAC-SHA256 for standard JWT signing
const JWT_SECRET = process.env.JWT_SECRET || 'cyborg_supermarket_jwt_secret_dev_key_2026_unsecure_local_only';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cyborg_supermarket_refresh_dev_key_2026_unsecure_local_only';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

function signJwt(payload, secret, expiresInSeconds = 900) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

const authService = {
  login(usernameOrEmail, password) {
    const user = db.getOne(
      'SELECT id, name_ar, name_en, email, phone, password_hash, role, is_active FROM users WHERE email = ? OR phone = ? LIMIT 1;',
      [usernameOrEmail, usernameOrEmail]
    );

    if (!user) {
      return { success: false, statusCode: 401, error: 'Invalid credentials' };
    }

    if (!user.is_active) {
      return { success: false, statusCode: 403, error: 'Account has been deactivated' };
    }

    const hashedInput = hashPassword(password);
    if (hashedInput !== user.password_hash) {
      // Record failed login audit log
      db.run(
        'INSERT INTO audit_logs (action, actor_id, actor_role, entity, details) VALUES (?, ?, ?, ?, ?);',
        ['AUTH_LOGIN_FAILED', user.id, user.role, 'USER', `Failed password attempt for ${user.email}`]
      );
      return { success: false, statusCode: 401, error: 'Invalid credentials' };
    }

    // Generate tokens
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name_en,
      role: user.role
    };

    const accessToken = signJwt(tokenPayload, JWT_SECRET, 900); // 15 mins
    const refreshToken = signJwt({ sub: user.id }, JWT_REFRESH_SECRET, 7 * 24 * 3600); // 7 days

    // Audit log
    db.run(
      'INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?);',
      ['AUTH_LOGIN_SUCCESS', user.id, user.role, 'USER', user.id, `User ${user.email} authenticated successfully`]
    );

    return {
      success: true,
      statusCode: 200,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900,
        user: {
          id: user.id,
          name_en: user.name_en,
          name_ar: user.name_ar,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    };
  },

  register(dto) {
    const existing = db.getOne('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1;', [dto.email, dto.phone]);
    if (existing) {
      return { success: false, statusCode: 409, error: 'User with this email or phone already exists' };
    }

    const userId = 'usr-' + crypto.randomUUID().substring(0, 8);
    const passwordHash = hashPassword(dto.password);
    const role = dto.role || 'CUSTOMER';

    db.run(
      'INSERT INTO users (id, name_ar, name_en, email, phone, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1);',
      [userId, dto.name || dto.name_ar || 'عميل جديد', dto.name || dto.name_en || 'New Customer', dto.email, dto.phone, passwordHash, role]
    );

    return this.login(dto.email, dto.password);
  },

  refreshToken(token) {
    const payload = verifyJwt(token, JWT_REFRESH_SECRET);
    if (!payload || !payload.sub) {
      return { success: false, statusCode: 401, error: 'Invalid or expired refresh token' };
    }

    const user = db.getOne('SELECT id, name_ar, name_en, email, role, is_active FROM users WHERE id = ?;', [payload.sub]);
    if (!user || !user.is_active) {
      return { success: false, statusCode: 401, error: 'User no longer active' };
    }

    const newAccessToken = signJwt({
      sub: user.id,
      email: user.email,
      name: user.name_en,
      role: user.role
    }, JWT_SECRET, 900);

    return {
      success: true,
      statusCode: 200,
      data: {
        access_token: newAccessToken,
        expires_in: 900
      }
    };
  },

  validateToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    return verifyJwt(token, JWT_SECRET);
  },

  checkPermission(user, allowedRoles = []) {
    if (!user || !user.role) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return allowedRoles.includes(user.role);
  }
};

module.exports = authService;
