"""
Cyborg Supermarket - Reorganization & Structural Alignment Script
Sets up the mandated enterprise layout while keeping all existing code intact.
"""

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. CREATE DIRECTORIES
dirs_to_create = [
    "website/customer-website",
    "website/admin-dashboard",
    "website/shared-web-components",
    "website/tests",
    "desktop-application/pos-application",
    "desktop-application/local-database",
    "desktop-application/hardware-integration",
    "desktop-application/tests",
    "mobile-application/lib",
    "mobile-application/android",
    "mobile-application/tests",
    "backend/src",
    "backend/prisma-or-database-migrations",
    "backend/tests",
    "database/migrations",
    "database/seeds",
    "database/imports",
    "database/product-dataset",
    "infrastructure/reverse-proxy",
    "infrastructure/monitoring",
    "infrastructure/backup-and-restore",
    "infrastructure/deployment",
    "documentation-pdf/architecture",
    "documentation-pdf/user-guides",
    "documentation-pdf/developer-guides",
    "documentation-pdf/testing-reports",
    "documentation-pdf/security-reports",
    "documentation-pdf/deployment-guides",
    "scripts/setup",
    "scripts/development",
    "scripts/testing",
    "scripts/database",
    "scripts/deployment",
    "tests/integration",
    "tests/end-to-end",
    "tests/security",
    "tests/performance"
]

print("1. Creating mandatory directory structure...")
for d in dirs_to_create:
    (ROOT / d).mkdir(parents=True, exist_ok=True)
print("   Directories created.")

# 2. POPULATE DATABASE FOLDER
print("2. Populating database/ directory...")
if (ROOT / "data/source/super_market(1).xlsx").exists():
    shutil.copy2(ROOT / "data/source/super_market(1).xlsx", ROOT / "database/product-dataset/super_market(1).xlsx")
if (ROOT / "data/processed/products_normalized.json").exists():
    shutil.copy2(ROOT / "data/processed/products_normalized.json", ROOT / "database/product-dataset/products_normalized.json")
if (ROOT / "apps/backend/src/database/schema.sql").exists():
    shutil.copy2(ROOT / "apps/backend/src/database/schema.sql", ROOT / "database/migrations/001_initial_schema.sql")
if (ROOT / "scripts/migrate-commercial-schema.js").exists():
    shutil.copy2(ROOT / "scripts/migrate-commercial-schema.js", ROOT / "database/migrations/002_commercial_schema.js")
if (ROOT / "scripts/migrate-phase3-schema.js").exists():
    shutil.copy2(ROOT / "scripts/migrate-phase3-schema.js", ROOT / "database/migrations/003_phase3_schema.js")

# 3. POPULATE DOCUMENTATION-PDF FOLDER FROM DOCS/PDF
print("3. Populating documentation-pdf/ directory with verified PDFs...")
pdf_mapping = {
    "architecture/system-architecture.pdf": "docs/pdf/02_System_Architecture_and_Infrastructure.pdf",
    "developer-guides/local-setup-and-development.pdf": "docs/pdf/01_Cyborg_Complete_Project_Handbook.pdf",
    "user-guides/customer-website-guide.pdf": "docs/pdf/10_Cyborg_Product_Presentation_and_Demo_Guide.pdf",
    "user-guides/windows-pos-user-guide.pdf": "docs/pdf/09_User_Admin_and_Cashier_Manual.pdf",
    "user-guides/admin-dashboard-guide.pdf": "docs/pdf/03_Complete_Workflows_and_Sequence_Diagrams.pdf",
    "testing-reports/feature-verification-report.pdf": "docs/pdf/07_QA_Testing_and_Verification_Report.pdf",
    "security-reports/security-assessment.pdf": "docs/pdf/06_Security_Architecture_and_Threat_Model.pdf",
    "deployment-guides/production-deployment-guide.pdf": "docs/pdf/08_Deployment_Operations_and_Recovery_Manual.pdf"
}

for dest, src in pdf_mapping.items():
    src_path = ROOT / src
    dest_path = ROOT / "documentation-pdf" / dest
    if src_path.exists():
        shutil.copy2(src_path, dest_path)
        print(f"   Copied {src_path.name} -> {dest}")

print("\nStructure reorganization script completed successfully!")
