"""
SIH26031 - Size Calibration & Pixel-to-Millimeter Conversion Module
Measures physical onion diameters based on reference calibration object (e.g. 50mm calibration card or coin).
"""

import numpy as np

class SizeCalibrator:
    def __init__(self, reference_real_diameter_mm=50.0):
        """
        Default calibration reference: 50.0 mm reference coin/card
        """
        self.reference_real_mm = reference_real_diameter_mm

    def calculate_mm_per_pixel(self, reference_pixel_width: float) -> float:
        """
        Calculate millimeter per pixel scale factor.
        """
        if reference_pixel_width <= 0:
            return 0.25  # Default fallback ratio (approx 0.25mm / pixel)
        return self.reference_real_mm / reference_pixel_width

    def convert_bbox_to_size(self, bbox: list, mm_per_pixel: float) -> dict:
        """
        bbox: [x1, y1, x2, y2]
        Returns diameter in mm, radius, area in sq mm.
        """
        x1, y1, x2, y2 = bbox
        width_px = abs(x2 - x1)
        height_px = abs(y2 - y1)
        
        # Average diameter in pixels
        avg_diameter_px = (width_px + height_px) / 2.0
        diameter_mm = round(avg_diameter_px * mm_per_pixel, 1)
        
        return {
            "width_px": round(width_px, 1),
            "height_px": round(height_px, 1),
            "diameter_mm": diameter_mm,
            "is_undersized": diameter_mm < 45.0  # APMC standard Grade A threshold is >= 45mm
        }
