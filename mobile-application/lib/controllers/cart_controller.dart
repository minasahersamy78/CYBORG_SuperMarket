import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/product.dart';
import '../models/cart_item.dart';
import 'api_config.dart';

class CartController extends ChangeNotifier {
  final List<CartItem> items = [];
  bool isCheckingOut = false;

  int get totalQuantity => items.fold(0, (sum, i) => sum + i.quantity);
  int get itemCount => totalQuantity;
  double get subtotal => items.fold(0.0, (sum, i) => sum + i.subtotal);
  double get vat => subtotal * 0.14; // 14% Egyptian VAT
  double get total => subtotal + vat;

  void addToCart(Product product, {int qty = 1}) {
    final idx = items.indexWhere((c) => c.product.id == product.id);
    if (idx >= 0) {
      items[idx].quantity += qty;
    } else {
      items.add(CartItem(product: product, quantity: qty));
    }
    notifyListeners();
  }

  void updateQuantity(int productId, int delta) {
    final idx = items.indexWhere((c) => c.product.id == productId);
    if (idx >= 0) {
      items[idx].quantity += delta;
      if (items[idx].quantity <= 0) {
        items.removeAt(idx);
      }
      notifyListeners();
    }
  }

  void clearCart() {
    items.clear();
    notifyListeners();
  }

  Future<Map<String, dynamic>> checkout({
    required String customerName,
    required String deliveryAddress,
    required String paymentMethod,
  }) async {
    if (items.isEmpty) {
      return {'success': false, 'error': 'Cart is empty'};
    }

    isCheckingOut = true;
    notifyListeners();

    try {
      final payload = {
        'source': 'MOBILE_APP',
        'customer_name': customerName,
        'customer_email': 'cyborgcoding1@gmail.com',
        'delivery_address': deliveryAddress,
        'payment_method': paymentMethod,
        'items': items.map((i) => {
          'product_id': i.product.id,
          'quantity': i.quantity,
        }).toList(),
      };

      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/orders'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(payload),
      ).timeout(const Duration(seconds: 8));

      isCheckingOut = false;
      notifyListeners();

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = json.decode(res.body);
        clearCart();
        return {'success': true, 'data': data};
      } else {
        final err = json.decode(res.body);
        return {'success': false, 'error': err['error'] ?? 'Checkout failed'};
      }
    } catch (e) {
      isCheckingOut = false;
      notifyListeners();
      return {'success': false, 'error': 'Connection failed: $e'};
    }
  }
}
