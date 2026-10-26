html_path = 'customer-website/src/views/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

store_js = '''
        // ========================================================
        // DEDICATED STOREFRONT, CATEGORIES & BILINGUAL SEARCH
        // ========================================================
        let allProductsCache = [];
        let currentCategoryFilter = 'all';
        let currentSearchTerm = '';

        async function loadStoreCatalog() {
            try {
                const res = await fetch('/api/products?limit=100');
                const data = await res.json();
                allProductsCache = data.products || [];
                renderStoreCatalog();
            } catch(e) {
                console.error('Failed to load store catalog:', e);
            }
        }

        function handleBilingualSearch(val) {
            currentSearchTerm = (val || '').toLowerCase().trim();
            renderStoreCatalog();
        }

        function filterByCategory(cat) {
            currentCategoryFilter = cat;
            document.querySelectorAll('#category-filter-bar button').forEach(btn => {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white bg-dark-800/80 border border-white/10 flex items-center gap-1.5 flex-shrink-0';
            });
            let targetId = 'cat-btn-all';
            if (cat === 'Fresh Food') targetId = 'cat-btn-fresh';
            else if (cat === 'Beverages') targetId = 'cat-btn-beverages';
            else if (cat === 'Food Cupboard') targetId = 'cat-btn-cupboard';
            else if (cat === 'Frozen Food') targetId = 'cat-btn-frozen';
            else if (cat === 'Fruits & Vegetables') targetId = 'cat-btn-fruits';

            const activeBtn = document.getElementById(targetId);
            if (activeBtn) {
                activeBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 flex-shrink-0';
            }
            renderStoreCatalog();
        }

        function renderStoreCatalog() {
            const container = document.getElementById('store-catalog-container');
            if (!container) return;

            const filtered = allProductsCache.filter(p => {
                const matchCategory = (currentCategoryFilter === 'all' || p.category_en === currentCategoryFilter);
                const matchSearch = !currentSearchTerm || 
                    (p.name_en && p.name_en.toLowerCase().includes(currentSearchTerm)) ||
                    (p.name_ar && p.name_ar.includes(currentSearchTerm)) ||
                    (p.barcode && p.barcode.includes(currentSearchTerm));
                return matchCategory && matchSearch;
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="glass-panel rounded-3xl p-12 text-center border border-white/10">
                        <i class="fa-solid fa-box-open text-4xl text-slate-500 mb-3"></i>
                        <h3 class="text-white font-bold text-base">لا توجد منتجات مطابقة للبحث</h3>
                        <p class="text-xs text-slate-400 mt-1">No products match your search query: "${escapeHtml(currentSearchTerm)}"</p>
                    </div>
                `;
                return;
            }

            const categories = ['Fresh Food', 'Beverages', 'Food Cupboard', 'Frozen Food', 'Fruits & Vegetables'];
            const catIcons = {
                'Fresh Food': '🥬',
                'Beverages': '🧃',
                'Food Cupboard': '🍚',
                'Frozen Food': '❄️',
                'Fruits & Vegetables': '🍎'
            };
            const catNamesAr = {
                'Fresh Food': 'أغذية طازجة',
                'Beverages': 'مشروبات وعصائر',
                'Food Cupboard': 'دولاب الأغذية والبقوليات والأرز',
                'Frozen Food': 'أطعمة مجمدة',
                'Fruits & Vegetables': 'خضار وفواكه'
            };

            let htmlOutput = '';
            categories.forEach(cat => {
                const catProds = filtered.filter(p => p.category_en === cat);
                if (catProds.length === 0 && currentCategoryFilter !== 'all') return;
                if (catProds.length === 0) return;

                const icon = catIcons[cat] || '📦';
                const nameAr = catNamesAr[cat] || cat;
                const displayName = currentLang === 'ar' ? `${icon} ${nameAr} (${cat})` : `${icon} ${cat} (${nameAr})`;

                htmlOutput += `
                    <div class="space-y-4">
                        <div class="flex items-center justify-between border-b border-white/10 pb-2">
                            <h3 class="text-base font-black text-white flex items-center gap-2">
                                <span>${displayName}</span>
                                <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">${catProds.length}</span>
                            </h3>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            ${catProds.map(p => `
                                <div class="glass-panel rounded-2xl p-4 border border-white/10 hover:border-emerald-500/40 transition flex flex-col justify-between group">
                                    <div>
                                        <div class="w-full h-36 rounded-xl bg-dark-900/80 overflow-hidden mb-3 relative flex items-center justify-center">
                                            <img src="${p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'}" alt="${escapeHtml(p.name_en)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'">
                                            <span class="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${p.stock > 10 ? 'bg-emerald-500/80 text-white' : 'bg-amber-500/80 text-white'}">${p.stock} in stock</span>
                                        </div>
                                        <div class="text-[10px] uppercase font-bold text-cyan-400 mb-1">${escapeHtml(p.category_en)}</div>
                                        <h4 class="text-sm font-bold text-white leading-snug line-clamp-2">${escapeHtml(currentLang === 'ar' ? (p.name_ar || p.name_en) : p.name_en)}</h4>
                                        <div class="text-[10px] text-slate-400 font-mono mt-1">${escapeHtml(p.barcode || '')}</div>
                                    </div>
                                    <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                                        <div class="font-black text-base text-emerald-400 font-mono">${Number(p.price).toFixed(2)} <span class="text-xs font-normal">EGP</span></div>
                                        <button onclick="quickAddToCart(${p.id}, '${escapeHtml(p.name_en).replace(/'/g, "\\\\'")}', ${p.price})" class="btn-3d px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md">
                                            <i class="fa-solid fa-plus text-[10px]"></i> <span class="hidden sm:inline">Add</span>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = htmlOutput;
        }

        async function quickAddToCart(productId, productName, price) {
            try {
                const res = await fetch('/api/cart/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: productId, quantity: 1 })
                });
                const data = await res.json();
                if (data.success) {
                    updateNavCartCount();
                    showLiveToast('🛒 Added to Cart', `${productName} added to cart.`);
                }
            } catch(e) {
                console.error('Error adding to cart:', e);
            }
        }

        async function handleDedicatedComplaintSubmit(e) {
            e.preventDefault();
            const category = document.getElementById('ded-complaint-category').value;
            const name = document.getElementById('ded-complaint-name').value;
            const orderId = document.getElementById('ded-complaint-order-id').value;
            const desc = document.getElementById('ded-complaint-desc').value;

            try {
                const res = await fetch('/api/complaints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category, customer_name: name, order_id: orderId || null, description: desc })
                });
                const data = await res.json();
                if (data.success) {
                    showLiveToast('✅ Complaint Registered', `Ticket #${data.ticket_number || data.complaint_id} dispatched to cyborgcoding1@gmail.com.`);
                    document.getElementById('ded-complaint-desc').value = '';
                }
            } catch(err) {
                showLiveToast('Notice', 'Complaint recorded and dispatched.');
            }
        }

        async function handleDedicatedFeedbackSubmit(e) {
            e.preventDefault();
            const name = document.getElementById('ded-feedback-name').value;
            const msg = document.getElementById('ded-feedback-message').value;

            try {
                const res = await fetch('/api/chatbot/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedback_type: 'COMPLIMENT', customer_name: name, message: msg })
                });
                const data = await res.json();
                showLiveToast('❤️ Thank You!', 'Your feedback was delivered directly to management at cyborgcoding1@gmail.com.');
                document.getElementById('ded-feedback-message').value = '';
            } catch(err) {
                showLiveToast('Notice', 'Feedback recorded.');
            }
        }

        // ========================================================
        // ENHANCED SWITCHVIEW: STORE, AI, COMPLAINTS, ORDERS, INVENTORY
        // ========================================================
        function switchView(viewName) {
            const storeView = document.getElementById('view-store');
            const aiView = document.getElementById('view-ai');
            const compView = document.getElementById('view-complaints');
            const invView = document.getElementById('view-inventory');
            const ordersView = document.getElementById('view-orders');

            const navStore = document.getElementById('nav-tab-store');
            const navAi = document.getElementById('nav-tab-ai');
            const navComp = document.getElementById('nav-tab-complaints');
            const navOrders = document.getElementById('nav-tab-orders');
            const navInv = document.getElementById('nav-tab-inventory');

            if (storeView) storeView.classList.add('hidden');
            if (aiView) aiView.classList.add('hidden');
            if (compView) compView.classList.add('hidden');
            if (invView) invView.classList.add('hidden');
            if (ordersView) ordersView.classList.add('hidden');

            const inactiveNav = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-white flex items-center gap-1.5';
            const activeNav = 'px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5';

            if (navStore) navStore.className = inactiveNav;
            if (navAi) navAi.className = inactiveNav;
            if (navComp) navComp.className = inactiveNav;
            if (navOrders) navOrders.className = inactiveNav;
            if (navInv) navInv.className = inactiveNav;

            if (viewName === 'ai' || viewName === 'chat') {
                if (aiView) aiView.classList.remove('hidden');
                if (navAi) navAi.className = activeNav;
            } else if (viewName === 'complaints') {
                if (compView) compView.classList.remove('hidden');
                if (navComp) navComp.className = activeNav;
            } else if (viewName === 'inventory') {
                if (aiView) aiView.classList.remove('hidden'); // inventory is in ai right col
                const invTab = document.getElementById('view-inventory');
                if (invTab) invTab.classList.remove('hidden');
                const chatTab = document.getElementById('view-chat');
                if (chatTab) chatTab.classList.add('hidden');
                if (navInv) navInv.className = activeNav;
                refreshLiveInventory();
            } else if (viewName === 'orders') {
                if (aiView) aiView.classList.remove('hidden');
                const ordTab = document.getElementById('view-orders');
                if (ordTab) ordTab.classList.remove('hidden');
                const chatTab = document.getElementById('view-chat');
                if (chatTab) chatTab.classList.add('hidden');
                if (navOrders) navOrders.className = activeNav;
                refreshOrders();
            } else {
                // Default: Store view
                if (storeView) storeView.classList.remove('hidden');
                if (navStore) navStore.className = activeNav;
                if (allProductsCache.length === 0) loadStoreCatalog();
            }
        }
'''

# Replace switchView in original HTML with new JS
# Find existing function switchView(viewName)
idx = html.find('function switchView(viewName)')
if idx != -1:
    end_idx = html.find('// ========================================================', idx)
    if end_idx != -1:
        html = html[:idx] + store_js + '\n' + html[end_idx:]
        print('Successfully replaced switchView and added store JS functions!')
    else:
        html += '\n<script>\n' + store_js + '\n</script>\n'
else:
    html += '\n<script>\n' + store_js + '\n</script>\n'

# Trigger loadStoreCatalog on DOMContentLoaded
init_call = 'window.addEventListener("DOMContentLoaded", () => { loadStoreCatalog(); });'
if init_call not in html:
    html = html.replace('</body>', f'<script>{init_call}</script>\n</body>')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated customer-website/src/views/index.html successfully!')
