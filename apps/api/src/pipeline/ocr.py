from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np

try:
    from src.pipeline.layout_segmenter import AdaptiveLayoutSegmenter
    from src.pipeline.script_detector import infer_language_from_location, resolve_document_language_and_script
except ImportError:
    from .layout_segmenter import AdaptiveLayoutSegmenter
    from .script_detector import infer_language_from_location, resolve_document_language_and_script

# Path to local tessdata containing Indic language models
API_DIR = Path(__file__).resolve().parent.parent.parent
LOCAL_TESSDATA_DIR = API_DIR / "tessdata"


@dataclass
class OCRLineBox:
    text: str
    confidence: float
    box: Optional[List[List[float]]] = None


@dataclass
class OCRResult:
    raw_text: str
    detected_language: str
    detected_script: str
    language_display_name: str
    confidence: float
    lines: List[OCRLineBox] = field(default_factory=list)
    engine: str = "Tesseract (Adaptive Multi-Column)"
    error: Optional[str] = None


class OCRProcessor:
    """
    Production-grade Multilingual OCR Processor for Indian Land Records & Deeds.
    Features:
    - Adaptive Layout Segmentation (separates top security stamp header & vertical column gutters)
    - Multi-pass Page Segmentation (PSM 4, 6, 11) for variable deed layouts
    - Script Isolation per column (Left: English Endorsements, Right: Regional Indic Deed Body)
    - High-resolution multi-scale contrast enhancement
    """

    def __init__(self, preferred_engine: str = "auto"):
        self.preferred_engine = preferred_engine.lower()
        self.layout_segmenter = AdaptiveLayoutSegmenter()
        self._rapid_ocr = None
        self._init_rapid_ocr()

    def _init_rapid_ocr(self):
        try:
            from rapidocr_onnxruntime import RapidOCR
            self._rapid_ocr = RapidOCR()
        except Exception:
            self._rapid_ocr = None

    def _load_image(self, image_input: Union[str, Path, np.ndarray]) -> np.ndarray:
        if isinstance(image_input, np.ndarray):
            return image_input

        path = Path(image_input)
        if not path.exists():
            raise FileNotFoundError(f"Image not found at {image_input}")

        img = cv2.imread(str(path))
        if img is None:
            raise ValueError(f"Failed to read image at {image_input}")
        return img

    def _determine_tesseract_languages(self, state: Optional[str] = None) -> str:
        """Determines target language pack for regional deed text."""
        state_info = infer_language_from_location(state)
        if state_info and "tess" in state_info:
            tess_code = state_info["tess"]
            if (LOCAL_TESSDATA_DIR / f"{tess_code}.traineddata").exists():
                return f"{tess_code}+eng"

        # Default to Bengali + Hindi + English if models present
        langs = ["eng"]
        for c in ["ben", "hin", "kan", "tam", "tel", "mar"]:
            if (LOCAL_TESSDATA_DIR / f"{c}.traineddata").exists():
                langs.insert(0, c)
                break
        return "+".join(langs)

    def _ocr_crop(
        self,
        bgr_crop: np.ndarray,
        lang_str: str = "eng",
        psm_modes: List[int] = [4, 6],
    ) -> Tuple[str, float]:
        import pytesseract

        gray = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2GRAY) if len(bgr_crop.shape) == 3 else bgr_crop
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        best_lines: List[str] = []
        best_conf = 0.0

        for psm in psm_modes:
            config_flags = f"--psm {psm}"
            if LOCAL_TESSDATA_DIR.exists():
                config_flags += f" --tessdata-dir {LOCAL_TESSDATA_DIR.resolve()}"

            try:
                data = pytesseract.image_to_data(
                    enhanced,
                    lang=lang_str,
                    config=config_flags,
                    output_type=pytesseract.Output.DICT,
                )
            except Exception:
                continue

            lines: List[str] = []
            confs: List[float] = []
            current_words: List[str] = []
            current_confs: List[float] = []

            for i in range(len(data["text"])):
                text = str(data["text"][i]).strip()
                conf = float(data["conf"][i])

                if text and conf > 0:
                    current_words.append(text)
                    current_confs.append(conf)
                    confs.append(conf)
                elif not text and current_words:
                    lines.append(" ".join(current_words))
                    current_words = []
                    current_confs = []

            if current_words:
                lines.append(" ".join(current_words))

            avg_conf = float(np.mean(confs)) if confs else 0.0
            if len("\n".join(lines)) > len("\n".join(best_lines)):
                best_lines = lines
                best_conf = avg_conf

        return "\n".join(best_lines).strip(), round(best_conf, 2)

    def extract_text(
        self,
        image_input: Union[str, Path, np.ndarray],
        state: Optional[str] = None,
        district: Optional[str] = None,
    ) -> OCRResult:
        """
        Runs adaptive layout segmentation followed by column-isolated OCR routing.
        """
        img = self._load_image(image_input)
        layout = self.layout_segmenter.segment_layout(img)

        indic_lang_pack = self._determine_tesseract_languages(state)
        extracted_sections: List[str] = []
        all_confidences: List[float] = []

        if len(layout.columns) >= 2:
            # Multi-column document (e.g. Left: English Endorsement, Right: Regional Deed)
            left_col = layout.columns[0]
            right_col = layout.columns[1]

            # 1. Left Column OCR (English Statutory Endorsement)
            left_text, left_conf = self._ocr_crop(left_col.crop, lang_str="eng", psm_modes=[4, 6])
            if left_text:
                extracted_sections.append(f"--- REGISTRATION ENDORSEMENT ---\n{left_text}")
                all_confidences.append(left_conf)

            # 2. Right Column OCR (Regional Indic Deed Schedule & Parties)
            right_text, right_conf = self._ocr_crop(right_col.crop, lang_str=indic_lang_pack, psm_modes=[4, 6, 11])
            if right_text:
                extracted_sections.append(f"--- PROPERTY SCHEDULE & DEED BODY ---\n{right_text}")
                all_confidences.append(right_conf)
        else:
            # Single-column document
            col_crop = layout.columns[0].crop if layout.columns else img
            col_text, col_conf = self._ocr_crop(col_crop, lang_str=indic_lang_pack, psm_modes=[4, 6, 11])
            if col_text:
                extracted_sections.append(col_text)
                all_confidences.append(col_conf)

        full_raw_text = "\n\n".join(extracted_sections).strip()
        overall_conf = round(float(np.mean(all_confidences)), 2) if all_confidences else 0.0

        # Script & Language Resolution from combined extracted text
        lang_metadata = resolve_document_language_and_script(
            extracted_text=full_raw_text,
            state=state,
            district=district,
        )

        return OCRResult(
            raw_text=full_raw_text,
            detected_language=lang_metadata["language_code"],
            detected_script=lang_metadata["script"],
            language_display_name=lang_metadata["language_name"],
            confidence=overall_conf,
            engine="Adaptive Multi-Column Layout Segmenter",
        )
