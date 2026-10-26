import math
from typing import List, Dict, Any, Optional
import category_matcher
import database
import duration_parser


def recommend_products(
    budget: float,
    categories: Optional[List[str]] = None,
    duration_days: Optional[int] = None,
    query: Optional[str] = None,
    max_items: int = 15
) -> Dict[str, Any]:
    """
    Intelligent, deterministic budget-based and duration-aware recommendation engine.
    - Strictly respects budget limit (never exceeds budget).
    - Strictly filters products by requested categories.
    - Validates duration (1 to 365 days).
    - Maximizes budget utilization while ensuring product diversity and realistic quantities.
    - Programmatically computes all subtotals, totals, and daily spending.
    - Provides detailed, transparent explanations in English and Arabic.
    """
    # 1. Validate Budget
    if budget is None or budget <= 0:
        return {
            'success': False,
            'error': "Invalid budget. Budget must be a positive number greater than 0 EGP.",
            'items': [],
            'total_spent': 0.0,
            'budget': budget,
            'remaining_budget': 0.0
        }

    # 2. Validate Duration if provided
    duration_label_en = None
    duration_label_ar = None
    if duration_days is not None:
        is_valid_dur, dur_err = duration_parser.validate_duration(duration_days)
        if not is_valid_dur:
            return {
                'success': False,
                'error': dur_err,
                'items': [],
                'total_spent': 0.0,
                'budget': budget,
                'remaining_budget': budget,
                'duration_days': duration_days
            }
        duration_label_en = duration_parser.format_duration(duration_days, "en")
        duration_label_ar = duration_parser.format_duration(duration_days, "ar")

    # 3. Retrieve available products from database (stock > 0)
    all_prods = database.get_all_products(in_stock_only=True)
    if not all_prods:
        return {
            'success': False,
            'error': "No products are currently available in stock.",
            'items': [],
            'total_spent': 0.0,
            'budget': budget,
            'remaining_budget': budget
        }

    # 4. Apply Strict Category Filter
    if categories:
        candidates = category_matcher.filter_products_strictly(all_prods, categories)
        if not candidates:
            cat_names = ", ".join(categories)
            return {
                'success': False,
                'error': f"No products found in stock for requested categories: '{cat_names}'. Unrelated categories were not added to preserve strict constraints.",
                'items': [],
                'total_spent': 0.0,
                'budget': budget,
                'remaining_budget': budget,
                'requested_categories': categories
            }
    else:
        candidates = all_prods

    # Optional text query ranking if specific term was mentioned
    if query:
        q_lower = query.lower()
        # Sort candidates that contain query higher
        candidates = sorted(
            candidates,
            key=lambda p: (
                0 if (q_lower in (p.get('name_en') or '').lower() or q_lower in (p.get('name_ar') or '')) else 1,
                p['price']
            )
        )
    else:
        # Sort by quality/diversity indicator (price distribution)
        candidates = sorted(candidates, key=lambda p: p['price'])

    # Determine max practical units per product based on duration
    if duration_days is None:
        max_units_per_prod = 3
    elif duration_days <= 7:
        max_units_per_prod = 2
    elif duration_days <= 30:
        max_units_per_prod = 4
    elif duration_days <= 90:
        max_units_per_prod = 6
    else:
        max_units_per_prod = 10

    # 5. Optimization: Multi-phase knapsack / greedy budget allocation
    selected_items: Dict[int, Dict[str, Any]] = {}
    current_total = 0.0

    # Phase 1: Ensure Product Diversity across different subcategories/brands
    seen_groups = set()
    for prod in candidates:
        price = float(prod['price'])
        if price <= 0:
            continue
        if current_total + price > budget:
            continue

        group_key = f"{prod.get('subcategory_en')}_{prod.get('brand')}"
        if group_key in seen_groups and len(selected_groups := seen_groups) < 8:
            continue

        p_id = prod['id']
        selected_items[p_id] = {
            'product_id': prod['id'],
            'barcode': prod['barcode'],
            'name_en': prod['name_en'],
            'name_ar': prod['name_ar'],
            'category_en': prod['category_en'],
            'category_ar': prod['category_ar'],
            'subcategory_en': prod['subcategory_en'],
            'subcategory_ar': prod['subcategory_ar'],
            'unit_price': price,
            'quantity': 1,
            'max_stock': prod['stock'],
            'image': prod['image'],
            'size': prod['size']
        }
        current_total = round(current_total + price, 2)
        seen_groups.add(group_key)

        if len(selected_items) >= max_items:
            break

    # Phase 2: Duration-Aware Scaling of selected items
    # For longer durations, family staples need higher quantities
    if duration_days and duration_days >= 7:
        scale_target = min(max_units_per_prod, math.ceil(duration_days / 7))
        for p_id, item in list(selected_items.items()):
            price = item['unit_price']
            avail_stock = item['max_stock']
            while item['quantity'] < scale_target and item['quantity'] < avail_stock:
                if current_total + price <= budget:
                    item['quantity'] += 1
                    current_total = round(current_total + price, 2)
                else:
                    break

    # Phase 3: Budget Gap Optimization (maximize utilization without exceeding budget)
    # Try to add more of existing products or introduce affordable new products
    budget_gap = budget - current_total

    # 3a: Increment existing selected items if stock allows and price fits gap
    # Prioritize items with prices that best fill the gap
    for p_id, item in sorted(selected_items.items(), key=lambda x: -x[1]['unit_price']):
        price = item['unit_price']
        avail_stock = item['max_stock']
        while item['quantity'] < max_units_per_prod and item['quantity'] < avail_stock:
            if current_total + price <= budget:
                item['quantity'] += 1
                current_total = round(current_total + price, 2)
            else:
                break

    # 3b: If significant budget remains, pick additional products from candidates
    for prod in candidates:
        p_id = prod['id']
        if p_id in selected_items:
            continue
        price = float(prod['price'])
        if price <= 0:
            continue
        if current_total + price <= budget:
            selected_items[p_id] = {
                'product_id': prod['id'],
                'barcode': prod['barcode'],
                'name_en': prod['name_en'],
                'name_ar': prod['name_ar'],
                'category_en': prod['category_en'],
                'category_ar': prod['category_ar'],
                'subcategory_en': prod['subcategory_en'],
                'subcategory_ar': prod['subcategory_ar'],
                'unit_price': price,
                'quantity': 1,
                'max_stock': prod['stock'],
                'image': prod['image'],
                'size': prod['size']
            }
            current_total = round(current_total + price, 2)

    # 6. Calculate Programmatic Totals & Subtotals
    final_items = []
    calculated_total = 0.0

    for item in selected_items.values():
        unit_price = float(item['unit_price'])
        qty = int(item['quantity'])
        subtotal = round(unit_price * qty, 2)
        item['subtotal'] = subtotal
        calculated_total = round(calculated_total + subtotal, 2)
        final_items.append(item)

    # Sort final items nicely by subtotal descending
    final_items.sort(key=lambda x: -x['subtotal'])

    remaining_budget = round(budget - calculated_total, 2)
    budget_utilization_pct = round((calculated_total / budget) * 100, 1)

    # Find cheapest candidate price to explain remaining budget
    min_cand_price = min([float(p['price']) for p in candidates if float(p['price']) > 0], default=0.0)

    # 7. Generate Explanation
    daily_spending = round(calculated_total / duration_days, 2) if duration_days else None
    daily_budget = round(budget / duration_days, 2) if duration_days else None

    # Construct human-readable explanations
    explanation_parts_en = []
    explanation_parts_ar = []

    explanation_parts_en.append(
        f"Recommended {len(final_items)} distinct products totaling {calculated_total:,.2f} EGP "
        f"out of your {budget:,.2f} EGP budget ({budget_utilization_pct}% utilized)."
    )
    explanation_parts_ar.append(
        f"تم ترشيح {len(final_items)} منتجات متنوعة بإجمالي {calculated_total:,.2f} جنيه "
        f"من ميزانيتك المحددة {budget:,.2f} جنيه (نسبة استخدام {budget_utilization_pct}%)."
    )

    if duration_days:
        explanation_parts_en.append(
            f"Shopping plan for {duration_label_en} ({duration_days} days): "
            f"Average daily spending is {daily_spending:,.2f} EGP/day (allocated budget: {daily_budget:,.2f} EGP/day). "
            f"Quantities have been adjusted for practical household consumption over this timeframe."
        )
        explanation_parts_ar.append(
            f"خطة تسوق لمدة {duration_label_ar} ({duration_days} يوم): "
            f"متوسط الإنفاق اليومي هو {daily_spending:,.2f} جنيه/يوم (الميزانية المتاحة: {daily_budget:,.2f} جنيه/يوم). "
            f"تم ضبط الكميات لتناسب الاستهلاك المنزلي الواقعي طوال هذه المدة."
        )

    if categories:
        cats_str = ", ".join(categories)
        explanation_parts_en.append(f"Strict category filtering applied: only products from [{cats_str}] are included.")
        explanation_parts_ar.append(f"تم تطبيق تصفية الفئات الصارمة: تقتصر المنتجات حصرياً على الفئات المطلوبة.")

    if remaining_budget > 0:
        if remaining_budget < min_cand_price:
            explanation_parts_en.append(
                f"Remaining budget: {remaining_budget:,.2f} EGP. No additional available item could be added "
                f"because the lowest available product price is {min_cand_price:,.2f} EGP."
            )
            explanation_parts_ar.append(
                f"الميزانية المتبقية: {remaining_budget:,.2f} جنيه. لم يتم إضافة منتجات إضافية لأن أقل سعر منتج متاح هو {min_cand_price:,.2f} جنيه."
            )
        else:
            explanation_parts_en.append(f"Remaining budget buffer: {remaining_budget:,.2f} EGP.")
            explanation_parts_ar.append(f"فائض الميزانية المتبقي: {remaining_budget:,.2f} جنيه.")

    return {
        'success': True,
        'budget': budget,
        'total_spent': calculated_total,
        'remaining_budget': remaining_budget,
        'utilization_percent': budget_utilization_pct,
        'duration_days': duration_days,
        'duration_label_en': duration_label_en,
        'duration_label_ar': duration_label_ar,
        'daily_spending': daily_spending,
        'daily_budget': daily_budget,
        'items_count': len(final_items),
        'items': final_items,
        'categories_applied': categories or [],
        'explanation_en': " ".join(explanation_parts_en),
        'explanation_ar': " ".join(explanation_parts_ar)
    }
