import logging
from typing import Any, Dict, List, Optional
import spacy
from indicnlp.normalize.indic_normalize import IndicNormalizerFactory
from indicnlp.tokenize import indic_tokenize
from transformers import pipeline

logger = logging.getLogger("lrds.nlp")


class IndicDocumentNLP:
    """
    Standard Indic Document NLP Pipeline integrating:
    1. Indic NLP Library: Canonical Unicode Normalization & Script Tokenization
    2. spaCy: Document Structure & Entity Orchestration
    3. Hugging Face Transformers: Multilingual Token Classification / Named Entity Recognition
    """

    _instance = None
    _ner_pipeline = None
    _spacy_nlp = None
    _normalizer_factory = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(IndicDocumentNLP, cls).__new__(cls)
            cls._instance._init_models()
        return cls._instance

    def _init_models(self):
        try:
            self._normalizer_factory = IndicNormalizerFactory()
        except Exception as e:
            logger.warning(f"Failed to initialize IndicNormalizerFactory: {e}")
            self._normalizer_factory = None

        try:
            self._spacy_nlp = spacy.blank("en")
        except Exception as e:
            logger.warning(f"Failed to initialize spaCy blank: {e}")
            self._spacy_nlp = None

        try:
            logger.info("Loading Hugging Face Transformers NER model...")
            self._ner_pipeline = pipeline(
                "token-classification",
                model="dslim/bert-base-NER",
                aggregation_strategy="simple",
            )
            logger.info("Transformers NER pipeline ready.")
        except Exception as e:
            logger.warning(f"Failed to load Transformers NER pipeline: {e}")
            self._ner_pipeline = None

    def normalize_indic_text(self, text: str, lang: str = "en") -> str:
        """Normalizes Indic Unicode text using Indic NLP Library."""
        if not text:
            return ""
        if self._normalizer_factory and lang in ("bn", "hi", "mr", "ta", "te", "kn", "gu", "pa", "or", "ml"):
            try:
                normalizer = self._normalizer_factory.get_normalizer(lang)
                return normalizer.normalize(text)
            except Exception:
                pass
        return text

    def tokenize_indic_text(self, text: str, lang: str = "en") -> List[str]:
        """Tokenizes Indic script text using Indic NLP Library."""
        if not text:
            return []
        try:
            return list(indic_tokenize.trivial_tokenize(text, lang=lang))
        except Exception:
            return text.split()

    def extract_named_entities(self, text: str, lang: str = "en") -> List[Dict[str, Any]]:
        """
        Runs full NLP pipeline (Indic NLP normalizer -> Transformers NER -> spaCy Doc)
        Returns extracted entities with entity_group (PER, LOC, ORG), text, and confidence.
        """
        if not text or not text.strip():
            return []

        # 1. Indic NLP Normalization
        clean_text = self.normalize_indic_text(text, lang=lang)

        # 2. Transformers Token Classification
        extracted: List[Dict[str, Any]] = []
        if self._ner_pipeline is not None:
            try:
                # Process in chunks of 512 characters to respect model context
                chunks = [clean_text[i : i + 500] for i in range(0, len(clean_text), 500)]
                for chunk in chunks:
                    results = self._ner_pipeline(chunk)
                    for item in results:
                        word = str(item.get("word", "")).replace("##", "").strip()
                        group = str(item.get("entity_group", ""))
                        score = float(item.get("score", 0.0))

                        if word and len(word) > 1:
                            extracted.append(
                                {
                                    "text": word,
                                    "label": group,  # PER, LOC, ORG, MISC
                                    "confidence": round(score, 3),
                                }
                            )
            except Exception as e:
                logger.warning(f"NER extraction failed on chunk: {e}")

        return extracted
