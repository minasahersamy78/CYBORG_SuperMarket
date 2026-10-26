import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/product.dart';
import 'api_config.dart';

class CatalogController extends ChangeNotifier {
  List<Product> products = [];
  List<String> categories = ['All'];
  String selectedCategory = 'All';
  String searchQuery = '';
  bool isLoading = true;
  String? error;

  Future<void> loadProducts() async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/products?limit=100')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final list = (data['data'] as List? ?? data['items'] as List? ?? data['products'] as List? ?? []);
        products = list.map((item) => Product.fromJson(item)).toList();

        // Extract categories
        final catSet = <String>{'All'};
        for (final p in products) {
          if (p.category.isNotEmpty) catSet.add(p.category);
        }
        categories = catSet.toList();
        isLoading = false;
        notifyListeners();
      } else {
        error = 'Failed to load products: HTTP ${res.statusCode}';
        isLoading = false;
        notifyListeners();
      }
    } catch (e) {
      error = 'Could not connect to supermarket backend: $e';
      isLoading = false;
      notifyListeners();
    }
  }

  void selectCategory(String cat) {
    selectedCategory = cat;
    notifyListeners();
  }

  void search(String query) {
    searchQuery = query.toLowerCase();
    notifyListeners();
  }

  List<Product> get filteredProducts {
    return products.where((p) {
      final matchesCategory = (selectedCategory == 'All' || p.category == selectedCategory);
      final matchesSearch = searchQuery.isEmpty ||
          p.name.toLowerCase().contains(searchQuery) ||
          p.nameAr.contains(searchQuery) ||
          p.barcode.contains(searchQuery);
      return matchesCategory && matchesSearch;
    }).toList();
  }
}
