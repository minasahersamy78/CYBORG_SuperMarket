import 'package:flutter/material.dart';
import '../../controllers/chatbot_controller.dart';
import '../../controllers/language_controller.dart';
import '../../models/product.dart';

class AiVoiceTab extends StatefulWidget {
  final ChatbotController chatbotController;
  final LanguageController languageController;
  final Function(Product) onAddToCart;

  const AiVoiceTab({
    super.key,
    required this.chatbotController,
    required this.languageController,
    required this.onAddToCart,
  });

  @override
  State<AiVoiceTab> createState() => _AiVoiceTabState();
}

class _AiVoiceTabState extends State<AiVoiceTab> with SingleTickerProviderStateMixin {
  final TextEditingController _textCtrl = TextEditingController();
  final TextEditingController _budgetCtrl = TextEditingController(text: '2000');
  final TextEditingController _durationCtrl = TextEditingController(text: '14');
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _textCtrl.dispose();
    _budgetCtrl.dispose();
    _durationCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.languageController.tr;
    final isArabic = widget.languageController.isArabic;

    return AnimatedBuilder(
      animation: widget.chatbotController,
      builder: (context, _) {
        final messages = widget.chatbotController.messages;
        final hasPending = widget.chatbotController.pendingOrderPlan != null;

        return Column(
          children: [
            // Voice Header Bar with Audio Mute Toggle & Status
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF0D121F),
                border: Border(bottom: BorderSide(color: const Color(0xFF141C2E))),
              ),
              child: Row(
                children: [
                  // 3D Animated Glowing Orb Avatar (Tap to Speak)
                  GestureDetector(
                    onTap: () => _showVoiceSheet(context, isArabic),
                    child: ScaleTransition(
                      scale: Tween(begin: 0.92, end: 1.08).animate(CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut)),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFF10B981), Color(0xFF06B6D4)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF10B981).withValues(alpha: 0.5),
                              blurRadius: 14,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.mic, color: Colors.white, size: 22),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isArabic ? 'مساعد الذكاء الاصطناعي والصوت' : 'AI Voice Assistant & Planner',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                        ),
                        Text(
                          isArabic ? 'تخطيط الميزانية (1–365 يوم) • أمان الطلب الصوتي' : 'Grounded 1–365 Days • Voiced Order Safety',
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                        ),
                      ],
                    ),
                  ),

                  // Audio Mute/Unmute Button
                  Tooltip(
                    message: widget.chatbotController.isMuted ? 'Sound Muted' : 'Sound ON',
                    child: Container(
                      decoration: BoxDecoration(
                        color: widget.chatbotController.isMuted ? const Color(0xFFF59E0B).withOpacity(0.15) : const Color(0xFF10B981).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: IconButton(
                        icon: Icon(
                          widget.chatbotController.isMuted ? Icons.volume_off : Icons.volume_up,
                          color: widget.chatbotController.isMuted ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                          size: 20,
                        ),
                        onPressed: widget.chatbotController.toggleMute,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Quick Duration / Budget Chips (1-365 Days)
            Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              margin: const EdgeInsets.symmetric(vertical: 6),
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _chip('عايز اتنين لبن جهينة', '2 Juhayna Milk', isArabic),
                  _chip('أسبوعين بـ 2000 جنيه', '2 weeks budget 2000 EGP', isArabic),
                  _chip('خزين شهر بـ 3500 جنيه', '1 month budget 3500 EGP', isArabic),
                  _chip('ألبان وبقوليات لأسبوع', 'Dairy & legumes for 7 days', isArabic),
                  _chip('بكام عصير جهينة مانجو؟', 'Price of Juhayna Mango?', isArabic),
                ],
              ),
            ),

            // Voiced Order Safety Banner (لم يتم الخصم إلا بعد التأكيد)
            if (hasPending) _buildVoicedOrderSafetyBanner(context, isArabic),

            // Messages Scroll Area
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
                    Text('Cyborg AI is calculating recommendation...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),

            // Input Bar
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFF0D121F),
                border: Border(top: BorderSide(color: Color(0xFF141C2E))),
              ),
              child: Row(
                children: [
                  // Microphone Voice Assistant Trigger
                  Container(
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.mic, color: Color(0xFF10B981), size: 20),
                      tooltip: isArabic ? 'الأوامر الصوتية (مصري / English)' : 'Voice Commands',
                      onPressed: () => _showVoiceSheet(context, isArabic),
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _textCtrl,
                      decoration: InputDecoration(
                        hintText: isArabic ? 'تحدث أو اكتب ميزانية ومدة (مثال: أسبوعين بـ 2000 ج)...' : 'Speak or type budget and duration (e.g. 14 days 2000 EGP)...',
                        hintStyle: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                        filled: true,
                        fillColor: const Color(0xFF07090E),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      ),
                      onSubmitted: (txt) {
                        if (txt.trim().isNotEmpty) {
                          widget.chatbotController.sendUserQuery(txt, onAddToCart: widget.onAddToCart, isArabic: isArabic);
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
                          color: const Color(0xFF10B981).withValues(alpha: 0.4),
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
                          widget.chatbotController.sendUserQuery(txt, onAddToCart: widget.onAddToCart, isArabic: isArabic);
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

  Widget _buildVoicedOrderSafetyBanner(BuildContext context, bool isArabic) {
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
              Expanded(
                child: Text(
                  isArabic ? 'طلب صوتي قيد التأكيد (Stock Preserved)' : 'Voiced Order Pending (Stock Preserved)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFFF59E0B)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isArabic ? 'لم يتم الخصم بعد' : 'No deduction yet',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            isArabic
                ? 'تم اقتراح ${items.length} أصناف بإجمالي $total جنيه. لن يتم خصم أي كمية من المخزون حتى تؤكد طلبك الآن.'
                : 'Proposed ${items.length} items totaling $total EGP. Stock is preserved until you tap Confirm.',
            style: const TextStyle(fontSize: 11, color: Colors.white70),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: Text(
                    isArabic ? 'تأكيد وخصم المخزون' : 'Confirm & Deduct Stock',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
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
                child: Text(isArabic ? 'إلغاء' : 'Cancel', style: const TextStyle(fontSize: 12, color: Colors.grey)),
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

  Widget _chip(String labelAr, String labelEn, bool isArabic) {
    final label = isArabic ? labelAr : labelEn;
    return Container(
      margin: const EdgeInsets.only(right: 6),
      child: ActionChip(
        label: Text(label, style: const TextStyle(fontSize: 11)),
        backgroundColor: const Color(0xFF10B981).withValues(alpha: 0.12),
        side: BorderSide(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
        onPressed: () {
          widget.chatbotController.sendUserQuery(label, onAddToCart: widget.onAddToCart, isArabic: isArabic);
        },
      ),
    );
  }

  void _showVoiceSheet(BuildContext context, bool isArabic) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Color(0xFF0D121F),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              border: Border(top: BorderSide(color: Color(0xFF10B981), width: 2)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade700,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                ScaleTransition(
                  scale: Tween(begin: 0.95, end: 1.1).animate(
                    CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
                  ),
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF10B981), Color(0xFF06B6D4)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withValues(alpha: 0.5),
                          blurRadius: 20,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.mic, color: Colors.white, size: 36),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  isArabic ? 'المساعد الصوتي الذكي (مصري / English)' : 'AI Voice Shopping Assistant',
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  isArabic ? 'اضغط على أي جملة لتجربتها بالصوت، أو تحدث مباشرة:' : 'Tap a sample voice command to test speech recognition:',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    _sampleVoiceChip(
                      ctx,
                      isArabic ? 'عايز اتنين لبن جهينة' : 'I want 2 Juhayna milk',
                      isArabic,
                    ),
                    _sampleVoiceChip(
                      ctx,
                      isArabic ? 'بكام عصير جهينة مانجو؟' : 'How much is Juhayna Mango?',
                      isArabic,
                    ),
                    _sampleVoiceChip(
                      ctx,
                      isArabic ? 'خزين أسبوعين بـ 2000 جنيه' : '2 weeks grocery budget 2000 EGP',
                      isArabic,
                    ),
                    _sampleVoiceChip(
                      ctx,
                      isArabic ? 'تأكيد الطلب' : 'Confirm Order',
                      isArabic,
                    ),
                    _sampleVoiceChip(
                      ctx,
                      isArabic ? 'إلغاء الطلب' : 'Cancel Order',
                      isArabic,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _sampleVoiceChip(BuildContext sheetCtx, String text, bool isArabic) {
    return ActionChip(
      backgroundColor: const Color(0xFF141C2E),
      side: const BorderSide(color: Color(0xFF10B981), width: 1),
      avatar: const Icon(Icons.volume_up, size: 16, color: Color(0xFF10B981)),
      label: Text(text, style: const TextStyle(color: Colors.white, fontSize: 12)),
      onPressed: () {
        Navigator.pop(sheetCtx);
        widget.chatbotController.sendUserQuery(text, onAddToCart: widget.onAddToCart, isArabic: isArabic);
      },
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
