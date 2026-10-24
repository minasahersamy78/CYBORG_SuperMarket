import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../../../../core/hardware/barcode_scanner.dart';
import '../../../../core/hardware/thermal_printer.dart';
import '../../../../core/hardware/cash_drawer.dart';
import '../../../../core/sync/sync_engine.dart';

class CartLine {
  final int productId;
  final String barcode;
  final String nameEn;
  final String nameAr;
  int quantity;
  final double unitPrice;

  CartLine({
    required this.productId,
    required this.barcode,
    required this.nameEn,
    required this.nameAr,
    required this.quantity,
    required this.unitPrice,
  });

  double get lineTotal => quantity * unitPrice;
}

class PosScanPage extends StatefulWidget {
  const PosScanPage({Key? key}) : super(key: key);

  @override
  State<PosScanPage> createState() => _PosScanPageState();
}

class _PosScanPageState extends State<PosScanPage> {
  final TextEditingController _barcodeCtrl = TextEditingController();
  final FocusNode _barcodeFocus = FocusNode();
  final List<CartLine> _lines = [];

  final String _backendUrl = 'http://localhost:3000/api/v1';
  final String _terminalId = 'TERM-01';
  final String _cashierName = 'Cashier Ahmed';
  final String _shiftId = 'shift-cairo-001';

  final StandardThermalPrinter _printer = StandardThermalPrinter();
  final CashDrawerController _drawer = CashDrawerController();
  late final SyncEngine _syncEngine;

  bool _isOnline = true;
  String _statusMessage = 'System Ready · Terminal 01';

  @override
  void initState() {
    super.initState();
    _syncEngine = SyncEngine(backendUrl: _backendUrl, terminalId: _terminalId);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _barcodeFocus.requestFocus();
    });
  }

  double get subtotal => _lines.fold(0.0, (acc, line) => acc + line.lineTotal);
  double get tax => subtotal * 0.14; // 14% Egyptian VAT
  double get total => subtotal + tax;

  Future<void> _handleBarcodeSubmit(String rawBarcode) async {
    final barcode = rawBarcode.trim();
    if (barcode.isEmpty) return;

    _barcodeCtrl.clear();
    _barcodeFocus.requestFocus();

    // Check if already in cart lines -> increment quantity
    final existingIdx = _lines.indexWhere((l) => l.barcode == barcode);
    if (existingIdx >= 0) {
      setState(() {
        _lines[existingIdx].quantity++;
        _statusMessage = 'Incremented qty for ${_lines[existingIdx].nameEn}';
      });
      return;
    }

    // Lookup barcode from backend API or local cache
    try {
      final res = await http.get(Uri.parse('$_backendUrl/products/barcode/$barcode'));
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        if (json['success'] == true && json['data'] != null) {
          final p = json['data'];
          setState(() {
            _lines.add(CartLine(
              productId: p['id'],
              barcode: p['barcode'],
              nameEn: p['name_en'],
              nameAr: p['name_ar'],
              quantity: 1,
              unitPrice: (p['price'] as num).toDouble(),
            ));
            _statusMessage = 'Added: ${p['name_en']}';
          });
          return;
        }
      }
      setState(() {
        _statusMessage = 'Barcode not found: $barcode';
      });
    } catch (e) {
      // Offline fallback: Add mock entry with scanned barcode for local durability
      setState(() {
        _isOnline = false;
        _lines.add(CartLine(
          productId: DateTime.now().millisecondsSinceEpoch % 1000,
          barcode: barcode,
          nameEn: 'Offline Scanned Item ($barcode)',
          nameAr: 'منتج مسجل بدون اتصال',
          quantity: 1,
          unitPrice: 50.00,
        ));
        _statusMessage = 'Offline Mode: Stored locally';
      });
    }
  }

  Future<void> _processPayment(String method) async {
    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty. Please scan items first.')),
      );
      return;
    }

    final currentTotal = total;
    final currentSubtotal = subtotal;
    final currentTax = tax;
    final currentLines = List<CartLine>.from(_lines);

    // 1. Kick cash drawer if Cash
    if (method == 'CASH') {
      await _drawer.kickDrawer();
    }

    // 2. Submit order to backend or queue to local sync outbox
    final orderPayload = {
      'items': currentLines.map((l) => {
        'product_id': l.productId,
        'quantity': l.quantity,
        'unit_price': l.unitPrice,
        'name_en': l.nameEn,
        'name_ar': l.nameAr,
        'barcode': l.barcode
      }).toList(),
      'source': 'POS',
      'payment_method': method,
      'terminal_id': _terminalId,
      'shift_id': _shiftId,
      'subtotal': currentSubtotal,
      'tax_amount': currentTax,
      'total_amount': currentTotal,
      'idempotency_key': 'pos-${DateTime.now().millisecondsSinceEpoch}',
    };

    bool syncedNow = false;
    try {
      final res = await http.post(
        Uri.parse('$_backendUrl/orders'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(orderPayload),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        syncedNow = true;
      }
    } catch (e) {
      // Network disconnected -> Queue locally into sync outbox
      await _syncEngine.queueLocalTransaction(
        'ORDER',
        orderPayload['idempotency_key'] as String,
        'INSERT',
        orderPayload,
      );
    }

    // 3. Print thermal receipt
    final receiptData = ReceiptData(
      storeName: 'CYBORG HYPERMARKET',
      storeAddress: 'Ring Road, New Cairo, Cairo, Egypt',
      receiptNumber: 'REC-${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}',
      cashierName: _cashierName,
      terminalId: _terminalId,
      timestamp: DateTime.now(),
      items: currentLines.map((l) => ReceiptItem(
        name: l.nameEn,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.lineTotal,
      )).toList(),
      subtotal: currentSubtotal,
      tax: currentTax,
      total: currentTotal,
      paymentMethod: method,
      tendered: currentTotal,
      change: 0.00,
    );

    await _printer.printReceipt(receiptData);

    // 4. Reset Cart
    setState(() {
      _lines.clear();
      _statusMessage = syncedNow
          ? 'Transaction completed & synced (${currentTotal.toStringAsFixed(2)} EGP)'
          : 'Transaction completed OFFLINE & queued for sync (${currentTotal.toStringAsFixed(2)} EGP)';
    });

    _barcodeFocus.requestFocus();

    // Show confirmation modal
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sale Completed Successfully'),
        content: Text(
          'Total: ${currentTotal.toStringAsFixed(2)} EGP\n'
          'Method: $method\n'
          'Sync State: ${syncedNow ? "Synchronized to Cloud DB" : "Persisted to Local SQLite Outbox"}\n\n'
          '${_printer.formatAsciiReceipt(receiptData)}',
          style: const TextStyle(fontFamily: 'Courier', fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Next Transaction (Enter)'),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RawKeyboardListener(
      focusNode: FocusNode(),
      onKey: (event) {
        if (event is RawKeyDownEvent) {
          if (event.logicalKey == LogicalKeyboardKey.f1) {
            _barcodeFocus.requestFocus();
          } else if (event.logicalKey == LogicalKeyboardKey.f2) {
            _processPayment('CASH');
          } else if (event.logicalKey == LogicalKeyboardKey.f3) {
            _processPayment('CARD');
          } else if (event.logicalKey == LogicalKeyboardKey.escape) {
            setState(() => _lines.clear());
          }
        }
      },
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B1120),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F766E),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('POS 01', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ),
              const SizedBox(width: 14),
              Text('Cashier: $_cashierName', style: const TextStyle(fontSize: 14)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _isOnline ? Colors.green.withOpacity(0.2) : Colors.orange.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(Icons.circle, size: 8, color: _isOnline ? Colors.green : Colors.orange),
                    const SizedBox(width: 6),
                    Text(
                      _isOnline ? 'Online Synced' : 'Offline Mode (Local SQLite)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _isOnline ? Colors.green : Colors.orange,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        body: Row(
          children: [
            // Left Side: Scanned Items Table
            Expanded(
              flex: 3,
              child: Container(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Barcode Input
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _barcodeCtrl,
                            focusNode: _barcodeFocus,
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            decoration: InputDecoration(
                              labelText: 'Scan Barcode or Enter Product Code (F1)',
                              prefixIcon: const Icon(Icons.qr_code_scanner),
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.arrow_forward),
                                onPressed: () => _handleBarcodeSubmit(_barcodeCtrl.text),
                              ),
                              border: const OutlineInputBorder(),
                              filled: true,
                              fillColor: const Color(0xFF1E293B),
                            ),
                            onSubmitted: _handleBarcodeSubmit,
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F766E),
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                          ),
                          onPressed: () => _handleBarcodeSubmit(_barcodeCtrl.text),
                          icon: const Icon(Icons.add_shopping_cart),
                          label: const Text('Add (Enter)'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Scanned Items List Header
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Expanded(flex: 2, child: Text('BARCODE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey))),
                          Expanded(flex: 4, child: Text('PRODUCT NAME', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey))),
                          Expanded(flex: 2, child: Text('PRICE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey))),
                          Expanded(flex: 2, child: Text('QTY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey))),
                          Expanded(flex: 2, child: Text('TOTAL', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey))),
                          SizedBox(width: 40),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Items List
                    Expanded(
                      child: _lines.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.point_of_sale, size: 64, color: Colors.grey.withOpacity(0.5)),
                                  const SizedBox(height: 12),
                                  const Text('No items scanned yet.', style: TextStyle(color: Colors.grey)),
                                  const SizedBox(height: 6),
                                  const Text('Scan a product barcode or type barcode above.', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                ],
                              ),
                            )
                          : ListView.builder(
                              itemCount: _lines.length,
                              itemBuilder: (ctx, idx) {
                                final line = _lines[idx];
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1E293B).withOpacity(0.5),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFF334155)),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(flex: 2, child: Text(line.barcode, style: const TextStyle(fontFamily: 'monospace', fontSize: 12))),
                                      Expanded(
                                        flex: 4,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(line.nameEn, style: const TextStyle(fontWeight: FontWeight.w600)),
                                            Text(line.nameAr, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                          ],
                                        ),
                                      ),
                                      Expanded(flex: 2, child: Text('${line.unitPrice.toStringAsFixed(2)} EGP')),
                                      Expanded(
                                        flex: 2,
                                        child: Row(
                                          children: [
                                            InkWell(
                                              onTap: () {
                                                setState(() {
                                                  if (line.quantity > 1) {
                                                    line.quantity--;
                                                  } else {
                                                    _lines.removeAt(idx);
                                                  }
                                                });
                                              },
                                              child: const Icon(Icons.remove_circle_outline, size: 18),
                                            ),
                                            Padding(
                                              padding: const EdgeInsets.symmetric(horizontal: 8),
                                              child: Text('${line.quantity}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                            ),
                                            InkWell(
                                              onTap: () => setState(() => line.quantity++),
                                              child: const Icon(Icons.add_circle_outline, size: 18),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          '${line.lineTotal.toStringAsFixed(2)} EGP',
                                          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.close, size: 16, color: Colors.redAccent),
                                        onPressed: () => setState(() => _lines.removeAt(idx)),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),

                    // Status Bar
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0B1120),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline, size: 16, color: Colors.grey),
                          const SizedBox(width: 8),
                          Text(_statusMessage, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Right Side: Cart Summary & Checkout Actions
            Container(
              width: 380,
              color: const Color(0xFF0B1120),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('ORDER SUMMARY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey)),
                  const SizedBox(height: 20),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text('Items Count:'),
                      Text('${_lines.fold(0, (acc, l) => acc + l.quantity)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text('Subtotal:'),
                      Text('${subtotal.toStringAsFixed(2)} EGP', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text('Egyptian VAT (14%):'),
                      Text('${tax.toStringAsFixed(2)} EGP', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Color(0xFF334155)),
                  const SizedBox(height: 16),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text('TOTAL PAYABLE:', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                      Text(
                        '${total.toStringAsFixed(2)} EGP',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: Color(0xFF38BDF8)),
                      ),
                    ],
                  ),
                  const Spacer(),

                  // Fast Pay Buttons
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => _processPayment('CASH'),
                    icon: const Icon(Icons.attach_money, size: 24),
                    label: const Text('PAY CASH (F2)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 12),

                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => _processPayment('CARD'),
                    icon: const Icon(Icons.credit_card, size: 24),
                    label: const Text('PAY CARD (F3)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 12),

                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: Color(0xFF334155)),
                    ),
                    onPressed: () => setState(() => _lines.clear()),
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('VOID SALE (ESC)'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
