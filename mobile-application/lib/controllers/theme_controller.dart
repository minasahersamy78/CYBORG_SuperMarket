import 'package:flutter/material.dart';

class ThemeController extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.dark;

  ThemeMode get themeMode => _themeMode;
  bool get isDark => _themeMode == ThemeMode.dark;

  void toggleTheme() {
    _themeMode = isDark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      cardColor: Colors.white,
      colorScheme: const ColorScheme.light(
        primary: Color(0xFF10B981),
        secondary: Color(0xFF06B6D4),
        surface: Colors.white,
        background: Color(0xFFF8FAFC),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF0F172A),
        elevation: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFF10B981).withOpacity(0.15),
        labelTextStyle: MaterialStateProperty.all(
          const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF07090E), // Cyber Dark from VOICE UPDATES
      cardColor: const Color(0xFF0D121F), // Glass Surface from VOICE UPDATES
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFF10B981), // Cyber Emerald
        secondary: Color(0xFF06B6D4), // Cyber Cyan
        surface: Color(0xFF0D121F),
        background: Color(0xFF07090E),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF07090E),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: const Color(0xFF07090E),
        indicatorColor: const Color(0xFF10B981).withOpacity(0.2),
        labelTextStyle: MaterialStateProperty.all(
          const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
        ),
      ),
    );
  }
}
