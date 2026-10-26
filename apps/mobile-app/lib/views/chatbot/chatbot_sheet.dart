import 'package:flutter/material.dart';
import '../../controllers/chatbot_controller.dart';
import '../../controllers/language_controller.dart';
import '../../models/product.dart';

class ChatbotSheet extends StatefulWidget {
  final ChatbotController chatbotController;
  final LanguageController languageController;
  final Function(Product) onAddToCart;

  const ChatbotSheet({
    super.key,
    required this.chatbotController,
    required this.languageController,
    required this.onAddToCart,
  });

  @override
  State<ChatbotSheet> createState() => _ChatbotSheetState();
}

class _ChatbotSheetState extends State<ChatbotSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _textCtrl = TextEditingController();
  final TextEditingController _feedbackCtrl = TextEditingController();
  final TextEditingController _nameCtrl = TextEditingController(text: 'Customer');

  // Complaint Form Controllers
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

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _textCtrl.dispose();
    _feedbackCtrl.dispose();
    _nameCtrl.dispose();
    _complaintNameCtrl.dispose();
    _complaintOrderIdCtrl.dispose();
    _complaintDescCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.languageController.tr;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF07090E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(
          color: isDark ? const Color(0xFF141C2E) : const Color(0xFFE2E8F0),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withOpacity(0.12),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF10B981).withOpacity(0.4),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.smart_toy, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr('chatbot_title'),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      Text(
                        'AI Voice Assistant • Linked to cyborgcoding1@gmail.com',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                      ),
                    ],
                  ),
                ),

                // Audio Mute/Unmute Toggle Button
                AnimatedBuilder(
                  animation: widget.chatbotController,
                  builder: (context, _) => Tooltip(
                    message: widget.chatbotController.isMuted ? 'Sound Muted' : 'Sound ON',
                    child: IconButton(
                      icon: Icon(
                        widget.chatbotController.isMuted ? Icons.volume_off : Icons.volume_up,
                        color: widget.chatbotController.isMuted ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                      ),
                      onPressed: widget.chatbotController.toggleMute,
                    ),
                  ),
                ),

                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // 3 Tabs: Chat / Complaints / Compliments
          TabBar(
            controller: _tabController,
            indicatorColor: const Color(0xFF10B981),
            indicatorWeight: 3,
            labelColor: const Color(0xFF10B981),
            unselectedLabelColor: Colors.grey,
            labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            tabs: const [
              Tab(icon: Icon(Icons.chat_bubble_outline, size: 16), text: 'AI Chat & Voice'),
              Tab(icon: Icon(Icons.report_problem_outlined, size: 16), text: 'Complaints / شكاوى'),
              Tab(icon: Icon(Icons.favorite_outline, size: 16), text: 'Compliments / شكر'),
            ],
          ),

          // Tab Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildChatTab(context),
                _buildComplaintsTab(context),
                _buildFeedbackTab(context),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatTab(BuildContext context) {
    final tr = widget.languageController.tr;

    return AnimatedBuilder(
      animation: widget.chatbotController,
      builder: (context, _) {
        final messages = widget.chatbotController.messages;
        final hasPendingOrder = widget.chatbotController.pendingOrderPlan != null;

        return Column(
          children: [
            // Quick Suggestion Chips
            Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _chip('أسبوعين بـ 2000 جنيه'),
                  _chip('1 month budget 3500 EGP'),
                  _chip('عصير جهينة مانجو'),
                  _chip('ألبان وبقوليات لمدة شهر'),
                ],
              ),
            ),

            // Voiced Order Safety Banner (لم يتم الخصم إلا بعد التأكيد)
            if (hasPendingOrder) _buildVoicedOrderSafetyBanner(context),

            // Messages List
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: messages.length,
                itemBuilder: (context, idx) {
                  final msg = messages[idx];
                  return _buildMessageBubble(msg);
                },
              ),
            ),

            if (widget.chatbotController.isThinking)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF10B981))),
                    SizedBox(width: 8),
                    Text('Cyborg AI is computing recommendations...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),

            // Input Bar
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.grey.withOpacity(0.2))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textCtrl,
                      decoration: InputDecoration(
                        hintText: tr('ask_anything'),
                        filled: true,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      ),
                      onSubmitted: (txt) {
                        if (txt.trim().isNotEmpty) {
                          widget.chatbotController.sendUserQuery(txt, onAddToCart: widget.onAddToCart);
                          _textCtrl.clear();
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withOpacity(0.4),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.send, color: Colors.white, size: 18),
                      onPressed: () {
                        final txt = _textCtrl.text.trim();
                        if (txt.isNotEmpty) {
                          widget.chatbotController.sendUserQuery(txt, onAddToCart: widget.onAddToCart);
                          _textCtrl.clear();
                        }
                      },
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

  // Voiced Order Safety Banner Widget
  Widget _buildVoicedOrderSafetyBanner(BuildContext context) {
    final plan = widget.chatbotController.pendingOrderPlan!;
    final items = (plan['items'] as List? ?? []);
    final total = plan['total_cost'] ?? 0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF141C2E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withOpacity(0.2),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.shield_outlined, color: Color(0xFFF59E0B), size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'طلب صوتي قيد التأكيد (Stock Preserved)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFFF59E0B)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'لم يتم الخصم بعد',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'تم اقتراح ${items.length} أصناف بإجمالي $total جنيه. لن يتم خصم أي كمية من المخزون حتى تؤكد طلبك الآن.',
            style: const TextStyle(fontSize: 11, color: Colors.white70),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('تأكيد وخصم المخزون', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => widget.chatbotController.confirmPendingOrder(),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                child: const Text('إلغاء', style: TextStyle(fontSize: 12, color: Colors.grey)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                  side: BorderSide(color: Colors.grey.withOpacity(0.4)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => widget.chatbotController.cancelPendingOrder(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Complaints Tab Widget (VOICE UPDATES Section 12)
  Widget _buildComplaintsTab(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.support_agent, color: Color(0xFFF59E0B), size: 20),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Customer Complaints Management', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    Text('Tickets routed directly to management inbox', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),

          // Category Dropdown
          const Text('Complaint Category (تصنيف الشكوى)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.withOpacity(0.3)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedCategory,
                isExpanded: true,
                items: _complaintCategories.map((c) => DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedCategory = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Customer Name Field
          const Text('Customer Name (اسم العميل)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          TextField(
            controller: _complaintNameCtrl,
            decoration: InputDecoration(
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),

          // Order ID Field
          const Text('Order ID / رقم الطلب (Optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          TextField(
            controller: _complaintOrderIdCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: 'e.g. 45',
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),

          // Description Field
          const Text('Complaint Details (تفاصيل الشكوى والطلب)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          TextField(
            controller: _complaintDescCtrl,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Describe product defect, delivery delay, or billing issue...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),

          // Submit Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.send_rounded, size: 18),
              label: const Text('Submit Formal Complaint', style: TextStyle(fontWeight: FontWeight.bold)),
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
                    const SnackBar(content: Text('Please describe your complaint.')),
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
                _tabController.animateTo(0);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Complaint filed successfully (${res['ticket_id']})! Sent to cyborgcoding1@gmail.com'),
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

  // Compliments & Feedback Tab Widget
  Widget _buildFeedbackTab(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.mail_outline, color: Color(0xFF10B981), size: 20),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Direct Store Feedback & Compliments', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    Text('Delivered to cyborgcoding1@gmail.com', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          const Text('Your Name', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          TextField(
            controller: _nameCtrl,
            decoration: InputDecoration(
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          const Text('Compliment or Suggestion', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          TextField(
            controller: _feedbackCtrl,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Share your feedback, praise, or shopping suggestions...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.favorite, size: 18),
              label: const Text('Send to Management Inbox', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                final msg = _feedbackCtrl.text.trim();
                if (msg.isEmpty) return;
                await widget.chatbotController.sendComplimentOrFeedback(
                  customerName: _nameCtrl.text.trim(),
                  message: msg,
                );
                _feedbackCtrl.clear();
                _tabController.animateTo(0);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      child: ActionChip(
        label: Text(label, style: const TextStyle(fontSize: 11)),
        backgroundColor: const Color(0xFF10B981).withOpacity(0.1),
        side: BorderSide(color: const Color(0xFF10B981).withOpacity(0.3)),
        onPressed: () {
          widget.chatbotController.sendUserQuery(label, onAddToCart: widget.onAddToCart);
        },
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: msg.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: msg.isUser ? const Color(0xFF10B981) : const Color(0xFF0D121F),
              borderRadius: BorderRadius.circular(16),
              border: msg.isUser ? null : Border.all(color: const Color(0xFF141C2E)),
            ),
            child: Text(
              msg.text,
              style: TextStyle(
                color: msg.isUser ? Colors.white : Colors.white70,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
          if (msg.suggestedProducts != null && msg.suggestedProducts!.isNotEmpty)
            Container(
              height: 110,
              margin: const EdgeInsets.only(top: 8),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: msg.suggestedProducts!.length,
                itemBuilder: (ctx, i) {
                  final p = msg.suggestedProducts![i];
                  return Container(
                    width: 200,
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D121F),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF141C2E)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                        Text('${p.price.toStringAsFixed(2)} EGP', style: const TextStyle(color: Color(0xFF22C55E), fontSize: 12, fontWeight: FontWeight.bold)),
                        const Spacer(),
                        SizedBox(
                          width: double.infinity,
                          height: 28,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              padding: EdgeInsets.zero,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: () => widget.onAddToCart(p),
                            child: const Text('Add to Cart', style: TextStyle(fontSize: 11, color: Colors.white)),
                          ),
                        ),
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
}
