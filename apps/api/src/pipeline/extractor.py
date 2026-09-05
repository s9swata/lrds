import re
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple

try:
    from src.pipeline.lexicon import STATUTORY_LEXICONS
    from src.pipeline.normalizer import normalize_indic_numerals, parse_indic_date, parse_land_area
    from src.pipeline.nlp_pipeline import IndicDocumentNLP
except ImportError:
    from .lexicon import STATUTORY_LEXICONS
    from .normalizer import normalize_indic_numerals, parse_indic_date, parse_land_area
    from .nlp_pipeline import IndicDocumentNLP


@dataclass
class ExtractedField:
    value: Optional[str]
    raw: Optional[str]
    confidence: float
    source: str = "lexicon_spatial_rule"


@dataclass
class ExtractedOwner:
    name: str
    relation: str = "Primary Owner / Pattadar"
    guardian_name: Optional[str] = None
    raw: Optional[str] = None
    confidence: float = 0.85


@dataclass
class LandRecordCertificate:
    owners: List[Dict[str, Any]] = field(default_factory=list)
    survey_number: Optional[Dict[str, Any]] = None
    khata_number: Optional[Dict[str, Any]] = None
    area_extent: Optional[Dict[str, Any]] = None
    registration_date: Optional[Dict[str, Any]] = None
    issue_date: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    document_type: str = "other"
    detected_language: str = "en"
    detected_script: str = "Latin"
    overall_confidence: float = 0.0
    verification_status: str = "NEEDS_REVIEW"  # NEEDS_REVIEW or VERIFIED
    extraction_engine: str = "Indic_NLP_Transformers_v1"


class LandRecordExtractor:
    """
    Hybrid NLP Extractor for Indian Land Records combining:
    1. Indic NLP Library (Unicode normalization & script tokenization)
    2. Hugging Face Transformers (Pretrained Multilingual Named Entity Recognition for narrative text)
    3. Statutory Revenue Lexicon (Deterministic slot-filling for standard forms)
    """

    def __init__(self):
        self.nlp = IndicDocumentNLP()

    def _get_search_terms_for_category(self, category: str, language_code: str) -> List[str]:
        cat_dict = STATUTORY_LEXICONS.get(category, {})
        terms = []
        if language_code in cat_dict:
            terms.extend(cat_dict[language_code])
        if "en" in cat_dict:
            terms.extend(cat_dict["en"])
        if language_code not in cat_dict:
            for lang, t_list in cat_dict.items():
                terms.extend(t_list)
        unique_terms = list(dict.fromkeys(terms))
        unique_terms.sort(key=len, reverse=True)
        return unique_terms

    def _extract_value_after_anchor(self, line: str, anchor_terms: List[str]) -> Optional[Tuple[str, str, float]]:
        """
        Looks for an anchor term and extracts the value immediately following it.
        Returns: (raw_value, normalized_value, confidence)
        """
        line_clean = line.strip()
        line_norm = normalize_indic_numerals(line_clean)

        for term in anchor_terms:
            term_norm = normalize_indic_numerals(term)
            idx = line_norm.lower().find(term_norm.lower())
            if idx != -1:
                val_start = idx + len(term_norm)
                raw_val = line_clean[val_start:].strip(" :|-—=ঃ")
                norm_val = line_norm[val_start:].strip(" :|-—=ঃ")

                raw_val = re.sub(r"^[:|\-—=\sঃ]+", "", raw_val)
                norm_val = re.sub(r"^[:|\-—=\sঃ]+", "", norm_val)

                if raw_val:
                    parts = re.split(r"[|\n;]", raw_val)
                    clean_raw = parts[0].strip(" :|-—=ঃ")
                    clean_norm = normalize_indic_numerals(clean_raw)

                    if len(clean_raw) > 0:
                        return clean_raw, clean_norm, 0.88
        return None

    def extract(
        self,
        raw_text: str,
        detected_language: str = "en",
        detected_script: str = "Latin",
        state: Optional[str] = None,
        district: Optional[str] = None,
        document_type: str = "other",
        ocr_confidence: float = 80.0,
    ) -> Dict[str, Any]:
        """
        Processes OCR text through the Indic NLP normalizer, statutory lexicon engine,
        date parser, and Transformers NER for narrative sentences.
        """
        if not raw_text:
            return asdict(LandRecordCertificate(document_type=document_type))

        # 1. Indic NLP Normalization
        normalized_full_text = self.nlp.normalize_indic_text(raw_text, lang=detected_language)
        lines = [line.strip() for line in normalized_full_text.splitlines() if line.strip()]

        owners: List[Dict[str, Any]] = []
        survey_number: Optional[Dict[str, Any]] = None
        khata_number: Optional[Dict[str, Any]] = None
        area_extent: Optional[Dict[str, Any]] = None
        registration_date: Optional[Dict[str, Any]] = None
        issue_date: Optional[Dict[str, Any]] = None
        village: Optional[str] = None

        survey_terms = self._get_search_terms_for_category("SURVEY_NUMBER", detected_language)
        khata_terms = self._get_search_terms_for_category("KHATA_NUMBER", detected_language)
        owner_terms = self._get_search_terms_for_category("OWNER_PATTADAR", detected_language)
        area_terms = self._get_search_terms_for_category("AREA_EXTENT", detected_language)
        village_terms = self._get_search_terms_for_category("VILLAGE_MOUZA", detected_language)
        reg_date_terms = self._get_search_terms_for_category("REGISTRATION_DATE", detected_language)
        issue_date_terms = self._get_search_terms_for_category("ISSUE_DATE", detected_language)

        # 2. Rule & Lexicon Slot-Filling Pass
        for line in lines:
            # Check for Survey / Khasra Number
            if not survey_number:
                res = self._extract_value_after_anchor(line, survey_terms)
                if res:
                    raw_v, norm_v, conf = res
                    match = re.search(r"(\d+(?:[/-]\d+)*[a-zA-Z]?)", norm_v)
                    val = match.group(1) if match else norm_v
                    if val and len(val) > 0 and not any(k in val.lower() for k in ["তথ্য", "দাগের"]):
                        survey_number = {
                            "value": val,
                            "raw": raw_v,
                            "confidence": round(conf * (ocr_confidence / 100.0), 2),
                            "source": "lexicon_rule",
                        }

            # Check for Khata / Patta Number
            if not khata_number:
                res = self._extract_value_after_anchor(line, khata_terms)
                if res:
                    raw_v, norm_v, conf = res
                    match = re.search(r"(\d+(?:[/-]\d+)*)", norm_v)
                    val = match.group(1) if match else norm_v
                    if val and len(val) > 0 and not any(k in val.lower() for k in ["তথ্য", "দাগের"]):
                        khata_number = {
                            "value": val,
                            "raw": raw_v,
                            "confidence": round(conf * (ocr_confidence / 100.0), 2),
                            "source": "lexicon_rule",
                        }

            # Check for Owner / Pattadar Name
            if not owners:
                res = self._extract_value_after_anchor(line, owner_terms)
                if res:
                    raw_v, norm_v, conf = res
                    guardian = None
                    for f_term in ["s/o", "w/o", "d/o", "পিতা", "पिता"]:
                        if f_term in raw_v.lower():
                            parts = re.split(re.escape(f_term), raw_v, flags=re.IGNORECASE)
                            if len(parts) > 1:
                                raw_v = parts[0].strip(" :|-—=ঃ")
                                guardian = parts[1].strip(" :|-—=ঃ")
                            break

                    owners.append(
                        {
                            "name": raw_v,
                            "relation": "Pattadar / Khatedar",
                            "guardian_name": guardian,
                            "raw": raw_v,
                            "confidence": round(conf * (ocr_confidence / 100.0), 2),
                        }
                    )

            # Check for Area / Extent
            if not area_extent:
                res = self._extract_value_after_anchor(line, area_terms)
                if res:
                    parsed_area = parse_land_area(res[0], state=state)
                    if parsed_area.get("value") is not None:
                        area_extent = {
                            "raw": parsed_area["raw_text"],
                            "value": parsed_area["value"],
                            "unit": parsed_area["unit"],
                            "sq_meters": parsed_area["sq_meters"],
                            "confidence": round(0.85 * (ocr_confidence / 100.0), 2),
                        }
                elif any(u in line.lower() for u in ["একর", "acre", "বিঘা", "bigha", "শতক", "guntha", "gunta", "cent"]):
                    parsed_area = parse_land_area(line, state=state)
                    if parsed_area.get("value") is not None:
                        area_extent = {
                            "raw": parsed_area["raw_text"],
                            "value": parsed_area["value"],
                            "unit": parsed_area["unit"],
                            "sq_meters": parsed_area["sq_meters"],
                            "confidence": round(0.80 * (ocr_confidence / 100.0), 2),
                        }

            # Check for Registration / Execution Date
            if not registration_date:
                res = self._extract_value_after_anchor(line, reg_date_terms)
                date_input = res[0] if res else line
                parsed_d = parse_indic_date(date_input)
                if parsed_d.get("iso"):
                    registration_date = {
                        "value": parsed_d["iso"],
                        "raw": parsed_d["raw"],
                        "confidence": round(0.90 * (ocr_confidence / 100.0), 2),
                    }

            # Check for Certified Copy Issue Date
            if not issue_date:
                res = self._extract_value_after_anchor(line, issue_date_terms)
                if res:
                    parsed_d = parse_indic_date(res[0])
                    if parsed_d.get("iso"):
                        issue_date = {
                            "value": parsed_d["iso"],
                            "raw": parsed_d["raw"],
                            "confidence": round(0.88 * (ocr_confidence / 100.0), 2),
                        }

            # Check for Village / Mouza
            if not village:
                res = self._extract_value_after_anchor(line, village_terms)
                if res:
                    village = res[0]

        # 3. Transformer Named Entity Recognition Pass (for narrative prose)
        if not owners or not village:
            ner_entities = self.nlp.extract_named_entities(normalized_full_text, lang=detected_language)
            for ent in ner_entities:
                if ent["label"] == "PER" and not owners:
                    owners.append(
                        {
                            "name": ent["text"],
                            "relation": "Named Person / Party",
                            "guardian_name": None,
                            "raw": ent["text"],
                            "confidence": round(ent["confidence"] * (ocr_confidence / 100.0), 2),
                        }
                    )
                elif ent["label"] == "LOC" and not village:
                    village = ent["text"]

        # Calculate Overall Extraction Confidence
        field_scores = []
        if owners:
            field_scores.append(owners[0]["confidence"])
        if survey_number:
            field_scores.append(survey_number["confidence"])
        if khata_number:
            field_scores.append(khata_number["confidence"])
        if area_extent:
            field_scores.append(area_extent["confidence"])
        if registration_date:
            field_scores.append(registration_date["confidence"])

        overall_conf = round(sum(field_scores) / len(field_scores), 2) if field_scores else 0.0
        is_verified = bool(len(field_scores) >= 2 and overall_conf >= 0.60)
        status_label = "VERIFIED" if is_verified else "NEEDS_REVIEW"

        certificate = LandRecordCertificate(
            owners=owners,
            survey_number=survey_number,
            khata_number=khata_number,
            area_extent=area_extent,
            registration_date=registration_date,
            issue_date=issue_date,
            location={
                "village": village,
                "district": district,
                "state": state,
            },
            document_type=document_type,
            detected_language=detected_language,
            detected_script=detected_script,
            overall_confidence=overall_conf,
            verification_status=status_label,
            extraction_engine="Indic_NLP_Transformers_v1",
        )

        return asdict(certificate)
