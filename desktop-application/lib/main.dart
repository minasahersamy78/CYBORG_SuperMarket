import 'package:flutter/material.dart';
import 'features/checkout/presentation/pages/scan_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CyborgPosApp());
}

class CyborgPosApp extends StatelessWidget {
  const CyborgPosApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cyborg Supermarket POS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF10B981),
        scaffoldBackgroundColor: const Color(0xFF0B1120),
        cardColor: const Color(0xFF151D30),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981),
          secondary: Color(0xFF06B6D4),
          surface: Color(0xFF151D30),
          background: Color(0xFF0B1120),
        ),
        fontFamily: 'Segoe UI',
      ),
      home: const PosScanPage(),
    );
  }
}
