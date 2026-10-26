class OrderModel {
  final String id;
  final String customerName;
  final String status;
  final double totalAmount;
  final String paymentMethod;
  final String paymentStatus;
  final String deliveryAddress;
  final String createdAt;
  final List<dynamic> items;

  OrderModel({
    required this.id,
    required this.customerName,
    required this.status,
    required this.totalAmount,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.deliveryAddress,
    required this.createdAt,
    this.items = const [],
  });

  bool get isCancellable {
    final s = status.toUpperCase();
    return s == 'CONFIRMED' || s == 'PENDING' || s == 'PREPARING' || s == 'READY';
  }

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json['id']?.toString() ?? json['order_id']?.toString() ?? 'ORD-000',
      customerName: json['customer_name']?.toString() ?? 'Customer',
      status: json['status']?.toString().toUpperCase() ?? 'PENDING',
      totalAmount: (json['total_amount'] != null)
          ? (json['total_amount'] as num).toDouble()
          : (json['total'] != null) ? (json['total'] as num).toDouble() : 0.0,
      paymentMethod: json['payment_method']?.toString() ?? 'CASH',
      paymentStatus: json['payment_status']?.toString() ?? 'PENDING',
      deliveryAddress: json['delivery_address']?.toString() ?? 'Store Pickup',
      createdAt: json['created_at']?.toString() ?? 'Recently',
      items: json['items'] is List ? json['items'] as List : [],
    );
  }
}
