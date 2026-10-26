import 'package:flutter/material.dart';

class LanguageController extends ChangeNotifier {
  Locale _locale = const Locale('en');

  Locale get locale => _locale;
  bool get isArabic => _locale.languageCode == 'ar';
  TextDirection get textDirection => isArabic ? TextDirection.rtl : TextDirection.ltr;

  void toggleLanguage() {
    _locale = isArabic ? const Locale('en') : const Locale('ar');
    notifyListeners();
  }

  static final Map<String, Map<String, String>> _translations = {
    'en': {
      'app_title': 'Cyborg Supermarket',
      'shop': 'Shop',
      'cart': 'Cart',
      'pantry': 'Pantry',
      'orders': 'Orders',
      'search_hint': 'Search groceries, dairy, drinks...',
      'categories': 'Categories',
      'all': 'All',
      'add_to_cart': 'Add to Cart',
      'cart_empty': 'Your cart is empty',
      'subtotal': 'Subtotal',
      'vat': 'Egyptian VAT (14%)',
      'total': 'Total',
      'checkout': 'Confirm Order',
      'cancel_order': 'Cancel Order',
      'cancel_confirm_title': 'Cancel Order?',
      'cancel_confirm_body': 'Are you sure you want to cancel this order? Items will be returned to supermarket inventory.',
      'cancel_success': 'Order cancelled successfully and stock restored.',
      'confirm': 'Confirm',
      'dismiss': 'Dismiss',
      'chatbot_title': 'Cyborg AI Assistant',
      'chatbot_sub': 'Voice & Smart Shopping Bot',
      'ask_anything': 'Ask for groceries, duration planning...',
      'compliment_btn': 'Send Compliment / Feedback',
      'compliment_sent': 'Thank you! Your feedback was sent to cyborgcoding1@gmail.com',
      'smart_basket': 'Smart Basket Planner',
      'duration_label': 'Duration (Days)',
      'budget_label': 'Budget (EGP)',
      'generate_basket': 'Generate Smart Basket',
      'stock_left': 'in stock',
      'order_history': 'My Orders',
      'status': 'Status',
      'feedback_prompt': 'Write your compliment or feedback for the supermarket management:',
      'send': 'Send to Management',
    },
    'ar': {
      'app_title': 'سوبر ماركت سايبورغ',
      'shop': 'المتجر',
      'cart': 'السلة',
      'pantry': 'المؤونة الذكية',
      'orders': 'طلباتي',
      'search_hint': 'ابحث عن المنتجات، الألبان، المشروبات...',
      'categories': 'الأقسام',
      'all': 'الكل',
      'add_to_cart': 'أضف للسلة',
      'cart_empty': 'سلة المشتريات فارغة',
      'subtotal': 'المجموع الفرعي',
      'vat': 'ضريبة القيمة المضافة المصرية (14%)',
      'total': 'الإجمالي',
      'checkout': 'تأكيد الطلب',
      'cancel_order': 'إلغاء الطلب',
      'cancel_confirm_title': 'تأكيد إلغاء الطلب؟',
      'cancel_confirm_body': 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ سيتم استرجاع المنتجات إلى مخزون السوبرماركت فوراً.',
      'cancel_success': 'تم إلغاء الطلب بنجاح واسترجاع الكميات للمخزون.',
      'confirm': 'تأكيد',
      'dismiss': 'تراجع',
      'chatbot_title': 'مساعد سايبورغ الذكي',
      'chatbot_sub': 'مساعد التسوق الصوتي والذكي',
      'ask_anything': 'اطلب أي منتج أو خطط لمشترياتك...',
      'compliment_btn': 'إرسال إشادة / ملاحظة للإدارة',
      'compliment_sent': 'شكراً لك! تم إرسال رسالتك إلى cyborgcoding1@gmail.com',
      'smart_basket': 'مخطط السلة والميزانية الذكي',
      'duration_label': 'المدة بالأيام',
      'budget_label': 'الميزانية (جنيه)',
      'generate_basket': 'توليد السلة الذكية',
      'stock_left': 'متاح في المخزون',
      'order_history': 'سجل طلباتي',
      'status': 'الحالة',
      'feedback_prompt': 'اكتب إشادتك أو ملاحظتك لإدارة السوبرماركت:',
      'send': 'إرسال للإدارة',
    }
  };

  String tr(String key) {
    return _translations[_locale.languageCode]?[key] ?? _translations['en']?[key] ?? key;
  }
}
