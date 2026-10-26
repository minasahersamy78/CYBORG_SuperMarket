/**
 * Cyborg Supermarket - Repeatable, Idempotent Product & Seed Data Importer
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const db = require('../apps/backend/src/database/db');

const SQLITE_BIN = db.getSqliteBin();
const DB_PATH = db.getDbPath();
const SCHEMA_PATH = path.resolve(__dirname, '../apps/backend/src/database/schema.sql');
const PRODUCTS_JSON = path.resolve(__dirname, '../data/processed/products_normalized.json');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — DATABASE IMPORT & SEED PIPELINE');
console.log('================================================================');

function runSql(sql) {
  const res = spawnSync(SQLITE_BIN, [DB_PATH], {
    input: sql,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(res.stderr || 'SQL execution failed');
  return res.stdout;
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// 1. Ensure Schema
console.log('1. Ensuring Database Schema...');
// Recreate schema to ensure clean state
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}
runSql(fs.readFileSync(SCHEMA_PATH, 'utf-8'));

// 2. Load Real Dataset
console.log('2. Loading normalized product dataset...');
const rawData = fs.readFileSync(PRODUCTS_JSON, 'utf-8');
const products = JSON.parse(rawData);
console.log(`Loaded ${products.length} product rows.`);

// 3. Extract Categories & Subcategories
console.log('3. Extracting taxonomy hierarchy...');
const categoryMap = new Map();
const subcategoryMap = new Map();

products.forEach(p => {
  const catEn = (p.EnglishCategory || 'Uncategorized').trim();
  const catAr = (p.ArabicCategory || 'غير مصنف').trim();
  if (!categoryMap.has(catEn)) {
    categoryMap.set(catEn, { name_ar: catAr, name_en: catEn });
  }

  const subEn = (p.EnglishSubCategory || '').trim();
  const subAr = (p.ArabicSubCategory || '').trim();
  if (subEn) {
    const key = `${catEn}:::${subEn}`;
    if (!subcategoryMap.has(key)) {
      subcategoryMap.set(key, { parent_en: catEn, name_ar: subAr || subEn, name_en: subEn });
    }
  }
});

let sqlBuffer = ['BEGIN TRANSACTION;'];

// Upsert Parent Categories
let catIdCounter = 1;
const categoryIdLookup = {};
categoryMap.forEach((val, catEn) => {
  categoryIdLookup[catEn] = catIdCounter;
  sqlBuffer.push(`INSERT INTO categories (id, name_ar, name_en, parent_id) VALUES (${catIdCounter}, ${escapeSql(val.name_ar)}, ${escapeSql(val.name_en)}, NULL) ON CONFLICT(id) DO UPDATE SET name_ar=excluded.name_ar, name_en=excluded.name_en;`);
  catIdCounter++;
});

// Upsert Subcategories
const subcategoryIdLookup = {};
subcategoryMap.forEach((val, key) => {
  const parentId = categoryIdLookup[val.parent_en];
  subcategoryIdLookup[key] = catIdCounter;
  sqlBuffer.push(`INSERT INTO categories (id, name_ar, name_en, parent_id) VALUES (${catIdCounter}, ${escapeSql(val.name_ar)}, ${escapeSql(val.name_en)}, ${parentId}) ON CONFLICT(id) DO UPDATE SET name_ar=excluded.name_ar, name_en=excluded.name_en, parent_id=excluded.parent_id;`);
  catIdCounter++;
});

// 4. Upsert Real Products and Initial Inventory
console.log('4. Generating product and inventory insertion queries...');
let insertedCount = 0;

products.forEach(p => {
  const catEn = (p.EnglishCategory || 'Uncategorized').trim();
  const subEn = (p.EnglishSubCategory || '').trim();
  const catId = categoryIdLookup[catEn] || 1;
  const subcatId = subEn ? (subcategoryIdLookup[`${catEn}:::${subEn}`] || 'NULL') : 'NULL';

  const id = parseInt(p.id, 10);
  const barcode = (p.barcode || '').trim();
  const name_ar = (p.ArabicPrtoductName || '').trim();
  const name_en = (p.EnglishProductName || '').trim();
  const brand = p.brand ? p.brand.trim() : null;
  const country = (p.country || 'Egypt').trim();
  const size = p.size ? p.size.trim() : null;
  const format = (p.format || 'pieces').trim();
  const price = parseFloat(p.price) || 0.00;
  
  // Format multi-line images
  const rawImg = p.image || '';
  const imgList = rawImg.split(/[\r\n]|_x000D_/).map(s => s.trim()).filter(s => s.startsWith('http'));
  const primaryImg = imgList[0] || null;
  const galleryJson = imgList.length > 1 ? JSON.stringify(imgList) : null;
  const embedding = p.embedding ? p.embedding : null;

  sqlBuffer.push(`
    INSERT INTO products (
      id, barcode, name_ar, name_en, category_id, subcategory_id,
      brand, country, size, format, price, image_url, gallery_urls, embedding, is_active
    ) VALUES (
      ${id}, ${escapeSql(barcode)}, ${escapeSql(name_ar)}, ${escapeSql(name_en)}, ${catId}, ${subcatId},
      ${escapeSql(brand)}, ${escapeSql(country)}, ${escapeSql(size)}, ${escapeSql(format)}, ${price.toFixed(2)},
      ${escapeSql(primaryImg)}, ${escapeSql(galleryJson)}, ${escapeSql(embedding)}, 1
    ) ON CONFLICT(id) DO UPDATE SET
      barcode=excluded.barcode, name_ar=excluded.name_ar, name_en=excluded.name_en,
      category_id=excluded.category_id, subcategory_id=excluded.subcategory_id,
      brand=excluded.brand, size=excluded.size, format=excluded.format,
      price=excluded.price, image_url=excluded.image_url, gallery_urls=excluded.gallery_urls,
      embedding=excluded.embedding, updated_at=datetime('now');
  `);

  // Default initial inventory: 150 units for regular goods, 50 for fresh produce
  const initialStock = (catEn === 'Fresh Food' || catEn === 'Fruits & Vegetables') ? 60 : 180;
  sqlBuffer.push(`
    INSERT INTO inventory (product_id, store_id, quantity, reserved_qty, low_stock_threshold, version)
    VALUES (${id}, 1, ${initialStock}, 0, 15, 1)
    ON CONFLICT(product_id) DO UPDATE SET
      quantity=excluded.quantity, updated_at=datetime('now');
  `);

  insertedCount++;
});

// 5. Seed Core Role Users for Development & Testing
console.log('5. Seeding development accounts for all required roles...');
// Pre-computed SHA-512 hash for "Admin@123"
const devPasswordHash = '6a8eabb9447e2fd817035c282e2275d4fa21f91409dd4726eb071d35e645418192feb3b5f0c60ff836345481bcf3739e3c728e91bd97aa191f92c148be4becae';

const seedUsers = [
  { id: 'usr-admin-01', name_ar: 'مدير النظام', name_en: 'Super Administrator', email: 'admin@cyborg.eg', phone: '+201000000001', role: 'SUPER_ADMIN' },
  { id: 'usr-mgr-01', name_ar: 'مدير الفرع الرئيسي', name_en: 'Store Manager', email: 'manager@cyborg.eg', phone: '+201000000002', role: 'STORE_MANAGER' },
  { id: 'usr-csh-01', name_ar: 'كاشير أحمد', name_en: 'Cashier Ahmed', email: 'cashier@cyborg.eg', phone: '+201000000003', role: 'CASHIER' },
  { id: 'usr-inv-01', name_ar: 'مسؤول المخزون', name_en: 'Inventory Operator', email: 'inventory@cyborg.eg', phone: '+201000000004', role: 'INVENTORY_OPERATOR' },
  { id: 'usr-cst-01', name_ar: 'عميل تجريبي', name_en: 'Tarek Customer', email: 'customer@cyborg.eg', phone: '+201000000005', role: 'CUSTOMER' },
  { id: 'usr-aud-01', name_ar: 'مراجع مالي', name_en: 'System Auditor', email: 'auditor@cyborg.eg', phone: '+201000000006', role: 'AUDITOR' }
];

seedUsers.forEach(u => {
  sqlBuffer.push(`
    INSERT INTO users (id, name_ar, name_en, email, phone, password_hash, role, is_active)
    VALUES (${escapeSql(u.id)}, ${escapeSql(u.name_ar)}, ${escapeSql(u.name_en)}, ${escapeSql(u.email)}, ${escapeSql(u.phone)}, ${escapeSql(devPasswordHash)}, ${escapeSql(u.role)}, 1)
    ON CONFLICT(id) DO UPDATE SET
      name_ar=excluded.name_ar, name_en=excluded.name_en, role=excluded.role, is_active=1;
  `);
});

// Seed an initial active Cashier Shift for TERM-01
sqlBuffer.push(`
  INSERT INTO shifts (
    id, cashier_id, cashier_name, terminal_id, store_id, opening_balance,
    total_transactions, total_cash_sales, total_card_sales, total_refunds, is_closed
  ) VALUES (
    'shift-cairo-001', 'usr-csh-01', 'Cashier Ahmed', 'TERM-01', 1, 1000.00,
    0, 0.00, 0.00, 0.00, 0
  ) ON CONFLICT(id) DO NOTHING;
`);

sqlBuffer.push('COMMIT;');

console.log(`Writing ${sqlBuffer.length} SQL statements to database...`);
runSql(sqlBuffer.join('\n'));

// 6. Verify Results
const countCheck = runSql('SELECT count(*) FROM products;').trim();
const catCheck = runSql('SELECT count(*) FROM categories;').trim();
const userCheck = runSql('SELECT count(*) FROM users;').trim();
const invCheck = runSql('SELECT count(*) FROM inventory;').trim();

console.log('\n================================================================');
console.log('IMPORT COMPLETED SUCCESSFULLY!');
console.log('================================================================');
console.log(`Total Products in Database: ${countCheck}`);
console.log(`Total Categories in Database: ${catCheck}`);
console.log(`Total Seed Users: ${userCheck}`);
console.log(`Total Inventory Records: ${invCheck}`);
console.log('Database Path:', DB_PATH);
