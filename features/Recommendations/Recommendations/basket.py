import random
import re
import pandas as pd

FRESH = "الخضار والفواكه الطازجة"
FROZEN = "الفاكهة و الخضار المجمد"

CATEGORY_WEIGHTS = {
    "الأرز والمعكرونة والبقوليات": 0.25,
    "منتجات الألبان والبيض": 0.25,
    FRESH: 0.20,
    "الفاكهة و الخضار المجمد": 0.08,
    "توابل، صلصات و خل": 0.08,
    "العصائر": 0.04,
    "مشروبات غازية": 0.04,
    "بسكويت، كراكرز وكيك": 0.06,
}

CATEGORY_KEYWORDS = {
    "الأرز والمعكرونة والبقوليات": ["ارز", "رز", "مكرونه", "معكرونه", "بقوليات", "بقول", "عدس", "فول", "حمص", "لوبيا", "فاصوليا", "شعريه", "دقيق", "سكر", "زيت", "مكرونة"],
    "منتجات الألبان والبيض": ["البان", "لبن", "حليب", "جبن", "جبنه", "زبادي", "زبده", "بيض", "قشطه", "لبنه", "رايب", "كريمه"],
    FRESH: ["خضار", "خضروات", "فاكهه", "فواكه", "طازج", "طازجه", "بصل", "طماطم", "بطاطس", "موز", "تفاح", "برتقال"],
    "الفاكهة و الخضار المجمد": ["مجمد", "مجمده", "فروزن", "بامي", "ملوخيه", "بسله"],
    "توابل، صلصات و خل": ["توابل", "بهارات", "صلصه", "صلصات", "خل", "كاتشب", "مايونيز", "تتبيله", "كمون", "فلفل", "ملح"],
    "العصائر": ["عصير", "عصائر", "جوس"],
    "مشروبات غازية": ["غازيه", "غازي", "مشروبات", "صودا", "سودا", "بيبسي", "كولا", "سفن", "كانز"],
    "بسكويت، كراكرز وكيك": ["بسكويت", "بسكوت", "بسكويتات", "كراكرز", "كيك", "سناكس", "شيبسي", "تسالي", "حلويات", "شيكولاته", "شوكولاته", "وفر"],
}


def prepare_data(df):
    df = df.copy()
    fresh = df["ArabicCategory"].fillna("").str.contains("خضار|\ufffd", regex=True)
    df.loc[df["ArabicSubCategory"].isna() & fresh, "ArabicSubCategory"] = FRESH
    return df.dropna(subset=["ArabicSubCategory"]).reset_index(drop=True)


UNIT_DAYS = {"day": 1, "week": 7, "month": 30, "year": 365}
BELOW_DAY = {"second": "ثواني", "minute": "دقايق", "hour": "ساعات"}
MAX_DAYS = 365
MIN_BUDGET = 50


def duration_to_days(value, unit):
    unit = str(unit).lower()
    if unit in BELOW_DAY:
        raise ValueError(f"أقل مدة مدعومة هي يوم واحد، ومش بنقبل {BELOW_DAY[unit]}.")
    if unit not in UNIT_DAYS:
        raise ValueError("وحدة المدة لازم تكون أيام أو أسابيع أو شهور أو سنة.")
    if value <= 0:
        raise ValueError("المدة لازم تكون أكبر من صفر.")
    if unit == "year" and value != 1:
        raise ValueError("بنقبل سنة واحدة بس، ولو محتاج مدة تانية اكتبها بالأيام (لحد 365 يوم).")
    if value != int(value):
        if unit == "day":
            raise ValueError("أقل مدة مدعومة هي يوم واحد.")
        raise ValueError("المدة لازم تكون رقم صحيح، ولو محتاج مدة بالنص اكتبها بالأيام (مثال: 45 يوم).")
    days = int(value) * UNIT_DAYS[unit]
    if days > MAX_DAYS:
        raise ValueError("أقصى مدة مدعومة هي 365 يوم (سنة).")
    return days


def duration_label(days):
    if days == 365:
        return "سنة"
    if days % 30 == 0:
        m = days // 30
        return "شهر" if m == 1 else "شهرين" if m == 2 else f"{m} شهور"
    if days % 7 == 0:
        w = days // 7
        return "أسبوع" if w == 1 else "أسبوعين" if w == 2 else f"{w} أسابيع"
    if days == 1:
        return "يوم"
    if days == 2:
        return "يومين"
    return f"{days} أيام" if days <= 10 else f"{days} يوم"


def normalize(text):
    text = re.sub(r"[ً-ْـ]", "", str(text))
    text = re.sub(r"[أإآ]", "ا", text)
    text = text.replace("ة", "ه").replace("ى", "ي")
    return text.lower().strip()


def _candidates(token):
    forms = {token}
    if token and token[0] in "وبلف":
        forms.add(token[1:])
    for form in list(forms):
        if form.startswith("ال"):
            forms.add(form[2:])
    return forms


def resolve_categories(requested):
    if not requested:
        return []
    found = []
    for entry in requested:
        matched = []
        for token in re.findall(r"[\w]+", normalize(entry)):
            forms = _candidates(token)
            for category, words in CATEGORY_KEYWORDS.items():
                if category not in matched and any(f.startswith(normalize(w)) for f in forms for w in words):
                    matched.append(category)
        for category in CATEGORY_WEIGHTS:
            if normalize(entry) == normalize(category) and category not in matched:
                matched.append(category)
        if FROZEN in matched and FRESH in matched:
            matched.remove(FRESH)
        found.extend(c for c in matched if c not in found)
    return found


def _fill(items, limit, counts, max_qty):
    spent = 0.0
    while True:
        added = False
        for row in items:
            if counts.get(row.Index, 0) >= max_qty:
                continue
            if spent + row.price <= limit + 1e-9:
                counts[row.Index] = counts.get(row.Index, 0) + 1
                spent += row.price
                added = True
        if not added:
            return spent


def build_basket(df, budget, categories=None, days=30, seed=None):
    rng = random.Random(seed)
    cats = resolve_categories(categories) or list(CATEGORY_WEIGHTS)
    max_qty = int(min(36, max(1, days / 10 + 0.5)))
    total_weight = sum(CATEGORY_WEIGHTS[c] for c in cats)
    counts = {}
    spent = 0.0

    by_cat = {}
    for cat in cats:
        part = df[df["ArabicSubCategory"] == cat]
        rows = list(part.itertuples())
        rng.shuffle(rows)
        by_cat[cat] = rows

    for cat in cats:
        limit = budget * CATEGORY_WEIGHTS[cat] / total_weight
        items = [r for r in by_cat[cat] if r.price <= limit * 0.35]
        spent += _fill(items, limit, counts, max_qty)

    for _ in range(3):
        leftover = budget - spent
        if leftover < 3:
            break
        for cat in cats:
            share = leftover * CATEGORY_WEIGHTS[cat] / total_weight
            items = sorted(by_cat[cat], key=lambda r: r.price)
            items = [r for r in items if r.price <= share]
            spent += _fill(items, share, counts, max_qty)

    leftover = budget - spent
    pool = sorted((r for c in cats for r in by_cat[c]), key=lambda r: r.price)
    pool = [r for r in pool if r.price <= leftover]
    spent += _fill(pool, leftover, counts, max_qty)

    groups = {}
    for cat in cats:
        lines = []
        for row in by_cat[cat]:
            qty = counts.get(row.Index, 0)
            if qty:
                lines.append({"name": row.ArabicPrtoductName, "qty": qty, "price": float(row.price), "total": qty * float(row.price)})
        if lines:
            groups[cat] = lines
    return {"budget": budget, "spent": spent, "groups": groups, "categories": cats, "days": days}


def format_basket(result):
    if not result["groups"]:
        return "مفيش منتجات مناسبة للميزانية والأقسام دي."
    out = [f"سلة لمدة {duration_label(result['days'])}.", f"تم تجهيز السلة: الإجمالي {result['spent']:.2f} جنيه من أصل {result['budget']:.0f} جنيه (باقي {result['budget'] - result['spent']:.2f} جنيه)."]
    for cat, lines in result["groups"].items():
        subtotal = sum(l["total"] for l in lines)
        out.append(f"\n### {cat} ({subtotal:.2f} جنيه)\n")
        out.append("| المنتج | الكمية | سعر الوحدة | الإجمالي |")
        out.append("|---|---|---|---|")
        for l in lines:
            out.append(f"| {l['name']} | {l['qty']} | {l['price']:.2f} | {l['total']:.2f} |")
    return "\n".join(out)
