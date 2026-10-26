import 'package:flutter/material.dart';
import '../../controllers/cart_controller.dart';
import '../../controllers/language_controller.dart';
import '../../controllers/catalog_controller.dart';

class CartTab extends StatelessWidget {
  final CartController cartController;
  final LanguageController languageController;
  final CatalogController catalogController;
  final VoidCallback onOrderPlaced;

  const CartTab({
    super.key,
    required this.cartController,
    required this.languageController,
    required this.catalogController,
    required this.onOrderPlaced,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: cartController,
      builder: (context, _) {
        if (cartController.items.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.shopping_cart_outlined, size: 64, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  languageController.tr('cart_empty'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          );
        }

        return Column(
          children: [
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: cartController.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, idx) {
                  final item = cartController.items[idx];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        item.product.imageUrl,
                        width: 50,
                        height: 50,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(Icons.fastfood),
                      ),
                    ),
                    title: Text(
                      languageController.isArabic && item.product.nameAr.isNotEmpty
                          ? item.product.nameAr
                          : item.product.name,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      '${item.product.price.toStringAsFixed(2)} EGP',
                      style: const TextStyle(color: Color(0xFF22C55E), fontWeight: FontWeight.bold),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                          onPressed: () => cartController.updateQuantity(item.product.id, -1),
                        ),
                        Text(
                          '${item.quantity}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline, color: Color(0xFF10B981)),
                          onPressed: () => cartController.updateQuantity(item.product.id, 1),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Checkout Summary Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, -4)),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(languageController.tr('subtotal')),
                      Text('${cartController.subtotal.toStringAsFixed(2)} EGP'),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(languageController.tr('vat'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                      Text('${cartController.vat.toStringAsFixed(2)} EGP', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(languageController.tr('total'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                      Text(
                        '${cartController.total.toStringAsFixed(2)} EGP',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF22C55E)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: cartController.isCheckingOut
                          ? null
                          : () => _showCheckoutDialog(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: cartController.isCheckingOut
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Text(
                              languageController.tr('checkout'),
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  void _showCheckoutDialog(BuildContext context) {
    final nameCtrl = TextEditingController(text: 'Shopper');
    final addressCtrl = TextEditingController(text: 'Cairo, Egypt');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          left: 20,
          right: 20,
          top: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              languageController.tr('checkout'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Customer Name', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addressCtrl,
              decoration: const InputDecoration(labelText: 'Delivery Address', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                final res = await cartController.checkout(
                  customerName: nameCtrl.text,
                  deliveryAddress: addressCtrl.text,
                  paymentMethod: 'CASH',
                );

                if (res['success'] == true) {
                  // Refresh catalog to reflect decremented stock
                  catalogController.loadProducts();
                  onOrderPlaced();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Order placed successfully! Receipt sent to cyborgcoding1@gmail.com'),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: ${res['error']}'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Confirm & Place Order', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
