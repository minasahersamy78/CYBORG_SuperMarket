import 'package:flutter/material.dart';
import '../controllers/theme_controller.dart';
import '../controllers/language_controller.dart';
import '../controllers/catalog_controller.dart';
import '../controllers/cart_controller.dart';
import '../controllers/orders_controller.dart';
import '../controllers/chatbot_controller.dart';
import '../models/product.dart';
import 'tabs/shop_tab.dart';
import 'tabs/ai_voice_tab.dart';
import 'tabs/support_tab.dart';
import 'tabs/order_history_tab.dart';
import 'tabs/cart_tab.dart';

class HomeView extends StatefulWidget {
  final ThemeController themeController;
  final LanguageController languageController;
  final CatalogController catalogController;
  final CartController cartController;
  final OrdersController ordersController;
  final ChatbotController chatbotController;

  const HomeView({
    super.key,
    required this.themeController,
    required this.languageController,
    required this.catalogController,
    required this.cartController,
    required this.ordersController,
    required this.chatbotController,
  });

  @override
  State<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<HomeView> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    widget.catalogController.loadProducts();
    widget.ordersController.fetchOrders();
  }

  void _onAddToCart(Product product) {
    widget.cartController.addToCart(product);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${product.name} added to cart'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF10B981),
      ),
    );
  }

  // Persistent Cart Modal accessible from ANY screen
  void _openCartModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Directionality(
        textDirection: widget.languageController.textDirection,
        child: Container(
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: const Color(0xFF141C2E)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.12),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shopping_cart_outlined, color: Color(0xFF10B981)),
                    const SizedBox(width: 8),
                    Text(
                      widget.languageController.isArabic ? 'سلة المشتريات (Shopping Cart)' : 'Shopping Cart',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: CartTab(
                  cartController: widget.cartController,
                  languageController: widget.languageController,
                  catalogController: widget.catalogController,
                  onOrderPlaced: () {
                    Navigator.pop(context);
                    setState(() => _currentIndex = 3); // Switch to Orders tab
                    widget.ordersController.fetchOrders();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.languageController.tr;
    final isArabic = widget.languageController.isArabic;

    final pages = [
      // Tab 0: Home Shop with all products categorized + category filters + bilingual search
      ShopTab(
        catalogController: widget.catalogController,
        languageController: widget.languageController,
        onAddToCart: _onAddToCart,
      ),

      // Tab 1: Dedicated AI Voice & Planner page
      AiVoiceTab(
        chatbotController: widget.chatbotController,
        languageController: widget.languageController,
        onAddToCart: _onAddToCart,
      ),

      // Tab 2: Dedicated Complaints & Compliments page
      SupportTab(
        chatbotController: widget.chatbotController,
        languageController: widget.languageController,
      ),

      // Tab 3: Orders History with live cancellation & stock restoral
      OrderHistoryTab(
        ordersController: widget.ordersController,
        languageController: widget.languageController,
        catalogController: widget.catalogController,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.storefront, color: Color(0xFF10B981), size: 20),
            ),
            const SizedBox(width: 8),
            Text(
              tr('app_title'),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: -0.5),
            ),
          ],
        ),
        actions: [
          // Theme Toggle Button (Light / Dark)
          IconButton(
            tooltip: 'Toggle Dark/Light Mode',
            icon: Icon(
              widget.themeController.isDark ? Icons.light_mode : Icons.dark_mode,
              color: const Color(0xFF10B981),
            ),
            onPressed: widget.themeController.toggleTheme,
          ),

          // Bilingual Toggle Button (EN / AR)
          Tooltip(
            message: 'Switch Language (AR/EN)',
            child: TextButton(
              onPressed: () {
                widget.languageController.toggleLanguage();
                widget.chatbotController.initWelcome(widget.languageController.isArabic);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  widget.languageController.isArabic ? 'English' : 'عربي',
                  style: const TextStyle(
                    color: Color(0xFF10B981),
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ),

          // Persistent Cart Icon with Live Count Badge across ALL views
          AnimatedBuilder(
            animation: widget.cartController,
            builder: (context, _) => Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.shopping_cart_outlined, color: Color(0xFF06B6D4)),
                  tooltip: 'Shopping Cart',
                  onPressed: _openCartModal,
                ),
                if (widget.cartController.itemCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                      child: Text(
                        '${widget.cartController.itemCount}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),

      // Body View
      body: pages[_currentIndex],

      // Persistent Floating Cart Button across all tabs
      floatingActionButton: AnimatedBuilder(
        animation: widget.cartController,
        builder: (context, _) => FloatingActionButton.extended(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          elevation: 6,
          icon: const Icon(Icons.shopping_cart),
          label: Text(
            isArabic ? 'السلة (${widget.cartController.itemCount})' : 'Cart (${widget.cartController.itemCount})',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
          onPressed: _openCartModal,
        ),
      ),

      // Bottom Navigation Bar (4 Dedicated Core Tabs)
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.storefront_outlined),
            selectedIcon: const Icon(Icons.storefront, color: Color(0xFF10B981)),
            label: isArabic ? 'المتجر' : 'Shop',
          ),
          NavigationDestination(
            icon: const Icon(Icons.smart_toy_outlined),
            selectedIcon: const Icon(Icons.smart_toy, color: Color(0xFF10B981)),
            label: isArabic ? 'الذكاء الاصطناعي' : 'AI Voice',
          ),
          NavigationDestination(
            icon: const Icon(Icons.support_agent_outlined),
            selectedIcon: const Icon(Icons.support_agent, color: Color(0xFFF59E0B)),
            label: isArabic ? 'الشكاوى والدعم' : 'Support',
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long, color: Color(0xFF10B981)),
            label: isArabic ? 'طلباتي' : 'Orders',
          ),
        ],
      ),
    );
  }
}
