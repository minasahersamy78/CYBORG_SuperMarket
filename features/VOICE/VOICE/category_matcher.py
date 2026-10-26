import re
from typing import List, Dict, Any, Tuple

# Mapping of canonical category tokens to their English & Arabic keywords
CATEGORY_DEFINITIONS = {
    'dairy': {
        'name_en': 'Dairy & Eggs',
        'name_ar': 'منتجات الألبان والبيض',
        'keywords': [
            'dairy', 'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'ghee', 'cream', 'labneh', 'zabado',
            'البان', 'ألبان', 'لبن', 'جبن', 'جبنة', 'جبنه', 'زبادي', 'زبادو', 'سمن', 'قشطة', 'قشطه', 'لبنة', 'لبنه'
        ],
        'subcategories_en': ['Dairy & Eggs'],
        'subcategories_ar': ['منتجات الألبان والبيض']
    },
    'legumes': {
        'name_en': 'Legumes & Pulses',
        'name_ar': 'البقوليات',
        'keywords': [
            'legume', 'legumes', 'pulse', 'pulses', 'bean', 'beans', 'lentil', 'lentils',
            'pea', 'peas', 'chickpea', 'chickpeas', 'fava', 'lupin',
            'بقول', 'بقوليات', 'فول', 'عدس', 'حمص', 'لوبيا', 'فاصوليا', 'فاصولياء', 'بسلة', 'بسله', 'بازلاء'
        ],
        'product_name_regex': r'\b(?:beans?|lentils?|peas?|chickpeas?|pulses?|fava|lupin|soy|soya)\b|فول|عدس|حمص|لوبيا|فاصولي|بسل|بازلا|بقول'
    },
    'fruits_vegetables': {
        'name_en': 'Fruits & Vegetables',
        'name_ar': 'الخضار والفواكه',
        'keywords': [
            'fruits', 'fruit', 'vegetables', 'vegetable', 'veggies', 'greens',
            'خضار', 'خضروات', 'فواكه', 'فاكهة', 'فاكهه'
        ],
        'categories_en': ['Fruits & Vegetables'],
        'categories_ar': ['الخضار والفواكه', 'الخضار والواكه']
    },
    'beverages': {
        'name_en': 'Beverages',
        'name_ar': 'المشروبات',
        'keywords': [
            'beverage', 'beverages', 'drink', 'drinks', 'juice', 'juices', 'soda', 'water', 'soft drink',
            'مشروب', 'مشروبات', 'عصير', 'عصائر', 'ماء', 'مياه', 'صودا', 'مياه غازية'
        ],
        'categories_en': ['Beverages'],
        'categories_ar': ['المشروبات']
    },
    'biscuits_snacks': {
        'name_en': 'Biscuits, Crackers & Cakes',
        'name_ar': 'بسكويت وكيك وسناكس',
        'keywords': [
            'biscuit', 'biscuits', 'snack', 'snacks', 'cracker', 'crackers', 'cake', 'cakes', 'cookies',
            'بسكويت', 'بسكوت', 'كيك', 'سناكس', 'مقرمشات', 'شيبس'
        ],
        'subcategories_en': ['Biscuits, Crackers & Cakes'],
        'subcategories_ar': ['بسكويت، كراكرز وكيك']
    },
    'pasta_rice': {
        'name_en': 'Rice & Pasta',
        'name_ar': 'الأرز والمعكرونة',
        'keywords': [
            'pasta', 'macaroni', 'spaghetti', 'rice', 'noodles', 'couscous',
            'مكرونة', 'مكرونه', 'معكرونة', 'معكرونه', 'ارز', 'أرز', 'رز', 'اندومي', 'كسكسي'
        ],
        'product_name_regex': r'\b(?:pasta|spaghetti|macaroni|rice|noodles?|couscous)\b|مكرون|معكرون|سباجيتي|أرز|ارز|\bرز\b|كسكسي'
    },
    'condiments': {
        'name_en': 'Condiments & Sauces',
        'name_ar': 'توابل وصلصات',
        'keywords': [
            'sauce', 'condiment', 'ketchup', 'mayo', 'dressing', 'vinegar', 'spice', 'spices',
            'صلصة', 'صلصه', 'كاتشب', 'مايونيز', 'خل', 'توابل', 'بهارات'
        ],
        'subcategories_en': ['Condiments, Dressings & Marinades'],
        'subcategories_ar': ['توابل، صلصات و خل']
    },
    'frozen': {
        'name_en': 'Frozen Food',
        'name_ar': 'أطعمة مجمدة',
        'keywords': [
            'frozen', 'مجمد', 'مجمدة', 'مجمده', 'مثلج'
        ],
        'categories_en': ['Frozen Food'],
        'categories_ar': ['أطعمة مجمّدة']
    }
}


def extract_requested_categories(text: str) -> List[str]:
    """
    Identifies which category keys the user is asking for in the text.
    Handles 'only' / 'فقط' restrictions and multiple category combinations.
    """
    if not text:
        return []

    norm = text.lower()
    # Normalize Arabic alefs, teh marbuta
    norm = re.sub(r'[إأآا]', 'ا', norm)
    norm = re.sub(r'ة', 'ه', norm)
    norm = re.sub(r'ى', 'ي', norm)

    detected = []
    for cat_key, cat_data in CATEGORY_DEFINITIONS.items():
        for kw in cat_data['keywords']:
            kw_norm = re.sub(r'[إأآا]', 'ا', kw.lower())
            kw_norm = re.sub(r'ة', 'ه', kw_norm)
            kw_norm = re.sub(r'ى', 'ي', kw_norm)
            # Use word boundary or substring match for Arabic words
            if re.search(r'\b' + re.escape(kw_norm) + r'\b', norm) or (len(kw_norm) >= 4 and kw_norm in norm):
                if cat_key not in detected:
                    detected.append(cat_key)
                break

    return detected


def is_product_in_category(product: Dict[str, Any], cat_key: str) -> bool:
    """Checks whether a single product dict satisfies a given category key."""
    cat_data = CATEGORY_DEFINITIONS.get(cat_key)
    if not cat_data:
        return False

    subcat_en = (product.get('subcategory_en') or '').strip()
    subcat_ar = (product.get('subcategory_ar') or '').strip()
    cat_en = (product.get('category_en') or '').strip()
    cat_ar = (product.get('category_ar') or '').strip()
    name_en = (product.get('name_en') or '').strip().lower()
    name_ar = (product.get('name_ar') or '').strip()

    if cat_key == 'dairy':
        # Must NOT be biscuits, crackers, cakes, or chocolates
        if subcat_en in ['Biscuits, Crackers & Cakes', 'Condiments, Dressings & Marinades', 'Juices', 'Soft Drinks']:
            return False
        if subcat_en == 'Dairy & Eggs' or subcat_ar == 'منتجات الألبان والبيض':
            return True
        if cat_en == 'Fresh Food' and (
            any(w in name_en for w in ['cheese', 'milk', 'yogurt', 'yoghurt', 'ghee', 'labneh', 'zabado']) or
            any(w in name_ar for w in ['جبن', 'لبن', 'زبادي', 'سمن', 'لبنة', 'زبادو'])
        ):
            return True
        return False

    if cat_key == 'legumes':
        # Must NOT be biscuits, crackers, cakes, or chocolates
        if subcat_en in ['Biscuits, Crackers & Cakes', 'Condiments, Dressings & Marinades', 'Juices', 'Soft Drinks']:
            return False
        # Must specifically be pulses/legumes, not peach or general items
        # Avoid fruit peaches matching
        name_en_clean = re.sub(r'\bpeach(?:es)?\b', '', name_en)
        reg = cat_data.get('product_name_regex')
        if reg and (re.search(reg, name_en_clean) or re.search(reg, name_ar)):
            return True
        return False

    if cat_key == 'pasta_rice':
        reg = cat_data.get('product_name_regex')
        if reg and (re.search(reg, name_en) or re.search(reg, name_ar)):
            return True
        return False

    if 'categories_en' in cat_data:
        if cat_en in cat_data['categories_en'] or cat_ar in cat_data.get('categories_ar', []):
            return True

    if 'subcategories_en' in cat_data:
        if subcat_en in cat_data['subcategories_en'] or subcat_ar in cat_data.get('subcategories_ar', []):
            return True

    return False


def filter_products_strictly(products: List[Dict[str, Any]], requested_categories: List[str]) -> List[Dict[str, Any]]:
    """
    Applies STRICT filtering:
    - Products must match at least one of the requested categories.
    - Any product belonging to unrelated categories is strictly excluded.
    - If requested_categories is empty, returns all products without filtering.
    """
    if not requested_categories:
        return products

    filtered = []
    for prod in products:
        for cat in requested_categories:
            if is_product_in_category(prod, cat):
                filtered.append(prod)
                break
    return filtered
