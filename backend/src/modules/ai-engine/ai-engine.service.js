/**
 * Cyborg Supermarket - AI Shopping Assistant & Egyptian Arabic NLP Engine
 * Grounded in real catalog products, dialect normalization, and substitution logic
 */

const db = require('../../database/db');

// Egyptian Arabic Keyword Lexicon
const INTENT_PATTERNS = {
  ADD_TO_CART: [
    /(عايز|عاوز)\s*(أشتري|اشتري|أجيب|اجيب|اطلب|أطلب)?/i,
    /ضيف\s*(للسلة|في\s*السلة|عالسلة)?/i,
    /حط\s*(في\s*السلة|للسلة)?/i,
    /هاتلي/i,
    /محتاج/i,
    /add\s*(to\s*cart)?/i,
    /buy/i,
    /order/i
  ],
  CHECK_PRICE: [
    /بكام/i,
    /كم\s*سعر/i,
    /سعره\s*كام/i,
    /سعر/i,
    /how\s*much/i,
    /price\s*of/i
  ],
  SEARCH_PRODUCT: [
    /دور\s*على/i,
    /فين/i,
    /عندكم/i,
    /موجود/i,
    /search/i,
    /find/i,
    /show\s*me/i
  ],
  REORDER: [
    /كرر/i,
    /اعادة\s*طلب/i,
    /الطلب\s*الأخير/i,
    /نفس\s*الطلبات/i,
    /reorder/i,
    /repeat/i
  ]
};

// Common Egyptian Arabic grocery synonyms & stems
const PRODUCT_SYNONYMS = {
  'لبن': ['حليب', 'milk'],
  'حليب': ['لبن', 'milk'],
  'جبنة': ['جبن', 'cheese'],
  'جبن': ['جبنة', 'cheese'],
  'زبادي': ['زبادو', 'yogurt', 'yoghurt'],
  'عصير': ['شربات', 'juice', 'drink'],
  'مكرونة': ['معكرونة', 'سباجيتي', 'pasta', 'spaghetti'],
  'فول': ['beans', 'fava'],
  'سمنة': ['سمن', 'ghee'],
  'زبدة': ['butter'],
  'بيض': ['eggs', 'egg'],
  'تمر': ['بلح', 'عجوة', 'dates'],
  'كيك': ['كيكة', 'cake'],
  'بسكويت': ['بسكوت', 'biscuit', 'cookies']
};

function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // strip tashkeel
    .trim();
}

function extractQuantity(text) {
  const arabicNumbers = { 'واحد': 1, 'اتنين': 2, 'تلاتة': 3, 'اربعة': 4, 'خمسة': 5, 'علبة': 1, 'علبتين': 2, 'كيس': 1, 'كيسين': 2, 'كيلو': 1, 'اتنين كيلو': 2 };
  for (const [word, num] of Object.entries(arabicNumbers)) {
    if (text.includes(word)) return num;
  }
  const digitMatch = text.match(/\b\d+\b/);
  if (digitMatch) return parseInt(digitMatch[0], 10);
  return 1;
}

const aiEngineService = {
  parseVoiceOrTextQuery(rawQuery, locale = 'ar-EG') {
    const text = (rawQuery || '').trim();
    if (!text) {
      return {
        intent: 'UNKNOWN',
        raw_query: text,
        normalized_query: '',
        confidence: 0.0,
        entities: {},
        suggested_action: 'Please provide a voice or text command'
      };
    }

    const normalized = normalizeArabic(text);

    // 1. Determine Intent
    let detectedIntent = 'SEARCH_PRODUCT'; // default to product discovery
    let maxConfidence = 0.5;

    for (const [intentName, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pat of patterns) {
        if (pat.test(text) || pat.test(normalized)) {
          detectedIntent = intentName;
          maxConfidence = 0.88;
          break;
        }
      }
      if (maxConfidence > 0.8) break;
    }

    // 2. Extract Entities
    const quantity = extractQuantity(text);

    // Clean query words to extract the grocery product search terms
    let searchTerms = text
      .replace(/عايز|اشتري|اجيب|اطلب|ضيف|للسلة|حط|هاتلي|محتاج|بكام|سعر|فين|عندكم|موجود|دور على/gi, '')
      .replace(/واحد|اتنين|تلاتة|علبة|علبتين|كيس|كيلو/gi, '')
      .trim();

    if (!searchTerms) {
      searchTerms = text;
    }

    // 3. Ground against real catalog in database
    const matchedProducts = this.searchCatalogForAI(searchTerms);

    // Polish confidence based on match presence
    if (matchedProducts.length > 0) {
      maxConfidence = Math.min(0.96, maxConfidence + 0.1);
    }

    let responseMessage = '';
    if (detectedIntent === 'ADD_TO_CART' && matchedProducts.length > 0) {
      const top = matchedProducts[0];
      responseMessage = `تم العثور على ${top.name_ar} بسعر ${top.price} جنيه. هل تريد إضافته للسلة؟`;
    } else if (detectedIntent === 'CHECK_PRICE' && matchedProducts.length > 0) {
      const top = matchedProducts[0];
      responseMessage = `سعر ${top.name_ar} هو ${top.price} جنيه مصري.`;
    } else if (matchedProducts.length > 0) {
      responseMessage = `وجدت لك ${matchedProducts.length} منتجات مطابقة لـ "${searchTerms}".`;
    } else {
      responseMessage = `لم أجد منتجات مطابقة تماماً لـ "${searchTerms}". يمكنك تصفح الأقسام أو تجربة بحث آخر.`;
    }

    return {
      intent: detectedIntent,
      raw_query: text,
      normalized_query: normalized,
      confidence: parseFloat(maxConfidence.toFixed(2)),
      entities: {
        product_query: searchTerms,
        quantity
      },
      message: responseMessage,
      matched_products: matchedProducts.slice(0, 5)
    };
  },

  groundCatalogProducts(term, limit = 5) {
    return this.searchCatalogForAI(term).slice(0, limit);
  },

  searchCatalogForAI(term) {
    if (!term || term.length < 2) return [];

    // Tokenize into clean words
    const words = term.split(/\s+/).map(w => w.trim()).filter(w => w.length > 1);
    if (words.length === 0) return [];

    // Expand synonyms and normalized tokens
    const searchTokens = [];
    words.forEach(w => {
      searchTokens.push(w);
      const norm = normalizeArabic(w);
      if (norm !== w) searchTokens.push(norm);

      // Check synonyms
      for (const [key, synList] of Object.entries(PRODUCT_SYNONYMS)) {
        if (w.includes(key) || key.includes(w)) {
          synList.forEach(s => searchTokens.push(s));
        }
      }
    });

    const uniqueTokens = [...new Set(searchTokens)].slice(0, 6);

    // Build query matching tokens with ranking
    const clauses = uniqueTokens.map(() => '(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.brand LIKE ?)').join(' OR ');
    const params = [];
    uniqueTokens.forEach(tok => {
      const p = `%${tok}%`;
      params.push(p, p, p);
    });

    const rows = db.query(`
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en, p.brand, p.price, p.image_url,
        c.name_en as category_name_en, c.name_ar as category_name_ar,
        COALESCE(i.quantity, 0) as stock_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE (${clauses}) AND p.is_active = 1
      LIMIT 50;
    `, params);

    // Compute relevance score: count how many distinct query tokens appear in the product
    rows.forEach(r => {
      let score = 0;
      const fullText = `${r.name_ar} ${r.name_en} ${r.brand || ''} ${r.category_name_en || ''}`.toLowerCase();
      uniqueTokens.forEach(tok => {
        if (fullText.includes(tok.toLowerCase())) {
          score += 2;
        }
      });
      // Boost brand match specifically
      if (r.brand && words.some(w => r.brand.toLowerCase().includes(w.toLowerCase()))) {
        score += 5;
      }
      r.relevance_score = score;
    });

    rows.sort((a, b) => b.relevance_score - a.relevance_score || a.price - b.price);

    return rows.slice(0, 8);
  },

  getSubstitutions(productId) {
    const target = db.getOne(`
      SELECT p.*, c.name_en as cat_en, sc.name_en as subcat_en
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      WHERE p.id = ? LIMIT 1;
    `, [productId]);

    if (!target) return { success: false, statusCode: 404, error: 'Product not found' };

    // Find substitutes in the same subcategory or category with active stock
    let querySql = `
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en, p.brand, p.size, p.format, p.price, p.image_url,
        i.quantity as stock_quantity,
        ABS(p.price - ?) as price_difference
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      WHERE p.id != ? AND p.is_active = 1 AND i.quantity > 5
    `;

    const params = [target.price, target.id];

    if (target.subcategory_id) {
      querySql += ' AND p.subcategory_id = ?';
      params.push(target.subcategory_id);
    } else {
      querySql += ' AND p.category_id = ?';
      params.push(target.category_id);
    }

    querySql += ' ORDER BY price_difference ASC, i.quantity DESC LIMIT 4;';

    const substitutes = db.query(querySql, params);

    return {
      success: true,
      statusCode: 200,
      data: {
        original_product: {
          id: target.id,
          name_en: target.name_en,
          name_ar: target.name_ar,
          price: target.price,
          category: target.cat_en
        },
        substitutes
      }
    };
  },

  getPantrySuggestions(userId = null) {
    // Generate intelligent grocery replenishment based on essential staples in the real catalog
    // (Milk, Eggs, Bread/Bakery, Cheese, Rice, Cooking Oil/Butter, Water/Beverages)
    const staples = db.query(`
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en, p.brand, p.price, p.image_url,
        c.name_en as category_name,
        COALESCE(i.quantity, 0) as stock_quantity
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id IN (1, 9, 16, 79, 87, 847, 855, 875, 405)
      ORDER BY p.id ASC;
    `);

    const formatted = staples.map(item => ({
      ...item,
      replenishment_frequency_days: item.category_name === 'Fresh Food' ? 4 : 14,
      urgency: item.category_name === 'Fresh Food' ? 'HIGH' : 'MEDIUM',
      reason: item.category_name === 'Fresh Food' ? 'Based on typical 4-day dairy & fresh food consumption' : 'Bi-weekly pantry staple replenishment'
    }));

    return {
      success: true,
      statusCode: 200,
      data: formatted,
      meta: { total_suggestions: formatted.length }
    };
  }
};

module.exports = aiEngineService;
