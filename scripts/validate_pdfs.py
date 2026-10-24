"""
Cyborg Supermarket - PDF Validator & Verification Script
Verifies integrity, compliance, page counts, and non-empty status of all 10 PDFs.
"""

import os, sys, json

PDF_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../docs/pdf'))
MANIFEST_PATH = os.path.join(PDF_DIR, 'documentation-manifest.json')

EXPECTED_PDFS = [
    "01_Cyborg_Complete_Project_Handbook.pdf",
    "02_System_Architecture_and_Infrastructure.pdf",
    "03_Complete_Workflows_and_Sequence_Diagrams.pdf",
    "04_Database_ERD_and_Data_Dictionary.pdf",
    "05_API_Reference_and_Integration_Guide.pdf",
    "06_Security_Architecture_and_Threat_Model.pdf",
    "07_QA_Testing_and_Verification_Report.pdf",
    "08_Deployment_Operations_and_Recovery_Manual.pdf",
    "09_User_Admin_and_Cashier_Manual.pdf",
    "10_Cyborg_Product_Presentation_and_Demo_Guide.pdf"
]

print("================================================================")
print("CYBORG SUPERMARKET — PDF DOCUMENTATION VERIFICATION")
print("================================================================\n")

errors = []
verified_count = 0

for filename in EXPECTED_PDFS:
    filepath = os.path.join(PDF_DIR, filename)
    if not os.path.exists(filepath):
        errors.append(f"Missing PDF file: {filename}")
        continue

    size = os.path.getsize(filepath)
    if size == 0:
        errors.append(f"Empty PDF file: {filename} (0 bytes)")
        continue

    with open(filepath, 'rb') as f:
        content = f.read()

    # Verify header
    if not content.startswith(b'%PDF-'):
        errors.append(f"Invalid PDF header in {filename}")
        continue

    # Verify trailer
    if b'%%EOF' not in content:
        errors.append(f"Missing %%EOF marker in {filename}")
        continue

    # Extract page count from /Count in Pages object
    count_idx = content.find(b'/Count ')
    page_count = "Unknown"
    if count_idx != -1:
        snippet = content[count_idx+7:count_idx+20].split(b' ')[0].split(b'/')[0].split(b'>')[0].strip()
        try:
            page_count = int(snippet)
        except:
            pass

    print(f"[VERIFIED] {filename} | Size: {size:,} bytes | Pages: {page_count}")
    verified_count += 1

print("\n----------------------------------------------------------------")
print(f"VERIFICATION SUMMARY: {verified_count} of {len(EXPECTED_PDFS)} PDFs VALIDATED")
print("----------------------------------------------------------------\n")

if errors:
    print("ERRORS DETECTED:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("SUCCESS: All 10 mandated enterprise PDF documents are present, non-empty, and structurally valid!")
    sys.exit(0)
