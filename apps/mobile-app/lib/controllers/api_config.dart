import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiConfig {
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:3000/api/v1';
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:3000/api/v1';
    } catch (_) {}
    return 'http://localhost:3000/api/v1';
  }
}
