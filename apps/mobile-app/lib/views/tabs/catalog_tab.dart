import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../controllers/catalog_controller.dart';
import '../../controllers/language_controller.dart';
import '../widgets/product_card.dart';

class CatalogTab extends StatelessWidget {
  final CatalogController catalogController;
  final LanguageController languageController;
  final Function(Product) onAddToCart;

  const CatalogTab({
    super.key,
    required this.catalogController,
    required this.languageController,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
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

        final products = catalogController.filteredProducts;

        return Column(
          children: [
            // Search Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                onChanged: catalogController.search,
                decoration: InputDecoration(
                  hintText: languageController.tr('search_hint'),
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF10B981)),
                  filled: true,
                  isDense: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),

            // Category Chips
            SizedBox(
              height: 44,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: catalogController.categories.length,
                itemBuilder: (context, idx) {
                  final cat = catalogController.categories[idx];
                  final isSelected = cat == catalogController.selectedCategory;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(cat == 'All' ? languageController.tr('all') : cat),
                      selected: isSelected,
                      selectedColor: const Color(0xFF10B981),
                      onSelected: (_) => catalogController.selectCategory(cat),
                    ),
                  );
                },
              ),
            ),

            // Products Grid
            Expanded(
              child: products.isEmpty
                  ? Center(child: Text(languageController.tr('all') + ' empty'))
                  : GridView.builder(
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
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }
}
