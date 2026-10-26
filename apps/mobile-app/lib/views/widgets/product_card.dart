import 'package:flutter/material.dart';
import '../../models/product.dart';
import 'barcode_sticker.dart';

class ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback onAddToCart;
  final bool isArabic;
  final dynamic languageController;

  const ProductCard({
    super.key,
    required this.product,
    required this.onAddToCart,
    this.isArabic = false,
    this.languageController,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveArabic = isArabic || (languageController != null && languageController.isArabic == true);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? const Color(0xFF22304A) : const Color(0xFFE2E8F0),
          width: 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Product Image with Stock Tag
          Expanded(
            flex: 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  product.imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    child: const Icon(Icons.shopping_basket, size: 36, color: Color(0xFF10B981)),
                  ),
                ),
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: product.stock > 10 ? const Color(0xFF0F766E).withOpacity(0.85) : Colors.amber.shade800,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${product.stock} in stock',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Product Details
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Bilingual Name
                Text(
                  effectiveArabic && product.nameAr.isNotEmpty ? product.nameAr : product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                if (product.nameAr.isNotEmpty && !effectiveArabic)
                  Text(
                    product.nameAr,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                  ),

                const SizedBox(height: 4),

                // Bright Emerald Green Price (features/data-1 format #22C55E)
                Text(
                  '${product.price.toStringAsFixed(2)} EGP',
                  style: const TextStyle(
                    color: Color(0xFF22C55E),
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                ),

                const SizedBox(height: 6),

                // Barcode Sticker (features/data-1 format)
                BarcodeSticker(barcode: product.barcode, height: 20),

                const SizedBox(height: 8),

                // Add to Cart Button
                SizedBox(
                  width: double.infinity,
                  height: 32,
                  child: ElevatedButton.icon(
                    onPressed: onAddToCart,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    icon: const Icon(Icons.add_shopping_cart, size: 14),
                    label: Text(
                      isArabic ? 'أضف للسلة' : 'Add to Cart',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
