# CYBORG SUPERMARKET — HARDWARE VERIFICATION & TEST PLAN

**Document ID:** DOC-HWP-2026-V1  
**Target Hardware:** Retail POS Peripherals & Store Infrastructure  
**Verification Scope:** Barcode Scanners, Receipt Printers, Cash Drawers, Touchscreens, Keyboard POS, Network Interruption & Power Outage  

---

## 1. Hardware Matrix & Certification Status

| Peripheral | Target Device Model | Interface | Verified Mode | Physical Device Status |
| :--- | :--- | :--- | :--- | :--- |
| **Barcode Scanner** | Honeywell Voyager 1400g 2D | USB (HID Keyboard Wedge) | Automated Simulation & Validation | Emulated / Requires physical scanner |
| **Receipt Printer** | Epson TM-T88VI Thermal 80mm | USB / Ethernet (ESC/POS) | ESC/POS byte sequence generation & cuts | Emulated / Requires physical printer |
| **Cash Drawer** | APG Series 4000 Heavy Duty | RJ11/RJ12 (DKD 24V Pulse) | DKD Pulse command trigger | Emulated / Requires physical drawer |
| **Touchscreen** | Elo Touch I-Series 15.6" Full HD | USB Projected Capacitive | Touch gesture & virtual keyboard | Verified via UI layout tests |
| **POS Keyboard** | Cherry G86-63400 Programmable POS | USB HID Keyboard | Hotkey mapper (F2, F3, F4, F10, Esc) | Verified in automated test suite |

---

## 2. Test Protocols & Step-by-Step Verification

### Protocol 1: Barcode Scanner Ingestion & Wedge Handling
1. **Objective:** Verify fast barcode entry directly into the POS cart without cursor focus loss.
2. **Setup:** Connect USB scanner in HID Wedge mode.
3. **Execution Steps:**
   - Scan standard EAN-13 barcode (`6221007011400`).
   - Validate that item is fetched by indexed lookup in under 50ms.
   - Validate that repeated scans increment line quantity without creating duplicate rows.
   - Scan unmapped barcode (`9999999999999`) and verify non-blocking alert ("Product not found").
4. **Pass Criteria:** Item recognized, price locked from database, audible confirmation beep triggered.

### Protocol 2: ESC/POS Thermal Receipt Formatting & Cutter
1. **Objective:** Validate receipt layout, 14% Egyptian VAT breakdown, and automatic paper cutting.
2. **Setup:** 80mm thermal receipt roll loaded into Epson printer.
3. **Execution Steps:**
   - Complete cash transaction of 114.00 EGP (100.00 EGP subtotal + 14.00 EGP VAT).
   - Transmit ESC/POS print stream with `ESC @` (init), `ESC a 1` (center), and `GS V A 3` (full cut).
4. **Pass Criteria:** Clean cut, correct Arabic/English header, items listed with quantities and unit prices, exact tax breakdown displayed.

### Protocol 3: Cash Drawer Solenoid Kick (DKD Pulse)
1. **Objective:** Verify cash drawer opens strictly on cash transactions and manager drawer-open events.
2. **Setup:** RJ11 drawer cable connected to DKD port of thermal receipt printer.
3. **Execution Steps:**
   - Tender cash payment and press `F2`.
   - Verify drawer solenoid pulse (`ESC p 0 50 50`) fires immediately.
   - Complete card transaction and verify cash drawer remains closed.
4. **Pass Criteria:** Drawer kicks open on cash; remains closed on card.

### Protocol 4: Keyboard-Only POS Operation (High-Speed Checkout)
1. **Objective:** Verify cashier can complete an entire transaction without touching a mouse or screen.
2. **Hotkeys Tested:**
   - `F2`: Tender Cash & open tender input.
   - `F3`: Tender Card & trigger card terminal dialog.
   - `F4`: Tender Exact Cash amount.
   - `F10`: Open catalog search dialog.
   - `Esc`: Abort modal or void highlighted item.
3. **Pass Criteria:** All actions operable purely via keyboard strokes.

### Protocol 5: Network Disconnection & Unplanned Application Restart
1. **Objective:** Verify zero data loss if network cable is unplugged or POS application is forcefully terminated during a transaction.
2. **Execution Steps:**
   - Disconnect network adapter (`hardwareSimulator.setNetworkState(false)`).
   - Ring up 3 items and complete offline checkout.
   - Verify order is persisted locally into `sync_events` outbox with state `synced = 0`.
   - Simulate crash / kill process.
   - Restart application and verify outbox transactions are recovered intact.
   - Reconnect network and verify batch auto-syncs with server using idempotent UUIDs.
3. **Pass Criteria:** Zero lost orders, zero negative inventory anomalies, duplicate syncs safely discarded.
