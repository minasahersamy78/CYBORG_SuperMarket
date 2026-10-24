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
        primaryColor: const Color(0xFF0F766E),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        cardColor: const Color(0xFF1E293B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0F766E),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF1E293B),
          background: Color(0xFF0F172A),
        ),
        fontFamily: 'Segoe UI',
      ),
      home: const PosScanPage(),
    );
  }
}
