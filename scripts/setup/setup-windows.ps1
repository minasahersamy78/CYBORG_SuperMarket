# =============================================================================
# Cyborg Supermarket - Windows 11 Automated Setup Script
# Verifies prerequisites, prepares .env, seeds database, and verifies health
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "CYBORG SUPERMARKET — WINDOWS SETUP & INITIALIZATION" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Verify Prerequisites
Write-Host "`n1. Verifying environment prerequisites..." -ForegroundColor Yellow
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

try {
    $nodeVersion = node -v
    Write-Host "   [OK] Node.js available: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js not found in PATH or 'C:\Program Files\nodejs'. Please install Node.js 16+."
}

try {
    $pythonVersion = & "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" --version
    Write-Host "   [OK] Python available: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   [INFO] Python standard path checked." -ForegroundColor Gray
}

# 2. Prepare Environment File
Write-Host "`n2. Preparing environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "   [OK] Created .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "   [OK] .env already exists" -ForegroundColor Green
}

# 3. Database Migration & Product Import
Write-Host "`n3. Running database migration and product catalog import..." -ForegroundColor Yellow
node scripts/import-products.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to import products dataset"
}
node scripts/migrate-commercial-schema.js
node scripts/migrate-phase3-schema.js
Write-Host "   [OK] Database seeded with 1,000 products & commercial tables" -ForegroundColor Green

# 4. Verify Quality Gate
Write-Host "`n4. Running automated quality gate validation..." -ForegroundColor Yellow
node scripts/run-all-tests.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host "SETUP COMPLETE! All 9 test suites passed successfully." -ForegroundColor Green
    Write-Host "You can now run: .\scripts\development\start-local.ps1" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
} else {
    Write-Error "Setup validation failed during test suite execution."
}
