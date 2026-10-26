import 'package:flutter/material.dart';
import '../../controllers/orders_controller.dart';
import '../../controllers/language_controller.dart';
import '../../controllers/catalog_controller.dart';

class OrderHistoryTab extends StatelessWidget {
  final OrdersController ordersController;
  final LanguageController languageController;
  final CatalogController catalogController;

  const OrderHistoryTab({
    super.key,
    required this.ordersController,
    required this.languageController,
    required this.catalogController,
  });

  @override
  Widget build(BuildContext context) {
    final tr = languageController.tr;

    return AnimatedBuilder(
      animation: ordersController,
      builder: (context, _) {
        if (ordersController.isLoading) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
        }

        if (ordersController.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text(ordersController.error!),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: ordersController.fetchOrders,
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        if (ordersController.orders.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey),
                const SizedBox(height: 14),
                Text(tr('order_history') + ' is empty', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: ordersController.fetchOrders,
          color: const Color(0xFF10B981),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: ordersController.orders.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, idx) {
              final ord = ordersController.orders[idx];
              final isCancelled = ord.status == 'CANCELLED';
              final isDelivered = ord.status == 'DELIVERED';
              final isRefunded = ord.status == 'REFUNDED';

              Color statusColor = const Color(0xFF10B981);
              if (isCancelled || isRefunded) statusColor = Colors.red;
              else if (ord.status == 'PENDING') statusColor = Colors.amber;

              return Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: isCancelled ? Colors.red.withOpacity(0.3) : Colors.transparent,
                    width: 1,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Order Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 16,
                                backgroundColor: statusColor.withOpacity(0.15),
                                child: Icon(
                                  isCancelled ? Icons.cancel_outlined : Icons.shopping_bag_outlined,
                                  size: 18,
                                  color: statusColor,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Order #${ord.id}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              ord.status,
                              style: TextStyle(
                                color: statusColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 10),

                      // Details
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Date: ${ord.createdAt.split('T').first}',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          Text(
                            '${ord.totalAmount.toStringAsFixed(2)} EGP',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                              color: Color(0xFF22C55E),
                            ),
                          ),
                        ],
                      ),

                      // Cancel Order Button for Cancellable Orders
                      if (ord.isCancellable) ...[
                        const SizedBox(height: 12),
                        const Divider(height: 1),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _confirmCancelOrder(context, ord.id),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.red,
                                side: const BorderSide(color: Colors.red),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: const Icon(Icons.cancel, size: 16),
                              label: Text(
                                tr('cancel_order'),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  void _confirmCancelOrder(BuildContext context, String orderId) {
    final tr = languageController.tr;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('cancel_confirm_title')),
        content: Text(tr('cancel_confirm_body')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(tr('dismiss')),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final res = await ordersController.cancelOrder(orderId);
              if (res['success'] == true) {
                // Refresh stock in catalog controller
                catalogController.loadProducts();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(tr('cancel_success')),
                    backgroundColor: const Color(0xFF10B981),
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
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text(tr('confirm'), style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
