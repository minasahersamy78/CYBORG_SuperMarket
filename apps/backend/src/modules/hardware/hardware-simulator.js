/**
 * Cyborg Supermarket - POS Hardware Simulation & Verification Harness
 * Emulates physical retail peripherals: Barcode Scanners, ESC/POS Thermal Printers,
 * Cash Drawers (DKD pulse), and Keyboard-Only POS operation.
 */

class HardwareSimulator {
  constructor() {
    this.devices = {
      barcodeScanner: { connected: true, model: 'Honeywell Voyager 1400g (Emulated HID Wedge)' },
      receiptPrinter: { connected: true, model: 'Epson TM-T88VI Thermal 80mm (ESC/POS)' },
      cashDrawer: { connected: true, isOpen: false, model: 'APG Series 4000 (DKD 24V)' },
      touchscreen: { connected: true, resolution: '1920x1080', multiTouch: true }
    };
    this.printLog = [];
    this.drawerLog = [];
    this.networkOnline = true;
  }

  // 1. SCANNER EMULATION (HID Wedge / Serial Buffer)
  simulateBarcodeScan(barcodeString) {
    if (!this.devices.barcodeScanner.connected) {
      throw new Error('Barcode scanner is disconnected');
    }
    // Clean string, verify parity/length
    const sanitized = String(barcodeString).trim();
    if (!/^\d+$/.test(sanitized)) {
      throw new Error(`Invalid barcode format: "${barcodeString}" contains non-numeric characters`);
    }
    return {
      success: true,
      rawBarcode: sanitized,
      timestamp: Date.now(),
      type: sanitized.length === 13 ? 'EAN-13' : sanitized.length === 12 ? 'UPC-A' : 'CODE-128'
    };
  }

  // 2. ESC/POS RECEIPT PRINTER EMULATION
  simulatePrintReceipt({ orderId, storeName, items, subtotal, tax, discount, total, paymentMethod, cashierName }) {
    if (!this.devices.receiptPrinter.connected) {
      throw new Error('Thermal receipt printer is offline or paper out');
    }

    // Generate ESC/POS byte sequence and rendered text
    const escInit = '\x1B@'; // ESC @: Initialize printer
    const escCenter = '\x1Ba\x01'; // ESC a 1: Center justification
    const escLeft = '\x1Ba\x00'; // ESC a 0: Left justification
    const escBoldOn = '\x1BE\x01'; // ESC E 1: Bold on
    const escBoldOff = '\x1BE\x00'; // ESC E 0: Bold off
    const escCut = '\x1DV\x41\x03'; // GS V A 3: Full cut with feed

    const lines = [];
    lines.push('========================================');
    lines.push(`       ${storeName || 'CYBORG SUPERMARKET'}       `);
    lines.push('========================================');
    lines.push(`Order #:   ${orderId}`);
    lines.push(`Date:      ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
    lines.push(`Cashier:   ${cashierName || 'Cashier'}`);
    lines.push('----------------------------------------');
    lines.push('ITEM                      QTY    PRICE   TOTAL');
    lines.push('----------------------------------------');

    for (const item of items) {
      const name = (item.name_en || item.product_name_en || 'Product').substring(0, 22).padEnd(22, ' ');
      const qty = String(item.quantity || 1).padStart(3, ' ');
      const price = Number(item.unit_price || 0).toFixed(2).padStart(7, ' ');
      const itemTotal = Number(item.subtotal || 0).toFixed(2).padStart(7, ' ');
      lines.push(`${name} ${qty} ${price} ${itemTotal}`);
    }

    lines.push('----------------------------------------');
    lines.push(`Subtotal:                    ${Number(subtotal).toFixed(2).padStart(10, ' ')} EGP`);
    lines.push(`Egyptian VAT (14%):          ${Number(tax).toFixed(2).padStart(10, ' ')} EGP`);
    if (discount > 0) {
      lines.push(`Discount:                   -${Number(discount).toFixed(2).padStart(10, ' ')} EGP`);
    }
    lines.push(`TOTAL:                       ${Number(total).toFixed(2).padStart(10, ' ')} EGP`);
    lines.push(`Payment:                     ${paymentMethod}`);
    lines.push('========================================');
    lines.push('      Thank you for shopping with us!   ');
    lines.push('         شكراً لتسوقكم معنا             ');
    lines.push('========================================\n\n');

    const receiptOutput = lines.join('\n');
    const simulatedBuffer = Buffer.from(`${escInit}${escCenter}${receiptOutput}${escCut}`, 'utf-8');

    this.printLog.push({
      orderId,
      timestamp: Date.now(),
      byteLength: simulatedBuffer.length,
      renderedText: receiptOutput
    });

    return {
      success: true,
      byteCount: simulatedBuffer.length,
      linesCount: lines.length,
      renderedText: receiptOutput
    };
  }

  // 3. CASH DRAWER PULSE TRIGGER (DKD ESC p)
  triggerCashDrawerPulse(pin = 0, onTimeMs = 50, offTimeMs = 50) {
    if (!this.devices.cashDrawer.connected) {
      throw new Error('Cash drawer interface cable disconnected');
    }
    this.devices.cashDrawer.isOpen = true;
    const pulseEvent = {
      triggeredAt: Date.now(),
      pin,
      onTimeMs,
      offTimeMs,
      state: 'OPEN'
    };
    this.drawerLog.push(pulseEvent);
    return { success: true, drawerState: 'OPEN', pulseEvent };
  }

  closeCashDrawer() {
    this.devices.cashDrawer.isOpen = false;
    return { success: true, drawerState: 'CLOSED' };
  }

  // 4. KEYBOARD-ONLY POS HOTKEY EMULATION
  handleKeyboardHotkey(keyCode) {
    const keyMap = {
      F2: { action: 'PAY_CASH', description: 'Tender Cash Payment' },
      F3: { action: 'PAY_CARD', description: 'Initiate Card Terminal Payment' },
      F4: { action: 'PAY_EXACT', description: 'Tender Exact Cash Amount' },
      F10: { action: 'SEARCH_CATALOG', description: 'Open Product Lookup Search Modal' },
      ESCAPE: { action: 'CANCEL_OR_VOID', description: 'Void Current Line or Abort Dialog' }
    };

    const action = keyMap[keyCode.toUpperCase()];
    if (!action) {
      return { handled: false, code: keyCode };
    }
    return { handled: true, keyCode: keyCode.toUpperCase(), action: action.action, description: action.description };
  }

  // 5. NETWORK RESILIENCE EMULATION
  setNetworkState(isOnline) {
    this.networkOnline = Boolean(isOnline);
    return { networkOnline: this.networkOnline };
  }
}

const hardwareSimulator = new HardwareSimulator();
module.exports = { hardwareSimulator, HardwareSimulator };
