import 'dart:async';

abstract class BarcodeScannerAdapter {
  Stream<String> get barcodeStream;
  void simulateScan(String barcode);
  void dispose();
}

class KeyboardWedgeScanner implements BarcodeScannerAdapter {
  final _controller = StreamController<String>.broadcast();

  @override
  Stream<String> get barcodeStream => _controller.stream;

  @override
  void simulateScan(String barcode) {
    if (barcode.trim().isNotEmpty) {
      _controller.add(barcode.trim());
    }
  }

  @override
  void dispose() {
    _controller.close();
  }
}
