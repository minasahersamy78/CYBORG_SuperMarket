# =============================================================================
# Cyborg Supermarket - Master Test Execution Script
# Runs all 9 automated test suites with 71 verified assertions
# =============================================================================

$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node scripts/run-all-tests.js
exit $LASTEXITCODE
