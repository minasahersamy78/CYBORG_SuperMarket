import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../models/product.dart';
import '../../controllers/language_controller.dart';
import '../../controllers/api_config.dart';

class SmartPantryTab extends StatefulWidget {
  final LanguageController languageController;
  final Function(Product) onAddToCart;

  const SmartPantryTab({
    super.key,
    required this.languageController,
    required this.onAddToCart,
  });

  @override
  State<SmartPantryTab> createState() => _SmartPantryTabState();
}

class _SmartPantryTabState extends State<SmartPantryTab> {
  double _durationDays = 14;
  double _budget = 2000;
  bool _isGenerating = false;
  Map<String, dynamic>? _basketResult;
  String? _error;

  Future<void> _generateSmartBasket() async {
    setState(() {
      _isGenerating = true;
      _error = null;
    });

    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/recommendations/smart-basket'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'budget': _budget,
          'duration_days': _durationDays.toInt(),
        }),
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        setState(() {
          _basketResult = data['data'];
          _isGenerating = false;
        });
      } else {
        setState(() {
          _error = 'Failed to generate basket: HTTP ${res.statusCode}';
          _isGenerating = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Connection failed: $e';
        _isGenerating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.languageController.tr;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF10B981), Color(0xFF06B6D4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.kitchen, color: Colors.white, size: 28),
                    SizedBox(width: 8),
                    Text(
                      'AI Smart Basket Planner',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Optimized grocery planning for 1 to 365 days with Egyptian knapsack budget allocation.',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Duration Slider (1 to 365 days)
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(tr('duration_label'), style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('${_durationDays.toInt()} Days', style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF10B981))),
                    ],
                  ),
                  Slider(
                    value: _durationDays,
                    min: 1,
                    max: 365,
                    divisions: 364,
                    activeColor: const Color(0xFF10B981),
                    onChanged: (val) => setState(() => _durationDays = val),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      Text('1 Day', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      Text('1 Month (30d)', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      Text('1 Year (365d)', style: TextStyle(fontSize: 10, color: Colors.grey)),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Budget Slider
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(tr('budget_label'), style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('${_budget.toInt()} EGP', style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF22C55E))),
                    ],
                  ),
                  Slider(
                    value: _budget,
                    min: 100,
                    max: 20000,
                    divisions: 199,
                    activeColor: const Color(0xFF22C55E),
                    onChanged: (val) => setState(() => _budget = val),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      Text('100 EGP', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      Text('5,000 EGP', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      Text('20,000 EGP', style: TextStyle(fontSize: 10, color: Colors.grey)),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Generate Button
          SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _isGenerating ? null : _generateSmartBasket,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: _isGenerating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.auto_awesome),
              label: Text(
                _isGenerating ? 'Calculating Optimal Basket...' : tr('generate_basket'),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
          ),

          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13), textAlign: TextAlign.center),
          ],

          if (_basketResult != null) ...[
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recommended Basket (${_basketResult!['total_items'] ?? 0} items)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Text(
                  '${_basketResult!['total_cost'] ?? 0} EGP',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF22C55E)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: (_basketResult!['items'] as List? ?? []).length,
              itemBuilder: (context, idx) {
                final item = _basketResult!['items'][idx];
                final prod = Product(
                  id: item['id'] ?? (idx + 1),
                  sku: item['barcode'] ?? '',
                  name: item['name_en'] ?? item['name'] ?? 'Product',
                  nameAr: item['name_ar'] ?? '',
                  category: item['category'] ?? 'General',
                  price: (item['price'] as num?)?.toDouble() ?? 0.0,
                  barcode: item['barcode'] ?? '62200000000',
                  imageUrl: item['image_url'] ?? '',
                  stock: 50,
                );

                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(
                      widget.languageController.isArabic && prod.nameAr.isNotEmpty ? prod.nameAr : prod.name,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    subtitle: Text('${item['recommended_quantity'] ?? 1}x @ ${prod.price} EGP'),
                    trailing: ElevatedButton(
                      onPressed: () {
                        widget.onAddToCart(prod);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('${prod.name} added to cart'),
                            duration: const Duration(seconds: 1),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      ),
                      child: const Text('Add', style: TextStyle(fontSize: 11, color: Colors.white)),
                    ),
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
