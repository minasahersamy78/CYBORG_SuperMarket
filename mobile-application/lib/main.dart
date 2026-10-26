import 'package:flutter/material.dart';
import 'controllers/theme_controller.dart';
import 'controllers/language_controller.dart';
import 'controllers/catalog_controller.dart';
import 'controllers/cart_controller.dart';
import 'controllers/orders_controller.dart';
import 'controllers/chatbot_controller.dart';
import 'views/home_view.dart';

void main() {
  runApp(const CyborgSupermarketApp());
}

class CyborgSupermarketApp extends StatefulWidget {
  const CyborgSupermarketApp({super.key});

  @override
  State<CyborgSupermarketApp> createState() => _CyborgSupermarketAppState();
}

class _CyborgSupermarketAppState extends State<CyborgSupermarketApp> {
  late final ThemeController _themeController;
  late final LanguageController _languageController;
  late final CatalogController _catalogController;
  late final CartController _cartController;
  late final OrdersController _ordersController;
  late final ChatbotController _chatbotController;

  @override
  void initState() {
    super.initState();
    _themeController = ThemeController();
    _languageController = LanguageController();
    _catalogController = CatalogController();
    _cartController = CartController();
    _ordersController = OrdersController();
    _chatbotController = ChatbotController();

    _themeController.addListener(_onStateChange);
    _languageController.addListener(_onStateChange);
  }

  void _onStateChange() {
    setState(() {});
  }

  @override
  void dispose() {
    _themeController.removeListener(_onStateChange);
    _languageController.removeListener(_onStateChange);
    _themeController.dispose();
    _languageController.dispose();
    _catalogController.dispose();
    _cartController.dispose();
    _ordersController.dispose();
    _chatbotController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cyborg Supermarket Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeController.lightTheme,
      darkTheme: ThemeController.darkTheme,
      themeMode: _themeController.themeMode,
      locale: _languageController.locale,
      builder: (context, child) {
        return Directionality(
          textDirection: _languageController.textDirection,
          child: child ?? const SizedBox(),
        );
      },
      home: HomeView(
        themeController: _themeController,
        languageController: _languageController,
        catalogController: _catalogController,
        cartController: _cartController,
        ordersController: _ordersController,
        chatbotController: _chatbotController,
      ),
    );
  }
}
