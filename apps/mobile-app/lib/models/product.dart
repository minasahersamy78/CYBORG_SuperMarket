class Product {
  final int id;
  final String sku;
  final String name;
  final String nameAr;
  final String category;
  final double price;
  final String barcode;
  final String imageUrl;
  final int stock;

  Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.nameAr,
    required this.category,
    required this.price,
    required this.barcode,
    required this.imageUrl,
    required this.stock,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      sku: json['sku']?.toString() ?? json['barcode']?.toString() ?? '',
      name: json['name_en']?.toString() ?? json['name']?.toString() ?? 'Product',
      nameAr: json['name_ar']?.toString() ?? '',
      category: json['category_name_en']?.toString() ?? json['category']?.toString() ?? 'General',
      price: (json['price'] != null) ? (json['price'] as num).toDouble() : 0.0,
      barcode: json['barcode']?.toString() ?? '6221234567890',
      imageUrl: (json['image_url'] != null && json['image_url'].toString().isNotEmpty)
          ? json['image_url'].toString()
          : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
      stock: json['stock'] is int ? json['stock'] : int.tryParse(json['stock']?.toString() ?? '50') ?? 50,
    );
  }
}
