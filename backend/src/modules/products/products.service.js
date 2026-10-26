/**
 * Cyborg Supermarket - Product Catalog Service
 */

const db = require('../../database/db');

const productsService = {
  list(query = {}) {
    const page = Math.max(1, parseInt(query.page || 1, 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || 20, 10)));
    const offset = (page - 1) * limit;

    let whereClauses = ['p.is_active = 1'];
    const params = [];

    // Search query: Case-insensitive across English Name, Arabic Name, Brand, Barcode
    const rawSearch = query.q || query.search || query.query;
    if (rawSearch && String(rawSearch).trim()) {
      const term = `%${String(rawSearch).trim()}%`;
      whereClauses.push('(p.name_en LIKE ? OR p.name_ar LIKE ? OR p.brand LIKE ? OR p.barcode LIKE ?)');
      params.push(term, term, term, term);
    }

    // Exact barcode
    if (query.barcode) {
      whereClauses.push('p.barcode = ?');
      params.push(query.barcode.trim());
    }

    // Category filter
    if (query.category_id) {
      whereClauses.push('p.category_id = ?');
      params.push(parseInt(query.category_id, 10));
    }

    // Subcategory filter
    if (query.subcategory_id) {
      whereClauses.push('p.subcategory_id = ?');
      params.push(parseInt(query.subcategory_id, 10));
    }

    // Brand filter
    if (query.brand) {
      whereClauses.push('p.brand = ?');
      params.push(query.brand.trim());
    }

    // Price range
    if (query.min_price !== undefined && query.min_price !== '') {
      whereClauses.push('p.price >= ?');
      params.push(parseFloat(query.min_price));
    }
    if (query.max_price !== undefined && query.max_price !== '') {
      whereClauses.push('p.price <= ?');
      params.push(parseFloat(query.max_price));
    }

    const whereSql = whereClauses.join(' AND ');

    // Sorting
    let sortColumn = 'p.id';
    let sortOrder = 'ASC';
    if (query.sort_by === 'price') sortColumn = 'p.price';
    if (query.sort_by === 'name') sortColumn = 'p.name_en';
    if (query.sort_order === 'DESC') sortOrder = 'DESC';

    // Count query
    const countRow = db.getOne(
      `SELECT count(*) as total FROM products p WHERE ${whereSql};`,
      params
    );
    const total = countRow ? parseInt(countRow.total, 10) : 0;

    // Items query with category joins and inventory stock
    const selectSql = `
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en,
        p.category_id, c.name_en as category_name_en, c.name_ar as category_name_ar,
        p.subcategory_id, sc.name_en as subcategory_name_en, sc.name_ar as subcategory_name_ar,
        p.brand, p.country, p.size, p.format, p.price,
        p.image_url, p.gallery_urls, p.is_active,
        COALESCE(i.quantity, 0) as stock_quantity,
        COALESCE(i.reserved_qty, 0) as reserved_quantity,
        (COALESCE(i.quantity, 0) - COALESCE(i.reserved_qty, 0)) as available_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const items = db.query(selectSql, params);

    // Parse gallery URLs if stored as JSON
    items.forEach(item => {
      if (item.gallery_urls) {
        try { item.gallery_urls = JSON.parse(item.gallery_urls); } catch(e) {}
      }
    });

    return {
      success: true,
      statusCode: 200,
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  getById(id) {
    const item = db.getOne(`
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en,
        p.category_id, c.name_en as category_name_en, c.name_ar as category_name_ar,
        p.subcategory_id, sc.name_en as subcategory_name_en, sc.name_ar as subcategory_name_ar,
        p.brand, p.country, p.size, p.format, p.price,
        p.image_url, p.gallery_urls, p.embedding, p.is_active,
        COALESCE(i.quantity, 0) as stock_quantity,
        COALESCE(i.reserved_qty, 0) as reserved_quantity,
        (COALESCE(i.quantity, 0) - COALESCE(i.reserved_qty, 0)) as available_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = ? LIMIT 1;
    `, [id]);

    if (!item) return { success: false, statusCode: 404, error: 'Product not found' };

    if (item.gallery_urls) {
      try { item.gallery_urls = JSON.parse(item.gallery_urls); } catch(e) {}
    }
    return { success: true, statusCode: 200, data: item };
  },

  getByBarcode(barcode) {
    const item = db.getOne(`
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en,
        p.category_id, c.name_en as category_name_en, c.name_ar as category_name_ar,
        p.subcategory_id, sc.name_en as subcategory_name_en, sc.name_ar as subcategory_name_ar,
        p.brand, p.country, p.size, p.format, p.price,
        p.image_url, p.gallery_urls, p.is_active,
        COALESCE(i.quantity, 0) as stock_quantity,
        (COALESCE(i.quantity, 0) - COALESCE(i.reserved_qty, 0)) as available_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.barcode = ? AND p.is_active = 1 LIMIT 1;
    `, [barcode.trim()]);

    if (!item) return { success: false, statusCode: 404, error: `No active product found for barcode '${barcode}'` };

    return { success: true, statusCode: 200, data: item };
  },

  getCategories() {
    const all = db.query(`
      SELECT id, name_ar, name_en, parent_id
      FROM categories
      ORDER BY parent_id NULLS FIRST, name_en ASC;
    `);

    const parents = all.filter(c => !c.parent_id);
    const subcats = all.filter(c => c.parent_id);

    const tree = parents.map(p => ({
      ...p,
      subcategories: subcats.filter(s => s.parent_id === p.id)
    }));

    return { success: true, statusCode: 200, data: tree };
  }
};

module.exports = productsService;
