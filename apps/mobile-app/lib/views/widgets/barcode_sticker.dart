import 'package:flutter/material.dart';

class BarcodeSticker extends StatelessWidget {
  final String barcode;
  final double height;

  const BarcodeSticker({super.key, required this.barcode, this.height = 34});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomPaint(
            size: Size(double.infinity, height),
            painter: _BarcodePainter(barcode: barcode),
          ),
          const SizedBox(height: 2),
          Text(
            barcode,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              color: Colors.black,
              fontFamily: 'monospace',
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _BarcodePainter extends CustomPainter {
  final String barcode;
  _BarcodePainter({required this.barcode});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    final barCount = 38;
    final totalWidth = size.width;
    final barStep = totalWidth / barCount;

    int hash = barcode.hashCode.abs();
    for (int i = 0; i < barCount; i++) {
      final isThick = ((hash >> (i % 24)) & 1) == 1 || (i % 4 == 0);
      final barWidth = isThick ? barStep * 0.75 : barStep * 0.4;
      final x = i * barStep + (barStep - barWidth) / 2;

      canvas.drawRect(Rect.fromLTWH(x, 0, barWidth, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
