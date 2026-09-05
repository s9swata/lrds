import re
from typing import Dict, List, Optional, Tuple

# Unicode range definitions for Indian Scripts (including digits and vowel signs)
INDIC_SCRIPT_RANGES = {
    "Devanagari": (0x0900, 0x097F),
    "Bengali": (0x0980, 0x09FF),
    "Gurmukhi": (0x0A00, 0x0A7F),
    "Gujarati": (0x0A80, 0x0AFF),
    "Odia": (0x0B00, 0x0B7F),
    "Tamil": (0x0B80, 0x0BFF),
    "Telugu": (0x0C00, 0x0C7F),
    "Kannada": (0x0C80, 0x0CFF),
    "Malayalam": (0x0D00, 0x0D7F),
    "Urdu_Arabic": (0x0600, 0x06FF),
    "Latin": (0x0041, 0x007A),
}

# State to primary regional language/script mapping
STATE_LANGUAGE_MAPPING: Dict[str, Dict[str, str]] = {
    "karnataka": {"code": "kn", "name": "Kannada", "script": "Kannada", "tess": "kan"},
    "maharashtra": {"code": "mr", "name": "Marathi", "script": "Devanagari", "tess": "mar"},
    "tamil nadu": {"code": "ta", "name": "Tamil", "script": "Tamil", "tess": "tam"},
    "andhra pradesh": {"code": "te", "name": "Telugu", "script": "Telugu", "tess": "tel"},
    "telangana": {"code": "te", "name": "Telugu", "script": "Telugu", "tess": "tel"},
    "west bengal": {"code": "bn", "name": "Bengali", "script": "Bengali", "tess": "ben"},
    "bengal": {"code": "bn", "name": "Bengali", "script": "Bengali", "tess": "ben"},
    "gujarat": {"code": "gu", "name": "Gujarati", "script": "Gujarati", "tess": "guj"},
    "punjab": {"code": "pa", "name": "Punjabi", "script": "Gurmukhi", "tess": "pan"},
    "kerala": {"code": "ml", "name": "Malayalam", "script": "Malayalam", "tess": "mal"},
    "odisha": {"code": "or", "name": "Odia", "script": "Odia", "tess": "ori"},
    "uttar pradesh": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "madhya pradesh": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "rajasthan": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "bihar": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "haryana": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "delhi": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "himachal pradesh": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "jharkhand": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "chhattisgarh": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "uttarakhand": {"code": "hi", "name": "Hindi", "script": "Devanagari", "tess": "hin"},
    "assam": {"code": "as", "name": "Assamese", "script": "Bengali", "tess": "asm"},
    "jammu and kashmir": {"code": "ur", "name": "Urdu", "script": "Urdu_Arabic", "tess": "urd"},
    "goa": {"code": "kok", "name": "Konkani", "script": "Devanagari", "tess": "kok"},
}

# Script to default ISO language code mapping
SCRIPT_TO_DEFAULT_LANG: Dict[str, Tuple[str, str]] = {
    "Devanagari": ("hi", "Hindi / Marathi"),
    "Bengali": ("bn", "Bengali"),
    "Kannada": ("kn", "Kannada"),
    "Tamil": ("ta", "Tamil"),
    "Telugu": ("te", "Telugu"),
    "Gujarati": ("gu", "Gujarati"),
    "Gurmukhi": ("pa", "Punjabi"),
    "Malayalam": ("ml", "Malayalam"),
    "Odia": ("or", "Odia"),
    "Urdu_Arabic": ("ur", "Urdu"),
    "Latin": ("en", "English"),
}


def detect_script_from_text(text: str) -> Tuple[str, str, float]:
    """
    Analyzes Unicode character distribution to identify the dominant script.
    Weights Indic script characters over ASCII/Latin noise.
    Returns: (script_name, default_lang_code, confidence_ratio)
    """
    if not text or not text.strip():
        return "Latin", "en", 1.0

    counts: Dict[str, int] = {script: 0 for script in INDIC_SCRIPT_RANGES}
    total_letters = 0

    for char in text:
        cp = ord(char)
        # Skip whitespace and ASCII punctuation/ASCII digits 0-9
        if char.isspace() or (ord('0') <= cp <= ord('9')) or char in ".,:-/()[]{}_#*+=|\\\"'~`^<>":
            continue

        for script, (start, end) in INDIC_SCRIPT_RANGES.items():
            if start <= cp <= end:
                counts[script] += 1
                total_letters += 1
                break

    if total_letters == 0:
        return "Latin", "en", 1.0

    # Separate Indic counts from Latin counts
    indic_counts = {k: v for k, v in counts.items() if k != "Latin"}
    dominant_indic_script, max_indic_count = max(indic_counts.items(), key=lambda item: item[1])

    # If Indic script has meaningful presence (> 5 characters or > 15% of all letters), select Indic script
    if max_indic_count >= 5 or (max_indic_count / float(total_letters) >= 0.15):
        dominant_script = dominant_indic_script
        confidence = max_indic_count / float(total_letters)
    else:
        dominant_script, max_count = max(counts.items(), key=lambda item: item[1])
        confidence = max_count / float(total_letters)

    lang_code, _ = SCRIPT_TO_DEFAULT_LANG.get(dominant_script, ("en", "English"))
    return dominant_script, lang_code, round(confidence, 3)


def infer_language_from_location(state: Optional[str]) -> Optional[Dict[str, str]]:
    """
    Infers the official regional language and script from state metadata.
    """
    if not state:
        return None

    normalized_state = state.strip().lower()
    for s_name, data in STATE_LANGUAGE_MAPPING.items():
        if s_name in normalized_state or normalized_state in s_name:
            return data

    return None


def resolve_document_language_and_script(
    extracted_text: str,
    state: Optional[str] = None,
    district: Optional[str] = None,
) -> Dict[str, str]:
    """
    Combines Unicode script frequency from OCR text with geographic metadata
    to determine the document's true language, script, and display name.
    """
    script_name, default_lang, confidence = detect_script_from_text(extracted_text)
    state_info = infer_language_from_location(state)

    final_lang_code = default_lang
    final_script_name = script_name
    final_display_name = SCRIPT_TO_DEFAULT_LANG.get(script_name, ("en", "English"))[1]

    # If document has non-Latin Indic script, refine language using state context
    if script_name == "Devanagari":
        if state_info and state_info["script"] == "Devanagari":
            final_lang_code = state_info["code"]
            final_display_name = state_info["name"]
        else:
            final_lang_code = "hi"
            final_display_name = "Hindi / Marathi (Devanagari)"
    elif script_name != "Latin":
        if state_info and state_info["script"] == script_name:
            final_lang_code = state_info["code"]
            final_display_name = state_info["name"]
        else:
            final_display_name = SCRIPT_TO_DEFAULT_LANG.get(script_name, ("en", script_name))[1]
    else:
        if state_info:
            final_display_name = f"English ({state_info['name']} Jurisdiction)"
        else:
            final_display_name = "English"

    return {
        "language_code": final_lang_code,
        "script": final_script_name,
        "language_name": final_display_name,
        "confidence": str(confidence),
    }
