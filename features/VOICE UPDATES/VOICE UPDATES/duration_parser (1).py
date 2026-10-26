import re
from typing import Optional, Tuple, Dict, Any

# Arabic numeral map
ARABIC_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

# Written word maps
WORD_TO_NUMBER_EN = {
    'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'twenty': 20, 'thirty': 30, 'sixty': 60, 'ninety': 90
}

WORD_TO_NUMBER_AR = {
    'واحد': 1, 'واحدة': 1, 'اثنين': 2, 'إثنين': 2, 'اتنين': 2,
    'ثلاثة': 3, 'ثلاث': 3, 'تلاتة': 3, 'تلات': 3,
    'اربعة': 4, 'أربعة': 4, 'اربع': 4, 'أربع': 4,
    'خمسة': 5, 'خمس': 5,
    'ستة': 6, 'ست': 6,
    'سبعة': 7, 'سبع': 7,
    'ثمانية': 8, 'ثماني': 8, 'تمانية': 8, 'تمن': 8,
    'تسعة': 9, 'تسع': 9,
    'عشرة': 10, 'عشر': 10
}


def normalize_text(text: str) -> str:
    """Standardizes Arabic and English text for robust tokenization."""
    if not text:
        return ""
    text = text.translate(ARABIC_DIGITS)
    # Normalize Arabic alefs, teh marbuta, etc.
    text = re.sub(r'[إأآا]', 'ا', text)
    text = re.sub(r'ة', 'ه', text)
    text = re.sub(r'ى', 'ي', text)
    # Strip diacritics
    text = re.sub(r'[\u064B-\u0652]', '', text)
    return text.lower().strip()


def format_duration(days: int, lang: str = "en") -> str:
    """
    Normalizes internal day count to readable canonical duration labels.
    - 1 day -> 1 day
    - 7 days -> 1 week
    - 14 days -> 2 weeks
    - 21 days -> 3 weeks
    - 30 days -> 1 month
    - 60 days -> 2 months
    - 90 days -> 3 months
    - 180 days -> 6 months
    - 365 days -> 1 year
    - Exact days preserved if not mapped.
    """
    if lang == "ar":
        if days == 1:
            return "يوم واحد"
        elif days == 7:
            return "أسبوع واحد (1 week)"
        elif days == 14:
            return "أسبوعين (2 weeks)"
        elif days == 21:
            return "3 أسابيع (3 weeks)"
        elif days == 30:
            return "شهر واحد (1 month)"
        elif days == 60:
            return "شهرين (2 months)"
        elif days == 90:
            return "3 أشهر (3 months)"
        elif days == 180:
            return "6 أشهر (6 months)"
        elif days == 365:
            return "سنة واحدة (1 year)"
        else:
            return f"{days} يوم"
    else:
        if days == 1:
            return "1 day"
        elif days == 7:
            return "1 week"
        elif days == 14:
            return "2 weeks"
        elif days == 21:
            return "3 weeks"
        elif days == 30:
            return "1 month"
        elif days == 60:
            return "2 months"
        elif days == 90:
            return "3 months"
        elif days == 180:
            return "6 months"
        elif days == 365:
            return "1 year"
        else:
            return f"{days} days"


def parse_duration(text: str) -> Dict[str, Any]:
    """
    Parses a natural-language duration expression from English, Standard Arabic, or Egyptian Arabic.
    Returns:
    {
        'found': bool,
        'raw_expression': str,
        'days': Optional[float],
        'is_valid': bool,
        'error_reason': Optional[str],
        'readable_label_en': Optional[str],
        'readable_label_ar': Optional[str]
    }
    """
    if not text:
        return {'found': False, 'days': None, 'is_valid': True, 'error_reason': None}

    raw = text
    norm = normalize_text(text)

    # 1. Check explicitly rejected expressions listed in requirements:
    # "12 hours", "5 minutes", "12 seconds", "half a day", "half a year",
    # "one and a half years", "two years", "366 days", "any duration > 365 days".
    
    # Sub-day expressions (hours, minutes, seconds, half day)
    subday_patterns = [
        r'\b(?:half\s+(?:a\s+)?day|12\s*hours?|5\s*minutes?|12\s*seconds?)\b',
        r'نصف?\s*يوم',
        r'نص\s*يوم',
        r'\b\d+\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\b',
        r'\b\d+\s*(?:ساعه|ساعات|دقيقه|دقايق|ثواني)\b'
    ]
    for pat in subday_patterns:
        m = re.search(pat, norm)
        if m:
            return {
                'found': True,
                'raw_expression': m.group(0),
                'days': 0.5,
                'is_valid': False,
                'error_reason': "Duration less than 1 day. Supported range is 1 to 365 days.",
                'readable_label_en': m.group(0),
                'readable_label_ar': m.group(0)
            }

    # "Half a year" / "نصف سنة" explicitly rejected in requirements section 3
    half_year_patterns = [
        r'\bhalf\s+(?:a\s+)?year\b',
        r'نصف?\s*سنه',
        r'نص\s*سنه',
        r'نصف?\s*عام',
        r'نص\s*عام'
    ]
    for pat in half_year_patterns:
        m = re.search(pat, norm)
        if m:
            return {
                'found': True,
                'raw_expression': m.group(0),
                'days': 182.5,
                'is_valid': False,
                'error_reason': "Fractional duration 'half a year' is not supported. Please specify exact months (e.g. 6 months) or days between 1 and 365 days.",
                'readable_label_en': m.group(0),
                'readable_label_ar': m.group(0)
            }

    # Multi-year expressions explicitly rejected in section 3 (e.g. "two years", "one and a half years")
    multi_year_patterns = [
        r'\b(?:one\s+and\s+a\s+half|1\.5|two|2|three|3|four|4|five|5)\s+years?\b',
        r'سنه\s*و\s*نصف?',
        r'سنه\s*و\s*نص',
        r'سنتين',
        r'عامين',
        r'\d+\s*(?:سنين|سنوات|اعوام)'
    ]
    for pat in multi_year_patterns:
        m = re.search(pat, norm)
        if m:
            # Check number of years
            num_match = re.search(r'(\d+)', m.group(0))
            if num_match:
                y = int(num_match.group(1))
                if y > 1:
                    return {
                        'found': True,
                        'raw_expression': m.group(0),
                        'days': y * 365,
                        'is_valid': False,
                        'error_reason': "Duration greater than 365 days. Supported range is 1 to 365 days.",
                        'readable_label_en': m.group(0),
                        'readable_label_ar': m.group(0)
                    }
            return {
                'found': True,
                'raw_expression': m.group(0),
                'days': 730,
                'is_valid': False,
                'error_reason': "Duration greater than 365 days. Supported range is 1 to 365 days.",
                'readable_label_en': m.group(0),
                'readable_label_ar': m.group(0)
            }

    # 2. Extract valid and general duration expressions

    # Egyptian / Arabic special dual & single words
    # أسبوعين / اسبوعين -> 14 days
    if re.search(r'\b(?:اسبوعين|أسبوعين)\b', norm):
        return _build_res(14, "أسبوعين")

    # شهرين -> 60 days
    if re.search(r'\bشهرين\b', norm):
        return _build_res(60, "شهرين")

    # يومين -> 2 days
    if re.search(r'\bيومين\b', norm):
        return _build_res(2, "يومين")

    # سنة / سنه / عام واحد -> 365 days (1 year)
    if re.search(r'(?:لمده|لمدة|ل)?(?:سنه|سنة|عام)(?:\s+واحده|\s+واحد)?\b', norm):
        # ensure not followed by words like 2 or more
        return _build_res(365, "سنة واحدة")

    # شهر واحد / لشهر -> 30 days
    if re.search(r'(?:لمده|لمدة|ل)?شهر(?:\s+واحد)?\b', norm) and not re.search(r'\d+\s*شهر', norm):
        return _build_res(30, "شهر")

    # أسبوع واحد / لاسبوع -> 7 days
    if re.search(r'(?:لمده|لمدة|ل)?(?:اسبوع|أسبوع)(?:\s+واحد)?\b', norm) and not re.search(r'\d+\s*اسبوع', norm):
        return _build_res(7, "أسبوع")

    # يوم واحد / ليوم -> 1 day
    if re.search(r'(?:لمده|لمدة|ل)?يوم(?:\s+واحد)?\b', norm) and not re.search(r'\d+\s*يوم', norm):
        return _build_res(1, "يوم واحد")

    # Check textual English numbers like "one week", "two weeks", "six months", "one year"
    en_text_pat = r'\b(' + '|'.join(WORD_TO_NUMBER_EN.keys()) + r')\s+(day|days|week|weeks|month|months|year|years)\b'
    m_en = re.search(en_text_pat, norm)
    if m_en:
        num = WORD_TO_NUMBER_EN[m_en.group(1)]
        unit = m_en.group(2)
        days = _unit_to_days(num, unit)
        return _validate_and_build(days, m_en.group(0))

    # Check textual Arabic numbers like "ثلاثة شهور", "ستة اشهر", "سبعة ايام"
    ar_text_pat = r'\b(' + '|'.join(WORD_TO_NUMBER_AR.keys()) + r')\s*(ايام|يوم|اسابيع|اسبوع|اشهر|شهور|شهر|سنوات|سنين|سنه|عام)\b'
    m_ar = re.search(ar_text_pat, norm)
    if m_ar:
        num = WORD_TO_NUMBER_AR[m_ar.group(1)]
        unit = m_ar.group(2)
        days = _ar_unit_to_days(num, unit)
        return _validate_and_build(days, m_ar.group(0))

    # General numeric regex: e.g. "7 days", "30 يوم", "3 months", "1 year"
    num_pat = r'(\d+)\s*(days?|weeks?|months?|years?|يوم|ايام|أيام|اسبوع|أسبوع|اسابيع|أسابيع|شهر|شهور|أشهر|اشهر|سنه|سنة|سنوات|سنين|عام)'
    m_num = re.search(num_pat, norm)
    if m_num:
        num = int(m_num.group(1))
        unit = m_num.group(2)
        days = _any_unit_to_days(num, unit)
        return _validate_and_build(days, m_num.group(0))

    # No duration found in text
    return {
        'found': False,
        'raw_expression': None,
        'days': None,
        'is_valid': True,
        'error_reason': None,
        'readable_label_en': None,
        'readable_label_ar': None
    }


def _unit_to_days(num: int, unit: str) -> int:
    unit = unit.lower()
    if 'day' in unit:
        return num
    elif 'week' in unit:
        return num * 7
    elif 'month' in unit:
        return num * 30
    elif 'year' in unit:
        return num * 365
    return num


def _ar_unit_to_days(num: int, unit: str) -> int:
    unit = unit.lower()
    if any(u in unit for u in ['يوم', 'ايام']):
        return num
    elif any(u in unit for u in ['اسبوع', 'اسابيع']):
        return num * 7
    elif any(u in unit for u in ['شهر', 'شهور', 'اشهر']):
        return num * 30
    elif any(u in unit for u in ['سنه', 'سنة', 'سنوات', 'سنين', 'عام']):
        return num * 365
    return num


def _any_unit_to_days(num: int, unit: str) -> int:
    if any(u in unit for u in ['day', 'يوم', 'ايام', 'أيام']):
        return num
    elif any(u in unit for u in ['week', 'اسبوع', 'أسبوع', 'اسابيع', 'أسابيع']):
        return num * 7
    elif any(u in unit for u in ['month', 'شهر', 'شهور', 'أشهر', 'اشهر']):
        return num * 30
    elif any(u in unit for u in ['year', 'سنه', 'سنة', 'سنوات', 'سنين', 'عام']):
        return num * 365
    return num


def _build_res(days: int, raw_expr: str) -> Dict[str, Any]:
    return {
        'found': True,
        'raw_expression': raw_expr,
        'days': days,
        'is_valid': True,
        'error_reason': None,
        'readable_label_en': format_duration(days, "en"),
        'readable_label_ar': format_duration(days, "ar")
    }


def _validate_and_build(days: int, raw_expr: str) -> Dict[str, Any]:
    is_valid, reason = validate_duration(days)
    return {
        'found': True,
        'raw_expression': raw_expr,
        'days': days,
        'is_valid': is_valid,
        'error_reason': reason,
        'readable_label_en': format_duration(days, "en") if is_valid else raw_expr,
        'readable_label_ar': format_duration(days, "ar") if is_valid else raw_expr
    }


def validate_duration(days: Any) -> Tuple[bool, Optional[str]]:
    """
    Validates that duration is an integer within 1 to 365 days inclusive.
    Returns (is_valid, error_message).
    """
    if days is None:
        return False, "Duration cannot be empty."

    try:
        d = float(days)
    except (ValueError, TypeError):
        return False, "Invalid duration format. Must be a valid numerical period."

    if d < 1:
        return False, "Please choose a duration between 1 day and 365 days. You can specify the duration in days, weeks, months, or years."

    if d > 365:
        return False, "Please choose a duration between 1 day and 365 days. You can specify the duration in days, weeks, months, or years."

    return True, None
