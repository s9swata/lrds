import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np

logger = logging.getLogger("lrds.layout")


@dataclass
class DocumentRegion:
    region_type: str  # "stamp_header", "left_column", "right_column", "single_column", "seal"
    bbox: List[int]   # [x, y, w, h]
    crop: np.ndarray
    order: int
    detected_script: str = "Latin"
    text: str = ""
    confidence: float = 0.0


@dataclass
class DocumentLayout:
    stamp_header: Optional[DocumentRegion] = None
    columns: List[DocumentRegion] = field(default_factory=list)
    reading_order_regions: List[DocumentRegion] = field(default_factory=list)


class AdaptiveLayoutSegmenter:
    """
    Adaptive geometric layout analyzer for unruled, multi-column, mixed-script Indian land deeds.
    Features:
    1. Unsupervised Stamp Header detection (density drop below engraved security crest).
    2. Column Gutter detection via Vertical Projection Profiling across Connected Component text blocks.
    3. Column-isolated OCR routing (Left: English Endorsement, Right: Regional Deed Schedule).
    """

    def detect_stamp_header_boundary(self, gray: np.ndarray) -> int:
        """
        Detects the boundary between the top engraved security stamp header
        and the document text body.
        """
        h, w = gray.shape[:2]
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 12)

        # Scan horizontal profile in top 15% - 35% height
        start_y = int(h * 0.15)
        end_y = int(h * 0.35)
        hpp = np.sum(thresh[start_y:end_y, :], axis=1)

        if len(hpp) == 0:
            return int(h * 0.22)

        # Smooth horizontal projection profile
        smoothed = cv2.GaussianBlur(hpp.astype(np.float32).reshape(-1, 1), (15, 1), 5).flatten()
        min_idx = int(np.argmin(smoothed))
        split_y = start_y + min_idx

        return split_y

    def detect_column_gutters(self, binary_body: np.ndarray) -> List[int]:
        """
        Locates the vertical whitespace gutter between left endorsement and right deed body.
        """
        h, w = binary_body.shape[:2]
        if h < 50 or w < 50:
            return []

        # Vertical projection of ink down columns
        vpp = np.sum(binary_body > 0, axis=0)

        # Search middle 35% to 65% width
        x_start = int(w * 0.35)
        x_end = int(w * 0.65)
        middle_vpp = vpp[x_start:x_end]

        if len(middle_vpp) == 0:
            return []

        # Smooth vertical projection profile
        smoothed = cv2.GaussianBlur(middle_vpp.astype(np.float32).reshape(1, -1), (31, 1), 10)[0]
        min_offset = int(np.argmin(smoothed))
        min_val = smoothed[min_offset]
        mean_val = np.mean(smoothed)

        # If a significant valley exists (ink density drops by > 35%), a column gutter is present
        if min_val < (mean_val * 0.65):
            gutter_x = x_start + min_offset
            return [gutter_x]

        return []

    def segment_layout(self, image_bgr: np.ndarray) -> DocumentLayout:
        """
        Decomposes complex deed scan into isolated stamp header and text columns.
        """
        h, w = image_bgr.shape[:2]
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        # 1. Isolate Top Stamp Header
        split_y = self.detect_stamp_header_boundary(gray)
        stamp_header_crop = image_bgr[:split_y, :]
        body_crop = image_bgr[split_y:, :]
        body_gray = gray[split_y:, :]

        stamp_region = DocumentRegion(
            region_type="stamp_header",
            bbox=[0, 0, w, split_y],
            crop=stamp_header_crop,
            order=0,
            detected_script="Stamp_Header",
        )

        # 2. Analyze Body for Vertical Gutters
        body_thresh = cv2.adaptiveThreshold(body_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 12)
        gutters = self.detect_column_gutters(body_thresh)

        columns: List[DocumentRegion] = []
        body_h, body_w = body_crop.shape[:2]

        if gutters:
            gutter_x = gutters[0]
            # Left Column (Registration Endorsement)
            left_crop = body_crop[:, :gutter_x]
            left_region = DocumentRegion(
                region_type="left_column",
                bbox=[0, split_y, gutter_x, body_h],
                crop=left_crop,
                order=1,
                detected_script="Latin_Endorsement",
            )

            # Right Column (Core Deed Body & Property Schedule)
            right_crop = body_crop[:, gutter_x:]
            right_region = DocumentRegion(
                region_type="right_column",
                bbox=[gutter_x, split_y, body_w - gutter_x, body_h],
                crop=right_crop,
                order=2,
                detected_script="Bengali_Deed_Body",
            )

            columns.extend([left_region, right_region])
        else:
            single_region = DocumentRegion(
                region_type="single_column",
                bbox=[0, split_y, body_w, body_h],
                crop=body_crop,
                order=1,
            )
            columns.append(single_region)

        reading_order = [stamp_region] + columns

        return DocumentLayout(
            stamp_header=stamp_region,
            columns=columns,
            reading_order_regions=reading_order,
        )
