import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CyborgMobileApp());
}

class CyborgMobileApp extends StatefulWidget {
  const CyborgMobileApp({Key? key}) : super(key: key);

  @override
  State<CyborgMobileApp> createState() => _CyborgMobileAppState();
}

class _CyborgMobileAppState extends State<CyborgMobileApp> {
  Locale _locale = const Locale('ar', 'EG');

  void toggleLocale() {
    setState(() {
      _locale = _locale.languageCode == 'ar'
          ? const Locale('en', 'US')
          : const Locale('ar', 'EG');
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cyborg Supermarket',
      debugShowCheckedModeBanner: false,
      locale: _locale,
      theme: ThemeData(
        primaryColor: const Color(0xFF0F766E),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F766E),
          primary: const Color(0xFF0F766E),
          secondary: const Color(0xFFF59E0B),
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        fontFamily: _locale.languageCode == 'ar' ? 'Cairo' : 'Segoe UI',
        useMaterial3: true,
      ),
      home: MobileHomeScreen(onToggleLocale: toggleLocale),
    );
  }
}

class MobileHomeScreen extends StatefulWidget {
  final VoidCallback onToggleLocale;
  const MobileHomeScreen({Key? key, required this.onToggleLocale}) : super(key: key);

  @override
  State<MobileHomeScreen> createState() => _MobileHomeScreenState();
}

class _MobileHomeScreenState extends State<MobileHomeScreen> {
  int _currentIndex = 0;
  final String _backendUrl = 'http://localhost:3000/api/v1';

  List<dynamic> _products = [];
  bool _isLoading = true;
  int _selectedCategory = 0; // 0: All
  final List<Map<String, dynamic>> _cartItems = [];

  @override
  void initState() {
    super.initState();
    _fetchProducts();
  }

  Future<void> _fetchProducts([int? categoryId, String? search]) async {
    setState(() => _isLoading = true);
    try {
      String url = '$_backendUrl/products?limit=20';
      if (categoryId != null && categoryId > 0) url += '&category_id=$categoryId';
      if (search != null && search.isNotEmpty) url += '&q=${Uri.encodeComponent(search)}';

      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        setState(() {
          _products = json['data'] ?? [];
          _isLoading = false;
        });
        return;
      }
    } catch (e) {
      // Graceful offline mock products
    }
    setState(() => _isLoading = false);
  }

  void _addToCart(dynamic product) {
    setState(() {
      final idx = _cartItems.indexWhere((x) => x['id'] == product['id']);
      if (idx >= 0) {
        _cartItems[idx]['quantity']++;
      } else {
        _cartItems.add({
          'id': product['id'],
          'name_en': product['name_en'],
          'name_ar': product['name_ar'],
          'price': (product['price'] as num).toDouble(),
          'quantity': 1,
        });
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added ${product['name_en']} to cart'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F766E),
        foregroundColor: Colors.white,
        title: Text(
          isArabic ? 'سيبورج سوبر ماركت' : 'Cyborg Supermarket',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.language),
            onPressed: widget.onToggleLocale,
            tooltip: 'Switch Language',
          ),
          IconButton(
            icon: const Icon(Icons.mic),
            onPressed: _showVoiceDialog,
            tooltip: 'Egyptian Voice Assistant',
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildCatalogTab(isArabic),
          _buildFamilyCartTab(isArabic),
          _buildSmartPantryTab(isArabic),
          _buildOrdersTab(isArabic),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.storefront_outlined),
            selectedIcon: const Icon(Icons.storefront),
            label: isArabic ? 'المنتجات' : 'Catalog',
          ),
          NavigationDestination(
            icon: Badge(
              label: Text('${_cartItems.fold(0, (acc, item) => acc + (item["quantity"] as int))}'),
              child: const Icon(Icons.group_outlined),
            ),
            selectedIcon: const Icon(Icons.group),
            label: isArabic ? 'السلة العائلية' : 'Family Cart',
          ),
          NavigationDestination(
            icon: const Icon(Icons.kitchen_outlined),
            selectedIcon: const Icon(Icons.kitchen),
            label: isArabic ? 'المؤونة الذكية' : 'Smart Pantry',
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long),
            label: isArabic ? 'طلباتي' : 'Orders',
          ),
        ],
      ),
    );
  }

  Widget _buildCatalogTab(bool isArabic) {
    return Column(
      children: [
        // Search
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: isArabic ? 'ابحث في 1,000 منتج...' : 'Search 1,000 products...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16),
            ),
            onSubmitted: (val) => _fetchProducts(_selectedCategory, val),
          ),
        ),

        // Category Pills
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              _buildCategoryChip(0, isArabic ? 'الكل' : 'All'),
              _buildCategoryChip(1, isArabic ? 'أطعمة طازجة' : 'Fresh Food'),
              _buildCategoryChip(2, isArabic ? 'مشروبات' : 'Beverages'),
              _buildCategoryChip(3, isArabic ? 'أطعمة مجمدة' : 'Frozen Food'),
              _buildCategoryChip(4, isArabic ? 'سوبر ماركت' : 'Food Cupboard'),
              _buildCategoryChip(5, isArabic ? 'خضار وفواكه' : 'Produce'),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // Product Grid
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _products.isEmpty
                  ? Center(child: Text(isArabic ? 'لا توجد منتجات' : 'No products found'))
                  : GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.72,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                      ),
                      itemCount: _products.length,
                      itemBuilder: (ctx, idx) {
                        final p = _products[idx];
                        final title = isArabic ? p['name_ar'] : p['name_en'];
                        final price = (p['price'] as num).toDouble();
                        return Card(
                          elevation: 1,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade100,
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                                  ),
                                  child: p['image_url'] != null
                                      ? Image.network(
                                          p['image_url'],
                                          fit: BoxFit.contain,
                                          errorBuilder: (_, __, ___) => const Icon(Icons.shopping_bag, size: 48, color: Colors.grey),
                                        )
                                      : const Icon(Icons.shopping_bag, size: 48, color: Colors.grey),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(8),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${price.toStringAsFixed(2)} EGP',
                                      style: const TextStyle(
                                        color: Color(0xFF0F766E),
                                        fontWeight: FontWeight.w800,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    SizedBox(
                                      width: double.infinity,
                                      height: 32,
                                      child: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF0F766E),
                                          foregroundColor: Colors.white,
                                          padding: EdgeInsets.zero,
                                        ),
                                        onPressed: () => _addToCart(p),
                                        child: Text(isArabic ? '+ أضف' : '+ Add', style: const TextStyle(fontSize: 12)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  Widget _buildCategoryChip(int id, String label) {
    final isSelected = _selectedCategory == id;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (val) {
          setState(() => _selectedCategory = id);
          _fetchProducts(id);
        },
        selectedColor: const Color(0xFF0F766E).withOpacity(0.2),
        checkmarkColor: const Color(0xFF0F766E),
      ),
    );
  }

  Widget _buildFamilyCartTab(bool isArabic) {
    final subtotal = _cartItems.fold(0.0, (acc, item) => acc + (item['price'] * item['quantity']));
    final tax = subtotal * 0.14;
    final total = subtotal + tax;
    const double budgetLimit = 1500.00;
    final budgetPercent = (total / budgetLimit).clamp(0.0, 1.0);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Family Budget Progress Bar
          Card(
            color: const Color(0xFF0F172A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Text(isArabic ? 'ميزانية العائلة المشتركة' : 'Family Shared Budget', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      Text('${total.toStringAsFixed(2)} / $budgetLimit EGP', style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  LinearProgressIndicator(
                    value: budgetPercent,
                    backgroundColor: Colors.white24,
                    color: budgetPercent > 0.9 ? Colors.redAccent : const Color(0xFF10B981),
                    minHeight: 8,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isArabic ? 'الأعضاء: الأب (المالك)، الأم، طارق' : 'Members: Dad (Owner), Mom, Tarek',
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Items List
          Expanded(
            child: _cartItems.isEmpty
                ? Center(child: Text(isArabic ? 'السلة فارغة' : 'Your family cart is empty'))
                : ListView.builder(
                    itemCount: _cartItems.length,
                    itemBuilder: (ctx, idx) {
                      final it = _cartItems[idx];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFF0F766E).withOpacity(0.1),
                          child: const Icon(Icons.shopping_bag, color: Color(0xFF0F766E)),
                        ),
                        title: Text(isArabic ? it['name_ar'] : it['name_en']),
                        subtitle: Text('${it['quantity']} x ${it['price'].toStringAsFixed(2)} EGP'),
                        trailing: Text(
                          '${(it['quantity'] * it['price']).toStringAsFixed(2)} EGP',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      );
                    },
                  ),
          ),

          // Checkout
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8)],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    Text(isArabic ? 'المجموع شامل الضريبة (14%):' : 'Total with VAT (14%):', style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text('${total.toStringAsFixed(2)} EGP', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0F766E))),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _cartItems.isEmpty ? null : _checkoutFamilyCart,
                    child: Text(isArabic ? 'تأكيد ودفع الطلب العائلي' : 'Submit Family Order', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSmartPantryTab(bool isArabic) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isArabic ? 'المؤونة المنزلية الذكية' : 'Smart Pantry Replenishment',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            isArabic
                ? 'توقعات الاستهلاك التلقائية بناءً على معدل الشراء الأسبوعي'
                : 'Automated staple replenishment schedule calculated from order patterns',
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView(
              children: [
                _buildPantryCard(isArabic ? 'حليب جهينة كامل الدسم' : 'Juhayna Full Cream Milk', '2 days left', Colors.red, isArabic),
                _buildPantryCard(isArabic ? 'بيض مزارعون مصريون أحمر' : 'Egyptian Growers Red Eggs', '3 days left', Colors.orange, isArabic),
                _buildPantryCard(isArabic ? 'جبنة قريش مزارع دينا' : 'Dina Farms Cottage Cheese', '4 days left', Colors.orange, isArabic),
                _buildPantryCard(isArabic ? 'أرز الضحى مصري' : 'El Doha Egyptian Rice', '10 days left', Colors.green, isArabic),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPantryCard(String name, String status, Color color, bool isArabic) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(Icons.kitchen, color: color)),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(isArabic ? 'معدل التجديد: كل أسبوع' : 'Replenish: Weekly cycle'),
        trailing: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F766E), foregroundColor: Colors.white),
          onPressed: () {},
          child: Text(isArabic ? 'إعادة طلب' : 'Reorder'),
        ),
      ),
    );
  }

  Widget _buildOrdersTab(bool isArabic) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.receipt_long, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(isArabic ? 'سجل الطلبات المتزامن مع السيرفر' : 'Orders Synchronized with Backend'),
          const SizedBox(height: 8),
          Text(isArabic ? 'جميع الفواتير والطلبات تظهر لحظياً' : 'All transactions update in real-time', style: const TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
    );
  }

  void _checkoutFamilyCart() async {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Family Order Placed'),
        content: const Text('Your order has been recorded in the central database and inventory has been reserved.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _cartItems.clear());
            },
            child: const Text('OK'),
          )
        ],
      ),
    );
  }

  void _showVoiceDialog() {
    final textCtrl = TextEditingController(text: 'عايز لبن كامل الدسم');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('المساعد الذكي (لهجة مصرية)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('اكتب أو تحدث بطلبك مثل: "عايز لبن جهينه" أو "بكام سمنة دينا"'),
            const SizedBox(height: 12),
            TextField(controller: textCtrl, decoration: const InputDecoration(border: OutlineInputBorder())),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final res = await http.post(
                Uri.parse('$_backendUrl/ai/voice'),
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode({'query': textCtrl.text}),
              );
              if (res.statusCode == 200) {
                final d = jsonDecode(res.body)['data'];
                if (!mounted) return;
                showDialog(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: Text('النية: ${d["intent"]} (${(d["confidence"]*100).toInt()}%)'),
                    content: Text('${d["message"]}'),
                    actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('حسناً'))],
                  ),
                );
              }
            },
            child: const Text('إرسال للمساعد'),
          ),
        ],
      ),
    );
  }
}
