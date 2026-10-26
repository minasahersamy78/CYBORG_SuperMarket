# =============================================================================
# Cyborg Supermarket - Local Ecosystem Startup Script
# Launches Backend API (3000), Admin Dashboard (3001), and Customer Web (3002)
# =============================================================================

$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "CYBORG SUPERMARKET — STARTING LOCAL ECOSYSTEM" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Start Backend API
Write-Host "`n1. Starting Core Backend API on http://localhost:3000..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath "node" -ArgumentList "apps/backend/src/standalone-server.js" -PassThru

# 2. Start Admin Dashboard
Write-Host "2. Starting Operations Admin Dashboard on http://localhost:3001..." -ForegroundColor Yellow
$adminJob = Start-Process -FilePath "node" -ArgumentList "apps/admin-web/server.js" -PassThru

# 3. Start Customer Storefront
Write-Host "3. Starting Customer E-Commerce Storefront on http://localhost:3002..." -ForegroundColor Yellow
$webJob = Start-Process -FilePath "node" -ArgumentList "apps/customer-web/server.js" -PassThru

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "ALL WEB SERVICES STARTED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "API Gateway & Docs:     http://localhost:3000/api/v1/docs" -ForegroundColor White
Write-Host "Health Check:           http://localhost:3000/health" -ForegroundColor White
Write-Host "Admin Operations HQ:    http://localhost:3001" -ForegroundColor White
Write-Host "Customer Storefront:    http://localhost:3002" -ForegroundColor White
Write-Host "`nProcess IDs: Backend=$($backendJob.Id), Admin=$($adminJob.Id), Web=$($webJob.Id)" -ForegroundColor Gray
Write-Host "To stop all services: Stop-Process -Id $($backendJob.Id), $($adminJob.Id), $($webJob.Id)" -ForegroundColor Yellow
