"""
Cyborg Supermarket - Package Downloadable ZIP Artifacts
Generates:
1. dist/cyborg-desktop-pos.zip (Desktop POS Flutter Application)
2. dist/cyborg-android-mobile.zip (Customer Android Flutter Application)
3. dist/cyborg-web-ecosystem.zip (Admin Web, Customer Storefront, and Backend REST API)
"""

import os
import zipfile
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
DIST_DIR.mkdir(parents=True, exist_ok=True)

EXCLUDE_DIRS = {".git", "node_modules", ".dart_tool", "build", ".gradle", "__pycache__", ".idea", ".vscode"}
EXCLUDE_EXTS = {".log", ".tmp"}

def should_exclude(path_obj):
    for part in path_obj.parts:
        if part in EXCLUDE_DIRS:
            return True
    if path_obj.suffix in EXCLUDE_EXTS:
        return True
    return False

def add_directory_to_zip(zip_file, source_dir, arc_prefix=""):
    source_path = Path(source_dir)
    for root, dirs, files in os.walk(source_path):
        # Filter directories in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            file_path = Path(root) / f
            if should_exclude(file_path):
                continue
            rel_path = file_path.relative_to(source_path)
            arc_name = Path(arc_prefix) / rel_path if arc_prefix else rel_path
            zip_file.write(file_path, str(arc_name))

print("================================================================")
print("CYBORG SUPERMARKET — PACKAGE RELEASE ZIP ARTIFACTS")
print("================================================================\n")

# 1. Desktop POS Application ZIP
pos_zip_path = DIST_DIR / "cyborg-desktop-pos.zip"
print(f"1. Packaging Desktop POS Application -> {pos_zip_path.name}...")
with zipfile.ZipFile(pos_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    if (ROOT_DIR / "desktop-application").exists():
        add_directory_to_zip(zf, ROOT_DIR / "desktop-application", "desktop-application")
    elif (ROOT_DIR / "apps" / "desktop-pos").exists():
        add_directory_to_zip(zf, ROOT_DIR / "apps" / "desktop-pos", "desktop-application")
    if (ROOT_DIR / "packages").exists():
        add_directory_to_zip(zf, ROOT_DIR / "packages", "packages")
    zf.writestr("desktop-application/RUN_INSTRUCTIONS.txt", 
        "CYBORG SUPERMARKET - DESKTOP POS FLUTTER APPLICATION\n"
        "====================================================\n\n"
        "Prerequisites:\n"
        "- Flutter SDK (3.x+)\n"
        "- Windows 10/11 or Linux Desktop with C++ Development tools\n\n"
        "How to Run:\n"
        "1. Open terminal in this folder\n"
        "2. Run: flutter pub get\n"
        "3. Run: flutter run\n\n"
        "Features:\n"
        "- Fast Barcode scanning input (EAN-13, Code-128)\n"
        "- Hotkeys: F2 (Cash), F3 (Card), F4 (Exact), F10 (Search), Esc (Void)\n"
        "- ESC/POS Thermal Receipt formatting\n"
        "- Offline outbox queue with idempotent sync\n"
        "- Bilingual Arabic/English support\n"
    )
pos_size_mb = pos_zip_path.stat().st_size / (1024 * 1024)
print(f"   [OK] {pos_zip_path.name} created successfully ({pos_size_mb:.2f} MB)")

# 2. Android Mobile Application ZIP
mobile_zip_path = DIST_DIR / "cyborg-android-mobile.zip"
print(f"\n2. Packaging Android Mobile Application -> {mobile_zip_path.name}...")
with zipfile.ZipFile(mobile_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    if (ROOT_DIR / "mobile-application").exists():
        add_directory_to_zip(zf, ROOT_DIR / "mobile-application", "mobile-application")
    elif (ROOT_DIR / "apps" / "mobile-app").exists():
        add_directory_to_zip(zf, ROOT_DIR / "apps" / "mobile-app", "mobile-application")
    if (ROOT_DIR / "packages").exists():
        add_directory_to_zip(zf, ROOT_DIR / "packages", "packages")
    zf.writestr("mobile-application/RUN_INSTRUCTIONS.txt",
        "CYBORG SUPERMARKET - CUSTOMER ANDROID MOBILE APPLICATION\n"
        "=======================================================\n\n"
        "Prerequisites:\n"
        "- Flutter SDK (3.x+)\n"
        "- Android Studio / Android SDK (API 33+)\n\n"
        "How to Run:\n"
        "1. Open terminal in this folder\n"
        "2. Run: flutter pub get\n"
        "3. Run: flutter run\n\n"
        "Features:\n"
        "- MVC Architecture (lib/models, lib/views, lib/controllers)\n"
        "- Egyptian Arabic Voice Assistant & Dialect Parsing\n"
        "- Floating Chatbot FAB at Bottom-Left (Positioned left: 16, bottom: 16)\n"
        "- Dynamic Bilingual Support (Arabic RTL / English LTR)\n"
        "- Dark Mode & Light Mode Theme Toggle\n"
        "- Order Cancellation with automatic stock restoration\n"
        "- 1–365 Days Smart Budget & Pantry Planner\n"
        "- Compliments & Feedback dispatched to cyborgcoding1@gmail.com\n"
    )
mobile_size_mb = mobile_zip_path.stat().st_size / (1024 * 1024)
print(f"   [OK] {mobile_zip_path.name} created successfully ({mobile_size_mb:.2f} MB)")

# 3. Web Ecosystem ZIP (Admin Web, Customer Web, Backend, Database, Docker)
web_zip_path = DIST_DIR / "cyborg-web-ecosystem.zip"
print(f"\n3. Packaging Web Ecosystem & Backend -> {web_zip_path.name}...")
with zipfile.ZipFile(web_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    if (ROOT_DIR / "admin-dashboard").exists():
        add_directory_to_zip(zf, ROOT_DIR / "admin-dashboard", "admin-dashboard")
    if (ROOT_DIR / "customer-website").exists():
        add_directory_to_zip(zf, ROOT_DIR / "customer-website", "customer-website")
    if (ROOT_DIR / "backend").exists():
        add_directory_to_zip(zf, ROOT_DIR / "backend", "backend")
    if (ROOT_DIR / "database").exists():
        add_directory_to_zip(zf, ROOT_DIR / "database", "database")
    if (ROOT_DIR / "docker").exists():
        add_directory_to_zip(zf, ROOT_DIR / "docker", "docker")
    if (ROOT_DIR / "data").exists():
        add_directory_to_zip(zf, ROOT_DIR / "data", "data")
    if (ROOT_DIR / "scripts").exists():
        add_directory_to_zip(zf, ROOT_DIR / "scripts", "scripts")
    if (ROOT_DIR / "docs").exists():
        add_directory_to_zip(zf, ROOT_DIR / "docs", "docs")
    if (ROOT_DIR / "features").exists():
        add_directory_to_zip(zf, ROOT_DIR / "features", "features")
    if (ROOT_DIR / "packages").exists():
        add_directory_to_zip(zf, ROOT_DIR / "packages", "packages")
    
    # Root configs
    for root_file in ["README.md", "docker-compose.yml", ".env.example", "package.json", "RUN_AND_TEST.md", "RUN_GUIDE.md"]:
        rf_path = ROOT_DIR / root_file
        if rf_path.exists():
            zf.write(rf_path, root_file)
            
    zf.writestr("RUN_INSTRUCTIONS.txt",
        "CYBORG SUPERMARKET - WEB ECOSYSTEM & REST API\n"
        "==============================================\n\n"
        "Prerequisites:\n"
        "- Node.js 18+\n"
        "- SQLite 3\n\n"
        "Quick Start:\n"
        "1. Start Core Backend API (Port 3000):\n"
        "   cd backend && npm start\n\n"
        "2. Start Admin Operations Web Portal (Port 3001):\n"
        "   cd admin-dashboard && npm start\n\n"
        "3. Start Customer E-Commerce Storefront (Port 3002):\n"
        "   cd customer-website && npm start\n\n"
        "4. Run All Automated Test Suites:\n"
        "   node scripts/run-all-tests.js\n"
    )
web_size_mb = web_zip_path.stat().st_size / (1024 * 1024)
print(f"   [OK] {web_zip_path.name} created successfully ({web_size_mb:.2f} MB)")

# 4. Extract into unzipped directories in dist for immediate exploration
import shutil
print("\n4. Refreshing unzipped directories in dist/...")
for folder_name, zip_p in [
    ("cyborg-desktop-pos", pos_zip_path),
    ("cyborg-android-mobile", mobile_zip_path),
    ("cyborg-web-ecosystem", web_zip_path)
]:
    target_extract = DIST_DIR / folder_name
    if target_extract.exists():
        shutil.rmtree(target_extract)
    target_extract.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_p, 'r') as zf:
        zf.extractall(target_extract)
    print(f"   [OK] Extracted fresh {folder_name}/")

print("\n================================================================")
print("ALL DOWNLOADABLE PACKAGES AND DIRECTORIES IN dist/ ARE 100% UP TO DATE!")
print(f"1. {pos_zip_path.resolve()} ({pos_size_mb:.2f} MB)")
print(f"2. {mobile_zip_path.resolve()} ({mobile_size_mb:.2f} MB)")
print(f"3. {web_zip_path.resolve()} ({web_size_mb:.2f} MB)")
print("================================================================\n")
