/**
 * Cyborg Supermarket - Smart Recommendations Service
 * Grounded in catalog data, duration-aware grocery planning (1-365 days),
 * strict category filtering, and knapsack budget optimization.
 */

const db = require('../../database/db');

const CATEGORY_WEIGHTS = {
  'الأرز والمعكرونة والبقوليات': 0.25,
  'منتجات الألبان والبيض': 0.25,
  'الخضار والفواكه الطازجة': 0.20,
  'الفاكهة و الخضار المجمد': 0.08,
  'توابل، صلصات و خل': 0.08,
  'العصائر': 0.04,
  'مشروبات غازية': 0.04,
  'بسكويت، كراكرز وكيك': 0.06
};

const CATEGORY_MAP_EN = {
  'Rice, Pasta & Pulses': 'الأرز والمعكرونة والبقوليات',
  'Dairy & Eggs': 'منتجات الألبان والبيض',
  'Fresh Food': 'الخضار والفواكه الطازجة',
  'Fruits & Vegetables': 'الخضار والفواكه الطازجة',
  'Frozen Fruits & Vegetables': 'الفاكهة و الخضار المجمد',
  'Frozen Food': 'الفاكهة و الخضار المجمد',
  'Condiments, Dressings & Marinades': 'توابل، صلصات و خل',
  'Juices': 'العصائر',
  'Soft Drinks': 'مشروبات غازية',
  'Beverages': 'العصائر',
  'Biscuits, Crackers & Cakes': 'بسكويت، كراكرز وكيك',
  'Food Cupboard': 'الأرز والمعكرونة والبقوليات'
};

const CATEGORY_KEYWORDS = {
  'الأرز والمعكرونة والبقوليات': ['ارز', 'رز', 'مكرونه', 'معكرونه', 'بقوليات', 'بقول', 'عدس', 'فول', 'حمص', 'لوبيا', 'فاصوليا', 'شعريه', 'دقيق', 'سكر', 'زيت', 'pasta', 'rice', 'legumes'],
  'منتجات الألبان والبيض': ['البان', 'لبن', 'حليب', 'جبن', 'جبنه', 'زبادي', 'زبده', 'بيض', 'قشطه', 'dairy', 'milk', 'cheese', 'eggs'],
  'الخضار والفواكه الطازجة': ['خضار', 'خضروات', 'فاكهه', 'فواكه', 'طازج', 'طازجه', 'بصل', 'طماطم', 'بطاطس', 'تفاح', 'fresh', 'vegetables', 'fruits'],
  'الفاكهة و الخضار المجمد': ['مجمد', 'مجمده', 'فروزن', 'باميه', 'ملوخيه', 'بسله', 'frozen'],
  'توابل، صلصات و خل': ['توابل', 'بهارات', 'صلصه', 'صلصات', 'خل', 'كاتشب', 'مايونيز', 'sauce', 'spices'],
  'العصائر': ['عصير', 'عصائر', 'جوس', 'juice'],
  'مشروبات غازية': ['غازيه', 'غازي', 'مشروبات', 'صودا', 'بيبسي', 'كولا', 'soda', 'beverage'],
  'بسكويت، كراكرز وكيك': ['بسكويت', 'بسكوت', 'كراكرز', 'كيك', 'سناكس', 'شوكولاته', 'biscuits', 'cake']
};

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

function parseDurationText(text) {
  const norm = normalizeText(text);
  if (!norm) return { valid: false, error: 'Empty duration string' };

  // 1. Extract explicit budget if present
  let budget = null;
  const explicitBudget = norm.match(/(?:بـ|ب|ميزانيه|ميزانية|budget)\s*(\d+(?:\.\d+)?)/i) || norm.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|ج|egp)/i);
  if (explicitBudget) {
    budget = parseFloat(explicitBudget[1]);
  }

  // 2. Remove budget token from string to prevent number clash with duration
  let textForDuration = norm;
  if (explicitBudget) {
    textForDuration = textForDuration.replace(explicitBudget[0], ' ');
  }

  // 3. Sub-day rejections
  if (/ثوان|دقايق|ساع|half\s*day|second|minute|hour/i.test(textForDuration)) {
    return { valid: false, error: 'أقل مدة مدعومة هي يوم واحد (1 day minimum).' };
  }

  // 4. Over 1 year rejections
  if (/(?:سنه ونص|1\.5 year|سنتين|2 years)/.test(textForDuration)) {
    return { valid: false, error: 'أقصى مدة مدعومة هي سنة واحدة (365 يوم).' };
  }

  // 5. Duals and specific period keywords
  if (/اسبوعين|two weeks|2 weeks/.test(textForDuration)) return { valid: true, days: 14, label: 'أسبوعين (14 يوم)', budget };
  if (/شهرين|two months|2 months/.test(textForDuration)) return { valid: true, days: 60, label: 'شهرين (60 يوم)', budget };
  if (/يومين|two days|2 days/.test(textForDuration)) return { valid: true, days: 2, label: 'يومين', budget };
  if (/3 شهور|تلات شهور|3 months/.test(textForDuration)) return { valid: true, days: 90, label: '3 شهور (90 يوم)', budget };
  if (/6 شهور|نص سنه|6 months/.test(textForDuration)) return { valid: true, days: 180, label: '6 شهور (180 يوم)', budget };
  if (/شهر|one month|1 month/.test(textForDuration)) return { valid: true, days: 30, label: 'شهر (30 يوم)', budget };
  if (/اسبوع|one week|1 week/.test(textForDuration)) return { valid: true, days: 7, label: 'أسبوع (7 أيام)', budget };
  if (/سنه|one year|1 year/.test(textForDuration)) return { valid: true, days: 365, label: 'سنة (365 يوم)', budget };
  if (/يوم|one day|1 day/.test(textForDuration)) return { valid: true, days: 1, label: 'يوم واحد', budget };

  // 6. Explicit Number + Unit pattern
  const match = textForDuration.match(/(\d+)\s*(يوم|ايام|اسبوع|اسابيع|شهر|شهور|سنه|day|days|week|weeks|month|months|year|years)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2];
    let days = val;
    if (/اسبوع|اسابيع|week/i.test(unit)) days = val * 7;
    else if (/شهر|شهور|month/i.test(unit)) days = val * 30;
    else if (/سنه|year/i.test(unit)) days = val * 365;

    if (days < 1) return { valid: false, error: 'المدة يجب أن تكون يوماً واحداً على الأقل.' };
    if (days > 365) return { valid: false, error: 'أقصى مدة مدعومة هي 365 يوماً.' };
    return { valid: true, days, label: `${days} يوم`, budget };
  }

  return { valid: false, error: 'No duration specified' };
}

function resolveCategories(requested) {
  if (!requested || requested.length === 0) return Object.keys(CATEGORY_WEIGHTS);
  const found = new Set();
  const list = Array.isArray(requested) ? requested : [requested];

  list.forEach(req => {
    const norm = normalizeText(req);
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => norm.includes(normalizeText(k)) || normalizeText(k).includes(norm))) {
        found.add(catName);
      }
    }
    for (const [enName, arName] of Object.entries(CATEGORY_MAP_EN)) {
      if (norm.includes(normalizeText(enName)) || norm.includes(normalizeText(arName))) {
        found.add(arName);
      }
    }
  });

  return found.size > 0 ? Array.from(found) : Object.keys(CATEGORY_WEIGHTS);
}

const recommendationsService = {
  parseDuration(text) {
    return parseDurationText(text);
  },

  getCategories() {
    return Object.keys(CATEGORY_WEIGHTS).map(name => ({
      name_ar: name,
      weight: CATEGORY_WEIGHTS[name],
      keywords: CATEGORY_KEYWORDS[name] || []
    }));
  },

  buildBasket({ budget = 1000, durationDays = 30, categories = null }) {
    const minBudget = 50;
    if (budget < minBudget) {
      return {
        success: false,
        error: `الميزانية صغيرة جداً. الحد الأدنى للميزانية هو ${minBudget} جنيه مصري.`
      };
    }

    const days = Math.min(365, Math.max(1, parseInt(durationDays, 10) || 30));
    const activeCats = resolveCategories(categories);
    const maxQtyPerItem = Math.min(36, Math.max(1, Math.round(days / 10 + 0.5)));

    // Load available in-stock products from active SQLite database
    const allProducts = db.query(`
      SELECT
        p.id, p.barcode, p.name_ar, p.name_en, p.brand, p.price, p.size, p.format, p.image_url,
        c.name_ar as cat_ar, c.name_en as cat_en,
        sc.name_ar as subcat_ar, sc.name_en as subcat_en,
        COALESCE(i.quantity, 0) as stock_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = 1 AND COALESCE(i.quantity, 0) > 0;
    `);

    // Map database products to our standard categories
    const productsByCat = {};
    activeCats.forEach(c => { productsByCat[c] = []; });

    allProducts.forEach(prod => {
      const textToMatch = `${prod.name_ar} ${prod.name_en} ${prod.cat_ar || ''} ${prod.subcat_ar || ''} ${prod.cat_en || ''}`;
      const norm = normalizeText(textToMatch);

      for (const cat of activeCats) {
        const keywords = CATEGORY_KEYWORDS[cat] || [];
        if (keywords.some(k => norm.includes(normalizeText(k)))) {
          productsByCat[cat].push(prod);
          break;
        }
      }
    });

    const totalWeight = activeCats.reduce((sum, c) => sum + (CATEGORY_WEIGHTS[c] || 0.1), 0);
    const counts = {}; // productId -> quantity
    let totalSpent = 0;

    // Helper: Fill budget allocation
    function fillItems(items, limit) {
      let spent = 0;
      let added = true;
      while (added) {
        added = false;
        for (const item of items) {
          const currentQty = counts[item.id] || 0;
          if (currentQty >= maxQtyPerItem) continue;
          if (spent + item.price <= limit + 0.01) {
            counts[item.id] = currentQty + 1;
            spent += item.price;
            totalSpent += item.price;
            added = true;
          }
        }
      }
      return spent;
    }

    // Phase 1: Proportional Category Allocation
    for (const cat of activeCats) {
      const catLimit = (budget * (CATEGORY_WEIGHTS[cat] || 0.1)) / totalWeight;
      const candidates = (productsByCat[cat] || []).filter(p => p.price <= catLimit * 0.45);
      candidates.sort(() => Math.random() - 0.5);
      fillItems(candidates, catLimit);
    }

    // Phase 2: Distribute Remainder
    let remaining = budget - totalSpent;
    if (remaining > 5) {
      const allCandidates = [];
      activeCats.forEach(c => {
        (productsByCat[c] || []).forEach(p => allCandidates.push(p));
      });
      allCandidates.sort((a, b) => a.price - b.price);
      fillItems(allCandidates, remaining);
    }

    // Build itemized response
    const productLookup = new Map(allProducts.map(p => [p.id, p]));
    const items = [];
    const categoryGroups = {};

    for (const [prodIdStr, qty] of Object.entries(counts)) {
      const p = productLookup.get(parseInt(prodIdStr, 10));
      if (!p || qty <= 0) continue;

      const subtotal = parseFloat((p.price * qty).toFixed(2));
      const lineItem = {
        product_id: p.id,
        barcode: p.barcode,
        name_ar: p.name_ar,
        name_en: p.name_en,
        brand: p.brand,
        size: p.size,
        format: p.format,
        image_url: p.image_url,
        quantity: qty,
        unit_price: p.price,
        subtotal
      };
      items.push(lineItem);

      const catName = p.cat_ar || 'أخرى';
      if (!categoryGroups[catName]) categoryGroups[catName] = [];
      categoryGroups[catName].push(lineItem);
    }

    const finalTotal = parseFloat(totalSpent.toFixed(2));
    const remainingBuffer = parseFloat(Math.max(0, budget - finalTotal).toFixed(2));
    const dailyRate = parseFloat((finalTotal / days).toFixed(2));

    return {
      success: true,
      budget: parseFloat(budget.toFixed(2)),
      duration_days: days,
      daily_rate_egp: dailyRate,
      total_spent_egp: finalTotal,
      remaining_buffer_egp: remainingBuffer,
      total_items_count: items.reduce((sum, it) => sum + it.quantity, 0),
      distinct_products_count: items.length,
      categories_covered: activeCats,
      items,
      category_groups: categoryGroups
    };
  }
};

module.exports = recommendationsService;
