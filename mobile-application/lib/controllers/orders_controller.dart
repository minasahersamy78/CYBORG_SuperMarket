import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/order.dart';
import 'api_config.dart';

class OrdersController extends ChangeNotifier {
  List<OrderModel> orders = [];
  bool isLoading = true;
  String? error;

  Future<void> fetchOrders() async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/orders')).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final list = (data is List) ? data : (data['data'] as List? ?? []);
        orders = list.map((item) => OrderModel.fromJson(item)).toList();
        isLoading = false;
        notifyListeners();
      } else {
        error = 'Failed to load orders: HTTP ${res.statusCode}';
        isLoading = false;
        notifyListeners();
      }
    } catch (e) {
      error = 'Could not retrieve orders: $e';
      isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> cancelOrder(String orderId, {String reason = 'Customer cancelled from mobile'}) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/orders/$orderId/cancel'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'reason': reason}),
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        // Refresh local orders list
        await fetchOrders();
        return {'success': true, 'data': data};
      } else {
        final err = json.decode(res.body);
        return {'success': false, 'error': err['error'] ?? 'Cancellation failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection failed: $e'};
    }
  }
}
