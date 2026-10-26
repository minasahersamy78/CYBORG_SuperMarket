import re

html_path = 'customer-website/src/views/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Store View HTML Template
store_view_html = '''
    <!-- ======================================================== -->
    <!-- VIEW 1: HOME STORE (All Products categorized + Category Filters + Bilingual Search) -->
    <!-- ======================================================== -->
    <div id="view-store" class="w-full space-y-6">
        <!-- Store Hero & Category Filter Bar -->
        <div class="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-xl font-black text-white flex items-center gap-2">
                        <i class="fa-solid fa-store text-emerald-400"></i>
                        <span id="store-title">متجر سايبورغ سوبرماركت - تسوق ذكي وتوصيل فوري</span>
                    </h2>
                    <p class="text-xs text-slate-400 mt-1" id="store-sub">
                        تصفح جميع المنتجات حسب الأقسام، أو ابحث باسم المنتج بالعربي أو الإنجليزي.
                    </p>
                </div>
                
                <!-- Bilingual Search Bar (Arabic & English Name Search) -->
                <div class="relative w-full md:w-80">
                    <input type="text" id="store-search-input" oninput="handleBilingualSearch(this.value)" placeholder="Search products (عربي / English)..." class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-2xl pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                </div>
            </div>

            <!-- Category Filter Buttons / Chips -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scroll" id="category-filter-bar">
                <button onclick="filterByCategory('all')" id="cat-btn-all" class="px-4 py-2 rounded-xl text-xs font-bold transition bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 flex-shrink-0">
                    <i class="fa-solid fa-border-all"></i> <span id="label-cat-all">جميع الأقسام (All)</span>
                </button>
                <button onclick="filterByCategory('Fresh Food')" id="cat-btn-fresh" class="px-4 py-2 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white bg-dark-800/80 border border-white/10 flex items-center gap-1.5 flex-shrink-0">
                    <span>🥬</span> <span id="label-cat-fresh">أغذية طازجة (Fresh Food)</span>
                </button>
                <button onclick="filterByCategory('Beverages')" id="cat-btn-beverages" class="px-4 py-2 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white bg-dark-800/80 border border-white/10 flex items-center gap-1.5 flex-shrink-0">
                    <span>🧃</span> <span id="label-cat-beverages">مشروبات وعصائر (Beverages)</span>
                </button>
                <button onclick="filterByCategory('Food Cupboard')" id="cat-btn-cupboard" class="px-4 py-2 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white bg-dark-800/80 border border-white/10 flex items-center gap-1.5 flex-shrink-0">
                    <span>🍚</span> <span id="label-cat-cupboard">بقالة وبقوليات (Food Cupboard)</span>
                </button>
                <button onclick="filterByCategory('Frozen Food')" id="cat-btn-frozen" class="px-4 py-2 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white bg-dark-800/80 border border-white/10 flex items-center gap-1.5 flex-shrink-0">
                    <span>❄️</span> <span id="label-cat-frozen">أطعمة مجمدة (Frozen Food)</span>
                </button>
                <button onclick="filterByCategory('Fruits & Vegetables')" id="cat-btn-fruits" class="px-4 py-2 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white bg-dark-800/80 border border-white/10 flex items-center gap-1.5 flex-shrink-0">
                    <span>🍎</span> <span id="label-cat-fruits">خضار وفواكه (Fruits & Vegetables)</span>
                </button>
            </div>
        </div>

        <!-- Catalog Container: Products Rendered Grouped by Category -->
        <div id="store-catalog-container" class="space-y-8">
            <div class="text-center py-12 text-slate-400 text-sm">
                <i class="fa-solid fa-spinner fa-spin text-emerald-400 text-2xl mb-2"></i>
                <p>Loading Cyborg Supermarket catalog...</p>
            </div>
        </div>
    </div>
'''

# 2. Complaints Page HTML Template
complaints_view_html = '''
    <!-- ======================================================== -->
    <!-- VIEW 3: COMPLAINTS & FEEDBACK (Dedicated Customer Care Page) -->
    <!-- ======================================================== -->
    <div id="view-complaints" class="hidden w-full space-y-6">
        <div class="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl">
            <h2 class="text-xl font-black text-white flex items-center gap-2">
                <i class="fa-solid fa-headset text-amber-400"></i>
                <span>خدمة العملاء والشكاوى والاقتراحات (Customer Care & Complaints)</span>
            </h2>
            <p class="text-xs text-slate-400 mt-1">
                تُرسل كافة الشكاوى ورسائل الشكر مباشرة إلى إيميل إدارة المتجر المعتمد: <span class="text-emerald-400 font-mono font-bold">cyborgcoding1@gmail.com</span>
            </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Card 1: Official Complaint Submission Form -->
            <div class="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4">
                <div class="flex items-center gap-3 pb-3 border-b border-white/10">
                    <div class="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-base">تقديم شكوى رسمية (Formal Complaint)</h3>
                        <p class="text-xs text-slate-400">متابعة دقيقة وحل فوري من إدارة المتجر</p>
                    </div>
                </div>

                <form onsubmit="handleDedicatedComplaintSubmit(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">نوع الشكوى (Category)</label>
                        <select id="ded-complaint-category" class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500">
                            <option value="Product Quality">جودة المنتج (Product Quality)</option>
                            <option value="Delivery & Logistics">التوصيل والشحن والتأخير (Delivery & Logistics)</option>
                            <option value="Pricing & Billing">الأسعار والفواتير (Pricing & Billing)</option>
                            <option value="Customer Service & Staff">خدمة العملاء والموظفين (Customer Service & Staff)</option>
                            <option value="General Inquiry">استفسار عام (General Inquiry)</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">اسم العميل (Name)</label>
                            <input type="text" id="ded-complaint-name" required value="Customer" class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">رقم الطلب (Order ID - Optional)</label>
                            <input type="text" id="ded-complaint-order-id" placeholder="e.g. 12" class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">تفاصيل الشكوى (Complaint Description)</label>
                        <textarea id="ded-complaint-desc" rows="4" required placeholder="اشرح المشكلة بالتفصيل لمساعدتنا في حلها فوراً..." class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"></textarea>
                    </div>

                    <button type="submit" class="btn-3d w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20">
                        <i class="fa-solid fa-paper-plane"></i>
                        <span>إرسال الشكوى وتوليد رقم التذكرة</span>
                    </button>
                </form>
            </div>

            <!-- Card 2: Compliments & Suggestions Form -->
            <div class="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4">
                <div class="flex items-center gap-3 pb-3 border-b border-white/10">
                    <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-heart"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-base">إرسال شكر واقتراحات (Compliments & Feedback)</h3>
                        <p class="text-xs text-slate-400">يسعدنا دائماً سماع رأيك الإيجابي واقتراحاتك</p>
                    </div>
                </div>

                <form onsubmit="handleDedicatedFeedbackSubmit(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">اسم العميل (Name)</label>
                        <input type="text" id="ded-feedback-name" required value="Customer" class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">رسالتك أو اقتراحك (Message)</label>
                        <textarea id="ded-feedback-message" rows="6" required placeholder="اكتب رسالة شكر للفريق أو اقتراح لتطوير خدمات السوبرماركت..." class="w-full text-xs bg-dark-900/90 border border-white/15 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"></textarea>
                    </div>

                    <button type="submit" class="btn-3d w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                        <i class="fa-solid fa-heart"></i>
                        <span>إرسال للإدارة (cyborgcoding1@gmail.com)</span>
                    </button>
                </form>
            </div>
        </div>
    </div>
'''

# Check if view-store already exists
if 'id="view-store"' not in html:
    # We wrap main content so we have view-store, view-ai, view-complaints, view-orders, view-inventory
    # Find the AI view structure which is <main ...> ... </main>
    # We will wrap the existing two columns in <div id="view-ai" class="hidden w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
    
    # We replace <main ...> with <main ...> + store_view_html + complaints_view_html + wrap existing columns in view-ai
    pattern = r'(<main class="[^"]*">)'
    replacement = r'\1\n' + store_view_html + '\n' + complaints_view_html + '\n    <div id="view-ai" class="hidden w-full grid grid-cols-1 lg:grid-cols-12 gap-6">\n'
    html = re.sub(pattern, replacement, html, count=1)
    
    # And close the view-ai div right before </main>
    html = html.replace('</main>', '    </div>\n</main>', 1)
    print('Inserted view-store, view-complaints, and wrapped view-ai inside main')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('Saved updated index.html')
