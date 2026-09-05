import os
import uuid
from pathlib import Path
from typing import List, Optional, Tuple, Union

import cv2
import numpy as np
from PIL import Image

try:
    from src.pipeline.types import PreprocessingConfig, PreprocessingResult
except ImportError:
    from .types import PreprocessingConfig, PreprocessingResult

# Processed uploads directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = BASE_DIR / "uploads" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


class DocumentPreprocessor:
    """
    Production-grade OpenCV document image preprocessor tailored for
    scanned and photographed Indic land records.
    """

    def __init__(self, config: Optional[PreprocessingConfig] = None):
        self.config = config or PreprocessingConfig()

    def load_document_as_image(self, file_path: Union[str, Path]) -> Tuple[np.ndarray, int]:
        """
        Loads an image or renders the first page of a PDF document into a BGR numpy array.
        Returns: (image_bgr, page_count)
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        suffix = path.suffix.lower()

        if suffix == ".pdf":
            import pypdfium2 as pdfium

            pdf = pdfium.PdfDocument(str(path))
            page_count = len(pdf)
            if page_count == 0:
                raise ValueError("PDF document has no pages")

            page = pdf.get_page(0)
            # Render at specified DPI (default 300)
            scale = self.config.dpi / 72.0
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil()
            rgb_arr = np.array(pil_image)

            # Convert RGB/RGBA to BGR for OpenCV
            if len(rgb_arr.shape) == 3 and rgb_arr.shape[2] == 4:
                bgr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGBA2BGR)
            elif len(rgb_arr.shape) == 3 and rgb_arr.shape[2] == 3:
                bgr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
            else:
                bgr = cv2.cvtColor(rgb_arr, cv2.COLOR_GRAY2BGR)

            return bgr, page_count
        else:
            pil_image = Image.open(str(path))
            pil_image = pil_image.convert("RGB")
            rgb_arr = np.array(pil_image)
            bgr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
            return bgr, 1

    def resize_if_needed(self, image: np.ndarray) -> np.ndarray:
        """Resizes the image if its dimensions exceed max_dimension while preserving aspect ratio."""
        h, w = image.shape[:2]
        max_dim = self.config.max_dimension
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            new_w = int(w * scale)
            new_h = int(h * scale)
            return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return image

    def normalize_illumination(self, gray: np.ndarray) -> np.ndarray:
        """
        Removes uneven lighting, shadows, and yellowing paper gradients using
        morphological background division (closing dark ink to estimate paper background).
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (41, 41))
        background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        # Replace zero values in background to avoid div-by-zero
        background = np.where(background == 0, 1, background)
        divided = cv2.divide(gray, background, scale=255)
        return np.clip(divided, 0, 255).astype(np.uint8)

    def enhance_contrast(self, gray: np.ndarray) -> np.ndarray:
        """
        Enhances contrast of faded handwritten or stamped ink using
        Contrast Limited Adaptive Histogram Equalization (CLAHE).
        """
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(gray)

    def denoise(self, gray: np.ndarray) -> np.ndarray:
        """
        Applies edge-preserving bilateral filtering to reduce scanner grain and paper noise
        without blurring fine Indic characters and matras.
        """
        return cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)

    def detect_skew_angle(self, gray: np.ndarray) -> float:
        """
        Detects document skew angle using morphological text line dilation
        and minimum bounding rectangle analysis.
        """
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 3))
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        angles: List[float] = []

        for c in contours:
            if cv2.contourArea(c) > 200:
                rect = cv2.minAreaRect(c)
                (w, h) = rect[1]
                angle = rect[2]

                # Adjust angle based on rectangle aspect ratio
                if w < h:
                    angle = angle + 90

                # Normalize angle to range [-45, 45]
                while angle <= -45:
                    angle += 180
                while angle > 45:
                    angle -= 180

                angles.append(angle)

        if not angles:
            return 0.0

        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.2:
            return 0.0

        return median_angle

    def deskew(self, image: np.ndarray, angle: float) -> np.ndarray:
        """Rotates image to correct skew, padding borders with clean white background."""
        if abs(angle) < 0.2:
            return image

        h, w = image.shape[:2]
        center = (w // 2, h // 2)

        # Counteract the detected skew angle
        rot_mat = cv2.getRotationMatrix2D(center, -angle, 1.0)
        deskewed = cv2.warpAffine(
            image,
            rot_mat,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255) if len(image.shape) == 3 else 255,
        )
        return deskewed

    def remove_border_artifacts(self, gray: np.ndarray) -> np.ndarray:
        """Detects and cleans solid black scanner borders and binding shadow artifacts."""
        h, w = gray.shape[:2]
        cleaned = gray.copy()

        top_margin = max(1, int(h * 0.02))
        bottom_margin = min(h - 1, int(h * 0.98))
        left_margin = max(1, int(w * 0.02))
        right_margin = min(w - 1, int(w * 0.98))

        if np.mean(cleaned[:top_margin, :]) < 80:
            cleaned[:top_margin, :] = 255
        if np.mean(cleaned[bottom_margin:, :]) < 80:
            cleaned[bottom_margin:, :] = 255
        if np.mean(cleaned[:, :left_margin]) < 80:
            cleaned[:, :left_margin] = 255
        if np.mean(cleaned[:, right_margin:]) < 80:
            cleaned[:, right_margin:] = 255

        return cleaned

    def detect_stamps_and_seals(self, bgr: np.ndarray) -> Tuple[int, Optional[np.ndarray]]:
        """
        Detects red, violet/purple, blue, and green official revenue stamp ink regions.
        Returns: (stamp_count, stamp_mask)
        """
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

        # Red / Vermilion revenue stamp mask
        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([15, 255, 255])
        lower_red2 = np.array([165, 50, 40])
        upper_red2 = np.array([180, 255, 255])
        mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

        # Violet / Purple / Magenta official stamp ink mask
        lower_purple = np.array([130, 40, 40])
        upper_purple = np.array([165, 255, 255])
        mask_purple = cv2.inRange(hsv, lower_purple, upper_purple)

        # Blue ink stamp mask
        lower_blue = np.array([90, 40, 40])
        upper_blue = np.array([130, 255, 255])
        mask_blue = cv2.inRange(hsv, lower_blue, upper_blue)

        # Green official gazette stamp mask
        lower_green = np.array([35, 40, 40])
        upper_green = np.array([85, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        combined_mask = mask_red | mask_purple | mask_blue | mask_green

        # Morphological closing to join text/stamp outlines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        filtered_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(filtered_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        stamps = [c for c in contours if cv2.contourArea(c) > 300]

        return len(stamps), filtered_mask

    def binarize(self, gray: np.ndarray) -> np.ndarray:
        """
        Produces clean binary text image using Otsu's thresholding with Gaussian pre-filter.
        """
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return binary

    def process(self, file_path: Union[str, Path], output_filename: Optional[str] = None) -> PreprocessingResult:
        """
        Runs the full OpenCV pipeline on a document and saves the enhanced image.
        Original file is never modified or overwritten.
        """
        applied_steps: List[str] = []
        path = Path(file_path)

        # 1. Load document as BGR image
        bgr, page_count = self.load_document_as_image(path)
        applied_steps.append("load_and_rasterize")

        # 2. Resize if image is oversized
        bgr = self.resize_if_needed(bgr)
        applied_steps.append("dimension_normalization")

        # 3. Detect stamps / revenue seals in color domain
        stamps_count = 0
        if self.config.detect_stamps:
            stamps_count, _ = self.detect_stamps_and_seals(bgr)
            if stamps_count > 0:
                applied_steps.append(f"detected_{stamps_count}_stamps")

        # 4. Convert to Grayscale
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

        # 5. Illumination normalization (removes shadow & paper aging)
        gray = self.normalize_illumination(gray)
        applied_steps.append("illumination_normalization")

        # 6. Denoising
        if self.config.denoise:
            gray = self.denoise(gray)
            applied_steps.append("bilateral_denoise")

        # 7. Contrast Enhancement
        if self.config.enhance_contrast:
            gray = self.enhance_contrast(gray)
            applied_steps.append("clahe_contrast_enhancement")

        # 8. Skew angle detection and deskewing
        skew_angle = 0.0
        if self.config.deskew:
            skew_angle = self.detect_skew_angle(gray)
            if abs(skew_angle) >= 0.2:
                gray = self.deskew(gray, skew_angle)
                applied_steps.append(f"deskew_{skew_angle:.2f}deg")

        # 9. Scanner border artifact removal
        if self.config.remove_borders:
            gray = self.remove_border_artifacts(gray)
            applied_steps.append("scanner_border_cleaning")

        # 10. Binarization
        if self.config.binarize:
            final_img = self.binarize(gray)
            applied_steps.append("otsu_binarization")
        else:
            final_img = gray

        # 11. Save processed output
        h, w = final_img.shape[:2]
        if not output_filename:
            output_filename = f"{uuid.uuid4().hex}_processed.png"

        dest_path = PROCESSED_DIR / output_filename
        cv2.imwrite(str(dest_path), final_img)

        return PreprocessingResult(
            original_path=str(path),
            processed_image_path=str(dest_path),
            page_count=page_count,
            width=w,
            height=h,
            skew_angle_deg=skew_angle,
            stamps_detected=stamps_count,
            applied_steps=applied_steps,
        )
