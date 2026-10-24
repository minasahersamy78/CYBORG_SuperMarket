/**
 * Cyborg Supermarket - Product Dataset Validator
 * Runs standalone with Node.js standard libraries.
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.resolve(__dirname, '../data/source/super_market.csv');
const JSON_NORMALIZED_PATH = path.resolve(__dirname, '../data/processed/products_normalized.json');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — DATASET VALIDATION PIPELINE');
console.log('================================================================');

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function loadDataset() {
  if (fs.existsSync(JSON_NORMALIZED_PATH)) {
    const raw = fs.readFileSync(JSON_NORMALIZED_PATH, 'utf-8');
    return JSON.parse(raw);
  }
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Neither JSON nor CSV dataset found at ${CSV_PATH}`);
  }
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

function validate() {
  const records = loadDataset();
  console.log(`Loaded ${records.length} records for validation.\n`);

  const errors = [];
  const warnings = [];
  const barcodes = new Set();
  const categoryCounts = {};
  const subcategoryCounts = {};
  const brands = new Set();

  const requiredHeaders = [
    'barcode',
    'ArabicPrtoductName',
    'EnglishProductName',
    'ArabicCategory',
    'EnglishCategory',
    'price',
    'id'
  ];

  records.forEach((row, idx) => {
    const rowNum = idx + 2;

    // 1. Check required columns
    for (const req of requiredHeaders) {
      if (row[req] === undefined || row[req] === null || String(row[req]).trim() === '') {
        errors.push(`Row ${rowNum}: Missing mandatory field '${req}'`);
      }
    }

    // 2. Barcode validation
    const barcode = String(row.barcode || '').trim();
    if (!barcode) {
      errors.push(`Row ${rowNum}: Barcode is empty`);
    } else {
      if (barcodes.has(barcode)) {
        warnings.push(`Row ${rowNum}: Duplicate barcode detected: ${barcode}`);
      } else {
        barcodes.add(barcode);
      }
    }

    // 3. Price validation
    const priceVal = parseFloat(row.price);
    if (isNaN(priceVal) || priceVal <= 0) {
      errors.push(`Row ${rowNum}: Invalid price '${row.price}'`);
    }

    // 4. Text sanity (Arabic & English)
    const arName = row.ArabicPrtoductName || '';
    const enName = row.EnglishProductName || '';
    if (arName.length < 2) {
      warnings.push(`Row ${rowNum}: Arabic product name appears unusually short: '${arName}'`);
    }
    if (enName.length < 2) {
      warnings.push(`Row ${rowNum}: English product name appears unusually short: '${enName}'`);
    }

    // 5. Categorization
    const cat = row.EnglishCategory || 'Uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    const subcat = row.EnglishSubCategory || 'None';
    subcategoryCounts[subcat] = (subcategoryCounts[subcat] || 0) + 1;

    if (row.brand) {
      brands.add(row.brand.trim());
    }
  });

  console.log('--- VALIDATION SUMMARY ---');
  console.log(`Total Products Validated: ${records.length}`);
  console.log(`Unique Barcodes Count: ${barcodes.size}`);
  console.log(`Unique Brands Count: ${brands.size}`);
  console.log(`Categories:`, categoryCounts);
  console.log(`Subcategories (top):`, Object.keys(subcategoryCounts).slice(0, 10));

  console.log(`\nErrors Detected: ${errors.length}`);
  console.log(`Warnings Detected: ${warnings.length}`);

  if (errors.length > 0) {
    console.error('\nValidation ERRORS:');
    errors.slice(0, 10).forEach(e => console.error('  - ' + e));
    if (errors.length > 10) console.error(`  ... and ${errors.length - 10} more`);
    process.exit(1);
  } else {
    console.log('\nSUCCESS: Dataset passed all mandatory validation checks! (0 errors)');
    process.exit(0);
  }
}

try {
  validate();
} catch (err) {
  console.error('Fatal Validation Error:', err.message);
  process.exit(1);
}
