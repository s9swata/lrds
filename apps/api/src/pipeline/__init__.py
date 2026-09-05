try:
    from src.pipeline.preprocessor import DocumentPreprocessor
    from src.pipeline.types import PreprocessingConfig, PreprocessingResult
    from src.pipeline.ocr import OCRProcessor, OCRResult, OCRLineBox
    from src.pipeline.script_detector import (
        detect_script_from_text,
        infer_language_from_location,
        resolve_document_language_and_script,
    )
    from src.pipeline.normalizer import normalize_indic_numerals, parse_land_area
    from src.pipeline.lexicon import STATUTORY_LEXICONS
    from src.pipeline.extractor import LandRecordExtractor, LandRecordCertificate
except ImportError:
    from .preprocessor import DocumentPreprocessor
    from .types import PreprocessingConfig, PreprocessingResult
    from .ocr import OCRProcessor, OCRResult, OCRLineBox
    from .script_detector import (
        detect_script_from_text,
        infer_language_from_location,
        resolve_document_language_and_script,
    )
    from .normalizer import normalize_indic_numerals, parse_land_area
    from .lexicon import STATUTORY_LEXICONS
    from .extractor import LandRecordExtractor, LandRecordCertificate

__all__ = [
    "DocumentPreprocessor",
    "PreprocessingConfig",
    "PreprocessingResult",
    "OCRProcessor",
    "OCRResult",
    "OCRLineBox",
    "detect_script_from_text",
    "infer_language_from_location",
    "resolve_document_language_and_script",
    "normalize_indic_numerals",
    "parse_land_area",
    "STATUTORY_LEXICONS",
    "LandRecordExtractor",
    "LandRecordCertificate",
]
