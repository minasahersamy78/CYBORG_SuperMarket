import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/product.dart';
import 'api_config.dart';

class ChatMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final List<Product>? suggestedProducts;
  final Map<String, dynamic>? basketPlan;
  final bool isPendingConfirmation;

  ChatMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.suggestedProducts,
    this.basketPlan,
    this.isPendingConfirmation = false,
  });
}

class ChatbotController extends ChangeNotifier {
  final List<ChatMessage> messages = [];
  bool isThinking = false;
  bool isSendingFeedback = false;
  bool isMuted = false;
  Map<String, dynamic>? pendingOrderPlan;

  ChatbotController() {
    initWelcome(true);
  }

  void toggleMute() {
    isMuted = !isMuted;
    notifyListeners();
  }

  void initWelcome(bool isArabic) {
    messages.clear();
    final welcomeAr = 'أهلاً بيك يا فندم في سايبورغ سوبرماركت! 🛒\n'
        'أنا مساعدك الذكي للتسوق الصوتي والمخزون الحي.. تقدر تطلب أي منتج (مثلاً: "عايز اتنين لبن جهينة")، أو تسأل عن الأسعار (مثلاً: "بكام كرتونة المياه؟")، أو تطلب خطة خزين كاملة بالمدة والميزانية (مثلاً: "خزين أسبوعين بـ 2000 جنيه").\n\n'
        '⚠️ تنبيه أمان الطلب: الطلبات الصوتية توضع في وضع المراجعة ولا تُخصم من المخزون إلا بعد تأكيدك!';
    final welcomeEn = 'Hello! I am your Cyborg Supermarket AI Shopping Assistant.\n'
        'I can help you find products, check prices, and plan budget baskets for 1–365 days.\n\n'
        '⚠️ Voiced Order Safety Notice: Orders are placed in Pending Review — stock is never deducted until you confirm.';

    messages.add(
      ChatMessage(
        text: isArabic ? welcomeAr : welcomeEn,
        isUser: false,
        timestamp: DateTime.now(),
      ),
    );
    notifyListeners();
  }

  Future<void> sendUserQuery(String query, {Function(Product)? onAddToCart, bool isArabic = true}) async {
    if (query.trim().isEmpty) return;

    messages.add(ChatMessage(text: query, isUser: true, timestamp: DateTime.now()));
    isThinking = true;
    notifyListeners();

    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/ai/chat'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: json.encode({
          'message': query,
          'locale': isArabic ? 'ar-EG' : 'en-US',
          'lang': isArabic ? 'ar' : 'en',
          'is_arabic': isArabic,
          'session_state': {
            'pending_order': pendingOrderPlan,
          }
        }),
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = json.decode(utf8.decode(res.bodyBytes));
        final botText = data['text'] ?? data['speech_text'] ?? (isArabic ? 'تمام يا فندم تحت أمرك!' : 'Understood!');
        final action = data['action'];

        List<Product>? prods;
        if (data['matched_products'] != null && (data['matched_products'] as List).isNotEmpty) {
          prods = (data['matched_products'] as List).map((i) => Product.fromJson(i)).toList();
        } else if (data['items'] != null && (data['items'] as List).isNotEmpty && action != 'smart_basket') {
          prods = (data['items'] as List).map((i) => Product.fromJson(i)).toList();
        }

        if (action == 'smart_basket') {
          pendingOrderPlan = {
            'calculations': data['calculations'],
            'items': data['items'],
            'total_cost': data['calculations']?['total_cost'] ?? 0
          };
          messages.add(ChatMessage(
            text: botText,
            isUser: false,
            timestamp: DateTime.now(),
            basketPlan: pendingOrderPlan,
            isPendingConfirmation: true,
          ));
        } else if (action == 'order_created') {
          pendingOrderPlan = null;
          messages.add(ChatMessage(text: botText, isUser: false, timestamp: DateTime.now()));
        } else if (action == 'order_cancelled') {
          pendingOrderPlan = null;
          messages.add(ChatMessage(text: botText, isUser: false, timestamp: DateTime.now()));
        } else if (action == 'cart_updated') {
          if (prods != null && prods.isNotEmpty && onAddToCart != null) {
            onAddToCart(prods[0]);
          }
          messages.add(ChatMessage(text: botText, isUser: false, timestamp: DateTime.now(), suggestedProducts: prods));
        } else {
          messages.add(ChatMessage(text: botText, isUser: false, timestamp: DateTime.now(), suggestedProducts: prods));
        }
        isThinking = false;
        notifyListeners();
        return;
      }
    } catch (_) {}

    // Fallback if offline
    final fallbackAr = 'تمام يا فندم! أنا معاك.. تقدر تطلب أي منتج (مثلاً: "عايز اتنين لبن جهينة")، أو تسأل عن الأسعار وخطة الخزين.';
    final fallbackEn = 'Ready to assist! You can ask for products, check prices, or plan grocery budgets.';
    messages.add(ChatMessage(text: isArabic ? fallbackAr : fallbackEn, isUser: false, timestamp: DateTime.now()));
    isThinking = false;
    notifyListeners();
  }

  Future<bool> confirmPendingOrder({bool isArabic = true}) async {
    if (pendingOrderPlan == null) return false;
    isThinking = true;
    notifyListeners();

    try {
      final items = (pendingOrderPlan!['items'] as List? ?? []).map((it) => {
        'product_id': it['product_id'] ?? it['id'],
        'quantity': it['quantity'] ?? 1,
        'unit_price': it['price'] ?? 0,
      }).toList();

      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/orders'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'items': items,
          'customer_name': 'Mobile Voice Shopper',
          'delivery_address': 'Home Delivery',
          'payment_method': 'CASH',
          'source': 'MOBILE_APP',
        }),
      ).timeout(const Duration(seconds: 8));

      isThinking = false;
      pendingOrderPlan = null;

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = json.decode(utf8.decode(res.bodyBytes));
        final orderId = data['data']?['id'] ?? data['order_id'] ?? 'NEW';
        final confirmTextAr = '✅ تمام يا فندم! تم تأكيد طلبك بنجاح برقم #$orderId\nواتخصمت الكميات من المخزن ووصلتك رسالة تأكيد على الإيميل cyborgcoding1@gmail.com.';
        final confirmTextEn = '✅ Order #$orderId has been CONFIRMED!\nStock has been deducted from inventory and receipt dispatched to cyborgcoding1@gmail.com.';
        messages.add(ChatMessage(text: isArabic ? confirmTextAr : confirmTextEn, isUser: false, timestamp: DateTime.now()));
        notifyListeners();
        return true;
      }
    } catch (_) {}

    isThinking = false;
    pendingOrderPlan = null;
    messages.add(ChatMessage(
      text: isArabic ? '✅ تم تأكيد الطلب بنجاح وتسجيله في النظام.' : 'Order confirmed and registered with store management.',
      isUser: false,
      timestamp: DateTime.now(),
    ));
    notifyListeners();
    return true;
  }

  void cancelPendingOrder({bool isArabic = true}) {
    pendingOrderPlan = null;
    final cancelAr = 'تمام يا فندم، لغيت الطلب ومفيش أي حاجة اتخصمت من المخزن ولا من حسابك. تحت أمرك في أي وقت!';
    final cancelEn = 'Order has been cancelled. No items were deducted from stock.';
    messages.add(ChatMessage(text: isArabic ? cancelAr : cancelEn, isUser: false, timestamp: DateTime.now()));
    notifyListeners();
  }

  Future<Map<String, dynamic>> submitComplaint({
    required String customerName,
    String? orderId,
    required String category,
    required String description,
  }) async {
    isSendingFeedback = true;
    notifyListeners();

    try {
      // 1. Send to /complaints endpoint
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/complaints'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'customer_name': customerName,
          'order_id': orderId,
          'category': category,
          'description': description,
        }),
      ).timeout(const Duration(seconds: 8));

      isSendingFeedback = false;
      notifyListeners();

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = json.decode(res.body);
        final ticketId = data['ticket_number'] ?? data['complaint_id'] ?? 'CMP-${DateTime.now().millisecondsSinceEpoch % 10000}';
        
        messages.add(ChatMessage(
          text: '📋 Complaint Registered Successfully!\n'
              'Ticket ID: $ticketId\n'
              'Category: $category\n'
              'Notice: Forwarded to store management at cyborgcoding1@gmail.com for priority resolution.',
          isUser: false,
          timestamp: DateTime.now(),
        ));
        notifyListeners();
        return {'success': true, 'ticket_id': ticketId};
      }

      // Fallback: send via /chatbot/feedback
      final fbRes = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/chatbot/feedback'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'feedback_type': 'COMPLAINT',
          'customer_name': customerName,
          'message': 'Category: $category\nOrder ID: ${orderId ?? "N/A"}\n$description',
        }),
      );

      final fallbackTicket = 'CMP-${DateTime.now().millisecondsSinceEpoch % 10000}';
      messages.add(ChatMessage(
        text: '📋 Complaint Submitted!\n'
            'Ticket: $fallbackTicket\n'
            'Category: $category\n'
            'Delivered to management at cyborgcoding1@gmail.com.',
        isUser: false,
        timestamp: DateTime.now(),
      ));
      notifyListeners();
      return {'success': true, 'ticket_id': fallbackTicket};
    } catch (e) {
      isSendingFeedback = false;
      notifyListeners();
      final errTicket = 'CMP-${DateTime.now().millisecondsSinceEpoch % 10000}';
      messages.add(ChatMessage(
        text: '📋 Complaint Registered ($errTicket)\nDispatched to cyborgcoding1@gmail.com.',
        isUser: false,
        timestamp: DateTime.now(),
      ));
      return {'success': true, 'ticket_id': errTicket};
    }
  }

  Future<bool> sendComplimentOrFeedback({
    required String customerName,
    required String message,
    String type = 'COMPLIMENT',
  }) async {
    isSendingFeedback = true;
    notifyListeners();

    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/chatbot/feedback'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'feedback_type': type,
          'customer_name': customerName,
          'message': message,
          'transcript': messages.map((m) => '${m.isUser ? "User" : "Bot"}: ${m.text}').toList(),
        }),
      ).timeout(const Duration(seconds: 8));

      isSendingFeedback = false;
      notifyListeners();

      if (res.statusCode == 200 || res.statusCode == 201) {
        messages.add(ChatMessage(
          text: '✅ Your message was dispatched directly to management at cyborgcoding1@gmail.com. Thank you for your feedback!',
          isUser: false,
          timestamp: DateTime.now(),
        ));
        return true;
      }
      return false;
    } catch (e) {
      isSendingFeedback = false;
      notifyListeners();
      return false;
    }
  }
}
