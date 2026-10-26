import 'package:flutter/material.dart';
import '../../controllers/chatbot_controller.dart';
import '../../controllers/language_controller.dart';

class SupportTab extends StatefulWidget {
  final ChatbotController chatbotController;
  final LanguageController languageController;

  const SupportTab({
    super.key,
    required this.chatbotController,
    required this.languageController,
  });

  @override
  State<SupportTab> createState() => _SupportTabState();
}

class _SupportTabState extends State<SupportTab> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Complaint Form
  final TextEditingController _complaintNameCtrl = TextEditingController(text: 'Customer');
  final TextEditingController _complaintOrderIdCtrl = TextEditingController();
  final TextEditingController _complaintDescCtrl = TextEditingController();
  String _selectedCategory = 'Product Quality';

  final List<String> _complaintCategories = [
    'Product Quality',
    'Delivery & Logistics',
    'Pricing & Billing',
    'Customer Service & Staff',
    'General Inquiry',
  ];

  // Feedback Form
  final TextEditingController _feedbackNameCtrl = TextEditingController(text: 'Customer');
  final TextEditingController _feedbackMsgCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _complaintNameCtrl.dispose();
    _complaintOrderIdCtrl.dispose();
    _complaintDescCtrl.dispose();
    _feedbackNameCtrl.dispose();
    _feedbackMsgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isArabic = widget.languageController.isArabic;

    return Column(
      children: [
        // Top Banner Notice
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF0D121F),
            border: Border(bottom: BorderSide(color: const Color(0xFF141C2E))),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.support_agent, color: Color(0xFFF59E0B), size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'خدمة العملاء والشكاوى والاقتراحات' : 'Customer Support & Complaints',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                    ),
                    Text(
                      'Direct Line to Management: cyborgcoding1@gmail.com',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Sub Tabs: Complaints vs Compliments
        Container(
          color: const Color(0xFF07090E),
          child: TabBar(
            controller: _tabController,
            indicatorColor: const Color(0xFF10B981),
            indicatorWeight: 3,
            labelColor: const Color(0xFF10B981),
            unselectedLabelColor: Colors.grey,
            labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            tabs: [
              Tab(
                icon: const Icon(Icons.report_problem_outlined, size: 18),
                text: isArabic ? 'تقديم شكوى رسمية' : 'Formal Complaint',
              ),
              Tab(
                icon: const Icon(Icons.favorite_outline, size: 18),
                text: isArabic ? 'شكر واقتراحات' : 'Compliments & Feedback',
              ),
            ],
          ),
        ),

        // Tab Views
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildComplaintView(context, isArabic),
              _buildFeedbackView(context, isArabic),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildComplaintView(BuildContext context, bool isArabic) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isArabic ? 'تصنيف الشكوى (Category)' : 'Complaint Category',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF0D121F),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF141C2E)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedCategory,
                isExpanded: true,
                dropdownColor: const Color(0xFF0D121F),
                items: _complaintCategories.map((c) {
                  String display = c;
                  if (c == 'Product Quality') display = isArabic ? 'جودة المنتجات (Product Quality)' : c;
                  else if (c == 'Delivery & Logistics') display = isArabic ? 'التوصيل والتأخير (Delivery)' : c;
                  else if (c == 'Pricing & Billing') display = isArabic ? 'الأسعار والفواتير (Pricing)' : c;
                  else if (c == 'Customer Service & Staff') display = isArabic ? 'خدمة العملاء (Customer Service)' : c;
                  else if (c == 'General Inquiry') display = isArabic ? 'استفسار عام (General Inquiry)' : c;

                  return DropdownMenuItem(value: c, child: Text(display, style: const TextStyle(fontSize: 12, color: Colors.white)));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedCategory = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 12),

          Text(
            isArabic ? 'اسم العميل (Name)' : 'Customer Name',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _complaintNameCtrl,
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: const Color(0xFF0D121F),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF141C2E))),
            ),
          ),
          const SizedBox(height: 12),

          Text(
            isArabic ? 'رقم الطلب (Order ID - اختياري)' : 'Order ID (Optional)',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _complaintOrderIdCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: 'e.g. 15',
              isDense: true,
              filled: true,
              fillColor: const Color(0xFF0D121F),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF141C2E))),
            ),
          ),
          const SizedBox(height: 12),

          Text(
            isArabic ? 'تفاصيل الشكوى (Details)' : 'Complaint Details',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _complaintDescCtrl,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: isArabic ? 'اشرح المشكلة بالتفصيل...' : 'Describe defect, delivery delay, or billing issue...',
              filled: true,
              fillColor: const Color(0xFF0D121F),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF141C2E))),
            ),
          ),
          const SizedBox(height: 18),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.send_rounded, size: 18),
              label: Text(
                isArabic ? 'إرسال الشكوى وتوليد رقم التذكرة' : 'Submit Formal Complaint',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                final desc = _complaintDescCtrl.text.trim();
                if (desc.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(isArabic ? 'يرجى كتابة تفاصيل الشكوى' : 'Please describe your complaint.')),
                  );
                  return;
                }
                final res = await widget.chatbotController.submitComplaint(
                  customerName: _complaintNameCtrl.text.trim(),
                  orderId: _complaintOrderIdCtrl.text.trim().isNotEmpty ? _complaintOrderIdCtrl.text.trim() : null,
                  category: _selectedCategory,
                  description: desc,
                );
                _complaintDescCtrl.clear();
                showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    backgroundColor: const Color(0xFF0D121F),
                    title: Row(
                      children: const [
                        Icon(Icons.check_circle, color: Color(0xFF10B981)),
                        SizedBox(width: 8),
                        Text('Complaint Filed', style: TextStyle(color: Colors.white, fontSize: 16)),
                      ],
                    ),
                    content: Text(
                      'Ticket #${res['ticket_id']} has been registered.\nDispatched to management at cyborgcoding1@gmail.com.',
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK', style: TextStyle(color: Color(0xFF10B981)))),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeedbackView(BuildContext context, bool isArabic) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isArabic ? 'اسمك (Your Name)' : 'Your Name',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _feedbackNameCtrl,
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: const Color(0xFF0D121F),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF141C2E))),
            ),
          ),
          const SizedBox(height: 12),

          Text(
            isArabic ? 'رسالة الشكر أو الاقتراح (Message)' : 'Compliment or Suggestion',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _feedbackMsgCtrl,
            maxLines: 5,
            decoration: InputDecoration(
              hintText: isArabic ? 'اكتب رسالتك أو اقتراحك للإدارة...' : 'Share your praise or shopping suggestions for management...',
              filled: true,
              fillColor: const Color(0xFF0D121F),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF141C2E))),
            ),
          ),
          const SizedBox(height: 18),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.favorite, size: 18),
              label: Text(
                isArabic ? 'إرسال للإدارة (cyborgcoding1@gmail.com)' : 'Send to Management Inbox',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                final msg = _feedbackMsgCtrl.text.trim();
                if (msg.isEmpty) return;
                await widget.chatbotController.sendComplimentOrFeedback(
                  customerName: _feedbackNameCtrl.text.trim(),
                  message: msg,
                );
                _feedbackMsgCtrl.clear();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(isArabic ? 'شكراً لك! تم إرسال رسالتك للإدارة.' : 'Thank you! Delivered to management.'),
                    backgroundColor: const Color(0xFF10B981),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
