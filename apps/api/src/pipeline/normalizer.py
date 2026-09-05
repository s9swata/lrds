import re
from typing import Dict, Optional, Tuple

# Mapping of Indic numerals to standard Arabic digits
INDIC_NUMERAL_MAP = {
    # Bengali / Assamese
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    # Devanagari (Hindi, Marathi, Sanskrit)
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    # Kannada
    '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
    '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9',
    # Tamil
    '௦': '0', '௧': '1', '௨': '2', '௩': '3', '௪': '4',
    '௫': '5', '௬': '6', '௭': '7', '௮': '8', '௯': '9',
    # Telugu
    '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
    '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9',
    # Gujarati
    '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4',
    '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',
    # Gurmukhi
    '੦': '0', '੧': '1', '੨': '2', '੩': '3', '੪': '4',
    '੫': '5', '௬': '6', '੭': '7', '௮': '8', '੯': '9',
    # Odia
    '୦': '0', '୧': '1', '୨': '2', '୩': '3', '੪': '4',
    '୫': '5', '୬': '6', '୭': '7', '୮': '8', '୯': '9',
    # Malayalam
    '൦': '0', '൧': '1', '൨': '2', '൩': '3', '൪': '4',
    '൫': '5', '൬': '6', '൭': '7', '൮': '8', '൯': '9',
}

# Regional area unit multipliers to Square Meters
UNIT_CONVERSIONS_TO_SQM: Dict[str, Dict[str, float]] = {
    "west bengal": {
        "bigha": 1333.33,
        "katha": 66.67,
        "chatak": 4.167,
        "acre": 4046.86,
        "satak": 40.47,
        "decimal": 40.47,
        "hectare": 10000.0,
    },
    "karnataka": {
        "acre": 4046.86,
        "gunta": 101.17,
        "guntha": 101.17,
        "cent": 40.47,
        "sq_feet": 0.0929,
        "sq_meter": 1.0,
        "hectare": 10000.0,
    },
    "maharashtra": {
        "hectare": 10000.0,
        "are": 100.0,
        "r": 100.0,
        "gunta": 101.17,
        "guntha": 101.17,
        "acre": 4046.86,
        "sq_meter": 1.0,
    },
    "default": {
        "acre": 4046.86,
        "hectare": 10000.0,
        "sq_meter": 1.0,
        "sq_feet": 0.0929,
        "cent": 40.47,
        "decimal": 40.47,
        "bigha": 2500.0,
        "biswa": 125.0,
    },
}

# Multi-lingual Month Name Mapping to '01' - '12'
MONTH_NAME_MAP: Dict[str, str] = {
    # Bengali
    "জানুয়ারি": "01", "ফেব্রুয়ারি": "02", "মার্চ": "03", "এপ্রিল": "04",
    "মে": "05", "জুন": "06", "জুলাই": "07", "আগস্ট": "08",
    "সেপ্টেম্বর": "09", "অক্টোবর": "10", "নভেম্বর": "11", "ডিসেম্বর": "12",
    # Hindi / Devanagari
    "जनवरी": "01", "फरवरी": "02", "मार्च": "03", "अप्रैल": "04",
    "मई": "05", "जून": "06", "जुलाई": "07", "अगस्त": "08",
    "सितंबर": "09", "अक्टूबर": "10", "नवंबर": "11", "दिसंबर": "12",
    # English
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def normalize_indic_numerals(text: str) -> str:
    """Converts any Indic script digits in text into standard Arabic digits (0-9)."""
    if not text:
        return ""
    result = []
    for char in text:
        result.append(INDIC_NUMERAL_MAP.get(char, char))
    return "".join(result)


def parse_indic_date(raw_date_text: str) -> Dict[str, Optional[str]]:
    """
    Parses dates in Indian land records written with Indic digits or regional month names.
    Supports:
    - '২৮ শে অক্টোবর ২০০১' -> '2001-10-28'
    - '১১/৩/২০১০' -> '2010-03-11'
    - '28-10-2001' -> '2001-10-28'
    Returns: { "raw": raw_date_text, "iso": "YYYY-MM-DD" or None }
    """
    if not raw_date_text or not raw_date_text.strip():
        return {"raw": None, "iso": None}

    raw_clean = raw_date_text.strip()
    norm_text = normalize_indic_numerals(raw_clean)

    # 1. Numeric format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    num_match = re.search(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", norm_text)
    if num_match:
        d, m, y = int(num_match.group(1)), int(num_match.group(2)), int(num_match.group(3))
        if 1 <= d <= 31 and 1 <= m <= 12 and 1800 <= y <= 2100:
            return {"raw": raw_clean, "iso": f"{y:04d}-{m:02d}-{d:02d}"}

    # 2. Text month format (e.g. '২৮ শে অক্টোবর ২০০১' or '28th October 2001')
    for m_name, m_code in MONTH_NAME_MAP.items():
        if m_name in raw_clean.lower() or m_name in norm_text.lower():
            # Look for day and year around the month name
            day_match = re.search(r"(\d{1,2})\s*(?:শে|ই|তম|th|st|nd|rd)?\s*" + re.escape(m_name), norm_text, re.IGNORECASE)
            year_match = re.search(re.escape(m_name) + r"\s*(\d{4})", norm_text, re.IGNORECASE)

            day = int(day_match.group(1)) if day_match else None
            year = int(year_match.group(1)) if year_match else None

            # Broader search for year if not immediate
            if not year:
                all_years = re.findall(r"\b(18\d{2}|19\d{2}|20\d{2})\b", norm_text)
                if all_years:
                    year = int(all_years[-1])

            if day and year and 1 <= day <= 31 and 1800 <= year <= 2100:
                return {"raw": raw_clean, "iso": f"{year:04d}-{int(m_code):02d}-{day:02d}"}

    return {"raw": raw_clean, "iso": None}


def parse_land_area(
    raw_area_text: str,
    state: Optional[str] = None,
) -> Dict[str, Optional[float]]:
    """
    Parses complex and compound land area strings.
    """
    if not raw_area_text:
        return {"raw_text": None, "value": None, "unit": None, "sq_meters": None}

    normalized_text = normalize_indic_numerals(raw_area_text.strip().lower())
    state_key = state.strip().lower() if state else "default"
    conversion_table = UNIT_CONVERSIONS_TO_SQM.get(state_key, UNIT_CONVERSIONS_TO_SQM["default"])

    number_pattern = r"(\d+(?:\.\d+)?)"

    area_sqm = 0.0
    found_unit = None
    primary_value = None

    unit_synonyms = {
        "acre": ["acre", "acres", "একর", "ಎಕರೆ", "एकर", "ஏக்கர்"],
        "hectare": ["hectare", "hectares", "হেক্টর", "ಹೆಕ್ಟೇರ್", "हेक्टर", "हे."],
        "bigha": ["bigha", "বিঘা", "बीघा"],
        "katha": ["katha", "কাঠা", "कट्ठा"],
        "gunta": ["gunta", "guntas", "guntha", "గుంట", "ಗುಂಟೆ", "गुंठा", "गुंटे"],
        "cent": ["cent", "cents", "சென்ட்", "సెంట్"],
        "decimal": ["decimal", "শতক", "ডেসিমাল", "ডেসি."],
        "are": ["are", "आर", "आ."],
    }

    matched_any = False
    for standard_unit, keywords in unit_synonyms.items():
        for kw in keywords:
            pattern = rf"{number_pattern}\s*{re.escape(kw)}"
            match = re.search(pattern, normalized_text)
            if match:
                val = float(match.group(1))
                if primary_value is None:
                    primary_value = val
                    found_unit = standard_unit
                unit_sqm = conversion_table.get(standard_unit, 1.0)
                area_sqm += val * unit_sqm
                matched_any = True
                break

    if not matched_any:
        num_match = re.search(number_pattern, normalized_text)
        if num_match:
            primary_value = float(num_match.group(1))
            found_unit = "Unspecified Unit"
            area_sqm = None

    return {
        "raw_text": raw_area_text.strip(),
        "value": primary_value,
        "unit": found_unit or "Unspecified",
        "sq_meters": round(area_sqm, 2) if area_sqm is not None and area_sqm > 0 else None,
    }
