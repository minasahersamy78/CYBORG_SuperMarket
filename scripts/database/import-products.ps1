# =============================================================================
# Cyborg Supermarket - Product Catalog Importer Script
# Idempotently imports 1,000 SKUs and runs schema migrations
# =============================================================================

$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host "Importing products catalog..." -ForegroundColor Yellow
node scripts/import-products.js

Write-Host "Applying commercial retail schema..." -ForegroundColor Yellow
node scripts/migrate-commercial-schema.js

Write-Host "Applying Phase 3 schema (Loyalty, Support, Pricing, Slots)..." -ForegroundColor Yellow
node scripts/migrate-phase3-schema.js

Write-Host "Database import and migrations complete!" -ForegroundColor Green
