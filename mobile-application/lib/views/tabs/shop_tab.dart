import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../controllers/catalog_controller.dart';
import '../../controllers/language_controller.dart';
import '../widgets/product_card.dart';

class ShopTab extends StatelessWidget {
  final CatalogController catalogController;
  final LanguageController languageController;
  final Function(Product) onAddToCart;

  const ShopTab({
    super.key,
    required this.catalogController,
    required this.languageController,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    final tr = languageController.tr;
    final isArabic = languageController.isArabic;

    return AnimatedBuilder(
      animation: catalogController,
      builder: (context, _) {
        if (catalogController.isLoading) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
        }

        if (catalogController.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off, size: 48, color: Colors.amber),
                const SizedBox(height: 12),
                Text(catalogController.error!, textAlign: TextAlign.center),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: catalogController.loadProducts,
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        final filtered = catalogController.filteredProducts;

        // Standard categories
        final standardCategories = [
          'All',
          'Fresh Food',
          'Beverages',
          'Food Cupboard',
          'Frozen Food',
          'Fruits & Vegetables',
        ];

        return Column(
          children: [
            // Bilingual Search Bar (Arabic & English name search)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                onChanged: catalogController.search,
                decoration: InputDecoration(
                  hintText: isArabic ? 'ابحث باسم المنتج (عربي أو إنجليزي)...' : 'Search by product name (AR / EN)...',
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF10B981)),
                  filled: true,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),

            // Category Filter Buttons / Chips
            SizedBox(
              height: 46,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: standardCategories.length,
                itemBuilder: (context, idx) {
                  final cat = standardCategories[idx];
                  final isSelected = cat == catalogController.selectedCategory;
                  String label = cat;
                  if (cat == 'All') label = isArabic ? 'جميع الأقسام' : 'All Products';
                  else if (cat == 'Fresh Food') label = isArabic ? '🥬 أطعمة طازجة' : '🥬 Fresh Food';
                  else if (cat == 'Beverages') label = isArabic ? '🧃 مشروبات وعصائر' : '🧃 Beverages';
                  else if (cat == 'Food Cupboard') label = isArabic ? '🍚 بقالة وبقوليات' : '🍚 Food Cupboard';
                  else if (cat == 'Frozen Food') label = isArabic ? '❄️ أطعمة مجمدة' : '❄️ Frozen Food';
                  else if (cat == 'Fruits & Vegetables') label = isArabic ? '🍎 خضار وفواكه' : '🍎 Fruits & Veg';

                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected ? Colors.white : Colors.grey.shade400,
                        ),
                      ),
                      selected: isSelected,
                      selectedColor: const Color(0xFF10B981),
                      backgroundColor: const Color(0xFF0D121F),
                      side: BorderSide(
                        color: isSelected ? const Color(0xFF10B981) : const Color(0xFF141C2E),
                      ),
                      onSelected: (_) => catalogController.selectCategory(cat),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 6),

            // Products Area: Grouped as Categories or Filtered
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.search_off, size: 48, color: Colors.grey),
                          const SizedBox(height: 8),
                          Text(
                            isArabic ? 'لا توجد منتجات مطابقة للبحث' : 'No products found',
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : catalogController.selectedCategory == 'All' && catalogController.searchQuery.isEmpty
                      ? _buildGroupedCategoryList(context, filtered, isArabic)
                      : _buildFlatGrid(context, filtered),
            ),
          ],
        );
      },
    );
  }

  // Build Products Grouped Under Category Headers (as a category)
  Widget _buildGroupedCategoryList(BuildContext context, List<Product> products, bool isArabic) {
    final categories = ['Fresh Food', 'Beverages', 'Food Cupboard', 'Frozen Food', 'Fruits & Vegetables'];
    final categoryIcons = {
      'Fresh Food': '🥬',
      'Beverages': '🧃',
      'Food Cupboard': '🍚',
      'Frozen Food': '❄️',
      'Fruits & Vegetables': '🍎'
    };
    final categoryNamesAr = {
      'Fresh Food': 'أطعمة طازجة (Fresh Food)',
      'Beverages': 'مشروبات وعصائر (Beverages)',
      'Food Cupboard': 'دولاب الأغذية والبقوليات والأرز (Food Cupboard)',
      'Frozen Food': 'أطعمة مجمدة (Frozen Food)',
      'Fruits & Vegetables': 'خضار وفواكه طازجة (Fruits & Vegetables)'
    };

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: categories.length,
      itemBuilder: (context, idx) {
        final cat = categories[idx];
        final catProducts = products.where((p) => p.category == cat).toList();
        if (catProducts.isEmpty) return const SizedBox.shrink();

        final icon = categoryIcons[cat] ?? '📦';
        final title = isArabic ? (categoryNamesAr[cat] ?? cat) : '$icon $cat (${catProducts.length})';

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category Section Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                    ),
                    child: Text(
                      '${catProducts.length}',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                    ),
                  ),
                ],
              ),
            ),

            // Horizontal Scroll of Category Cards
            SizedBox(
              height: 290,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: catProducts.length,
                itemBuilder: (ctx, i) {
                  final p = catProducts[i];
                  return Container(
                    width: 175,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    child: ProductCard(
                      product: p,
                      onAddToCart: () => onAddToCart(p),
                      isArabic: languageController.isArabic,
                      languageController: languageController,
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // Flat Grid when filtered by category or search term
  Widget _buildFlatGrid(BuildContext context, List<Product> products) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.58,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: products.length,
      itemBuilder: (context, idx) {
        return ProductCard(
          product: products[idx],
          onAddToCart: () => onAddToCart(products[idx]),
          isArabic: languageController.isArabic,
          languageController: languageController,
        );
      },
    );
  }
}
