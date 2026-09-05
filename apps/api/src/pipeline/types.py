from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class PreprocessingConfig:
    """Configuration options for the OpenCV document preprocessing pipeline."""
    deskew: bool = True
    denoise: bool = True
    enhance_contrast: bool = True
    binarize: bool = True
    remove_borders: bool = True
    detect_stamps: bool = True
    max_dimension: int = 2400
    dpi: int = 300


@dataclass
class PreprocessingResult:
    """Result details returned by the preprocessor."""
    original_path: str
    processed_image_path: str
    page_count: int
    width: int
    height: int
    skew_angle_deg: float
    stamps_detected: int
    applied_steps: List[str] = field(default_factory=list)
    error: Optional[str] = None
