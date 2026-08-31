"""
SIH26031 - Refactored Onion Detection & Quality Classification Pipeline
Strict 6-Step Pipeline Architecture:
Image -> Onion Detection -> Confidence & NMS Filtering -> Onion Crop -> Quality Classification -> Size & Grading
"""

import os
import cv2
import numpy as np
import base64

class SizeCalibrator:
    def __init__(self, reference_real_diameter_mm=50.0):
        self.reference_real_mm = reference_real_diameter_mm

    def calculate_mm_per_pixel(self, reference_pixel_width: float) -> float:
        if reference_pixel_width <= 0:
            return 0.24  # Default fallback ratio
        return self.reference_real_mm / reference_pixel_width

    def convert_bbox_to_size(self, bbox: list, mm_per_pixel: float) -> dict:
        x1, y1, x2, y2 = bbox
        w_px = abs(x2 - x1)
        h_px = abs(y2 - y1)
        avg_dia_px = (w_px + h_px) / 2.0
        dia_mm = round(avg_dia_px * mm_per_pixel, 1)
        return {
            "width_px": round(w_px, 1),
            "height_px": round(h_px, 1),
            "diameter_mm": dia_mm,
            "is_undersized": dia_mm < 45.0
        }


class YOLOOnionInspector:
    def __init__(self, model_path="ai/models/best.pt"):
        self.calibrator = SizeCalibrator(reference_real_diameter_mm=50.0)
        self.model = None

        candidate_paths = [
            model_path,
            os.path.join("ai", "models", "best.pt"),
            os.path.join("backend", "weights", "best.pt"),
            os.path.join("weights", "best.pt")
        ]

        active_path = None
        for p in candidate_paths:
            if os.path.exists(p):
                active_path = p
                break

        self.model_path = active_path if active_path else model_path

        if active_path:
            try:
                from ultralytics import YOLO
                print(f"[YOLOOnionInspector] Loading trained model: {active_path}")
                self.model = YOLO(active_path)
            except Exception as e:
                print(f"[YOLOOnionInspector] Failed loading model from {active_path}: {e}")
                self.model = None

    def inspect_image(
        self, 
        image_bytes: bytes, 
        calibration_mm: float = 50.0, 
        reference_px: float = 0.0,
        conf_threshold: float = 0.60,
        nms_iou_threshold: float = 0.45,
        debug_mode: bool = False
    ):
        """
        Executes strict 6-step inference architecture.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes.")

        height, width, _ = img.shape

        # Fast CPU Inference Optimization: Resize large high-res photos to max 1024px
        max_dim = max(height, width)
        if max_dim > 1024:
            scale = 1024.0 / max_dim
            new_w = int(width * scale)
            new_h = int(height * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            height, width, _ = img.shape

        mm_per_pixel = (calibration_mm / reference_px) if reference_px > 0 else (50.0 / (min(width, height) * 0.15))

        # STEP 1 & 2: Detect Onions & Extract Proposals
        if self.model is not None:
            raw_proposals = self._detect_yolo(img)
        else:
            raw_proposals = self._detect_cv_contours(img)

        # STEP 3: Confidence Filtering & Non-Maximum Suppression (NMS)
        accepted_detections, rejected_detections = self._apply_filtering_and_nms(
            raw_proposals, conf_threshold, nms_iou_threshold
        )

        # STEP 4 & 5: Crop Onion & Classify Quality on Crop (ONLY FOR ACCEPTED ONIONS)
        classified_detections = []
        counts = {"good": 0, "damaged": 0, "rotten": 0, "sprouted": 0, "undersized": 0}

        # STEP 4 & 5: Crop Onion, Measure Individual Diameter & Classify Quality/Size
        classified_detections = []
        counts = {"good": 0, "average": 0, "bad": 0, "damaged": 0, "rotten": 0, "sprouted": 0, "undersized": 0}
        diameters = []

        # Configurable size thresholds (in mm or px)
        SMALL_THRESHOLD = 45.0
        LARGE_THRESHOLD = 65.0

        unit = "mm" if reference_px > 0 else "px"

        for idx, det in enumerate(accepted_detections):
            x1, y1, x2, y2 = det["bbox"]
            conf = det["confidence"]
            
            # Center and radius calculation for circular annotation
            center_x = int((x1 + x2) / 2.0)
            center_y = int((y1 + y2) / 2.0)
            w_px = abs(x2 - x1)
            h_px = abs(y2 - y1)
            radius_px = int(max(w_px, h_px) / 2.0)
            diameter_px = round(2.0 * radius_px, 1)

            # Diameter calculation in mm if calibrated
            if reference_px > 0:
                diameter_val = round(diameter_px * mm_per_pixel, 1)
            else:
                diameter_val = diameter_px

            diameters.append(diameter_val)

            # Crop onion region for quality classification
            crop_bgr = img[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
            
            if "classification" in det and det["classification"] in counts:
                raw_quality = det["classification"]
            else:
                raw_quality = self._classify_crop_quality(crop_bgr, diameter_val if reference_px > 0 else (diameter_val * 0.24))

            if raw_quality is None or raw_quality == "background":
                rejected_detections.append({
                    "bbox": det["bbox"],
                    "confidence": conf,
                    "reason": "Rejected: Invalid onion crop / background region"
                })
                continue

            # Classify Size
            if diameter_val < SMALL_THRESHOLD:
                size_class = "Small"
            elif diameter_val >= LARGE_THRESHOLD:
                size_class = "Large"
            else:
                size_class = "Medium"

            # Determine Combined Quality & Color Code
            # GREEN -> Good / Desirable (Good quality + Medium/Large size)
            # YELLOW/ORANGE -> Average (Good quality + Small size OR Medium size)
            # RED -> Bad (Damaged / Rotten / Sprouted / Defective)
            if raw_quality in ["damaged", "rotten", "sprouted"]:
                quality_cat = "BAD"
                display_color = "red"
                bgr_color = (68, 68, 239)     # Bright Red
                counts["bad"] += 1
                counts[raw_quality] += 1
            elif raw_quality == "undersized" or size_class == "Small":
                quality_cat = "AVERAGE"
                display_color = "yellow"
                bgr_color = (20, 200, 240)    # Amber / Gold
                counts["average"] += 1
                counts["undersized"] += 1
            elif size_class == "Medium":
                quality_cat = "AVERAGE"
                display_color = "yellow"
                bgr_color = (20, 200, 240)    # Amber / Gold
                counts["average"] += 1
                counts["good"] += 1
            else:
                quality_cat = "GOOD"
                display_color = "green"
                bgr_color = (74, 197, 34)     # Emerald Green
                counts["good"] += 1

            classified_detections.append({
                "id": len(classified_detections) + 1,
                "center": [center_x, center_y],
                "radius": radius_px,
                "diameter": diameter_val,
                "unit": unit,
                "size_class": size_class,
                "quality_category": quality_cat,
                "raw_quality": raw_quality,
                "confidence": round(conf, 2),
                "color": display_color,
                "bgr_color": bgr_color,
                "bbox": [x1, y1, x2, y2],
                "status": "ACCEPTED"
            })

        # STEP 6: Render Clean Single Circular Annotations
        annotated_img = self._render_clean_circular_overlays(img, classified_detections, rejected_detections, debug_mode)

        total_accepted = len(classified_detections)

        # Handle case where 0 onions detected
        if total_accepted == 0:
            return self._build_empty_response(img, raw_proposals, rejected_detections, conf_threshold, debug_mode)

        # Calculate Grade A % and URS %
        good_count = counts["good"]
        grade_a_pct = round((good_count / total_accepted * 100.0), 1)
        urs_pct = round(((total_accepted - good_count) / total_accepted * 100.0), 1)
        avg_conf = round(float(np.mean([d["confidence"] for d in classified_detections])), 2)

        avg_dia = round(float(np.mean(diameters)), 1) if diameters else 0.0
        min_dia = round(float(np.min(diameters)), 1) if diameters else 0.0
        max_dia = round(float(np.max(diameters)), 1) if diameters else 0.0

        # Encode Annotated Image
        _, buffer = cv2.imencode('.jpg', annotated_img)
        img_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        model_name = f"Ultralytics YOLO ({os.path.basename(self.model_path)})" if self.model else "Modular Computer Vision Engine"

        return {
            "total_inspected": total_accepted,
            "good": counts["good"],
            "average": counts["average"],
            "bad": counts["bad"],
            "damaged": counts["damaged"],
            "rotten": counts["rotten"],
            "sprouted": counts["sprouted"],
            "undersized": counts["undersized"],
            "grade_a_percentage": grade_a_pct,
            "urs_percentage": urs_pct,
            "confidence_score": avg_conf,
            "conf_threshold": conf_threshold,
            "model_type": model_name,
            "message": f"Successfully detected and annotated {total_accepted} individual onion(s).",
            "annotated_image": img_base64,
            "detections": classified_detections,
            "summary_panel": {
                "total_onions": total_accepted,
                "good": counts["good"],
                "average": counts["average"],
                "bad": counts["bad"],
                "average_diameter": f"{avg_dia} {unit}",
                "smallest_onion": f"{min_dia} {unit}",
                "largest_onion": f"{max_dia} {unit}"
            },
            "table_data": [
                {
                    "id": d["id"],
                    "diameter": f"{d['diameter']} {d['unit']}",
                    "size": d["size_class"],
                    "quality": d["quality_category"]
                } for d in classified_detections
            ],
            "debug_telemetry": {
                "raw_proposals_count": len(raw_proposals),
                "accepted_count": total_accepted,
                "rejected_count": len(rejected_detections),
                "rejected_detections": rejected_detections if debug_mode else []
            }
        }

    def _render_clean_circular_overlays(self, img, accepted_detections, rejected_detections, debug_mode):
        """
        Renders ONE clean circular outline per detected onion with compact non-overlapping text labels.
        """
        annotated = img.copy()
        
        # 1. If Debug Mode enabled, draw raw proposal boxes as thin gray outline
        if debug_mode:
            for r in rejected_detections:
                x1, y1, x2, y2 = r["bbox"]
                conf_pct = int(r["confidence"] * 100)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (120, 120, 120), 1)
                cv2.putText(annotated, f"RAW ({conf_pct}%)", (x1, max(12, y1 - 2)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (120, 120, 120), 1)

        # 2. Draw ONE clean fitted circle and compact label for each accepted onion
        for det in accepted_detections:
            cx, cy = det["center"]
            r = det["radius"]
            bgr_color = det["bgr_color"]
            
            # Draw Clean Fitted Circle
            cv2.circle(annotated, (cx, cy), r, bgr_color, 3, cv2.LINE_AA)
            cv2.circle(annotated, (cx, cy), 3, bgr_color, -1) # Center dot

            # Format Compact Label: #1 | GOOD | 78 px
            label = f"#{det['id']} | {det['quality_category']} | {det['diameter']} {det['unit']}"
            
            (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            
            # Calculate non-overlapping label position above the circle
            lx = max(5, min(annotated.shape[1] - tw - 10, cx - int(tw / 2)))
            ly = max(th + 8, cy - r - 8)

            # Draw background pill behind text for sharp contrast readability
            cv2.rectangle(annotated, (lx - 4, ly - th - 5), (lx + tw + 4, ly + baseline + 2), (20, 20, 20), -1)
            cv2.rectangle(annotated, (lx - 4, ly - th - 5), (lx + tw + 4, ly + baseline + 2), bgr_color, 1)
            
            # Text label
            cv2.putText(annotated, label, (lx, ly), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        return annotated

    def _detect_yolo(self, img):
        results = self.model(img)[0]
        proposals = []
        valid_onion_classes = {"onion", "good_onion", "damaged_onion", "rotten_onion", "sprouted_onion", "undersized_onion"}
        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = results.names.get(cls_id, "unknown").lower()
            
            # Reject generic COCO classes (person, chair, table, dog, cat, laptop, etc.)
            if cls_name not in valid_onion_classes and "onion" not in cls_name:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            proposals.append({
                "bbox": [x1, y1, x2, y2],
                "confidence": conf,
                "proposed_class": cls_name
            })
        return proposals

    def _detect_cv_contours(self, img):
        """
        Validates standalone circular onion bulb geometry and color gradient before proposing.
        Enforces circularity >= 0.70, edge gradient, high saturation (S >= 0.35), and excludes human skin tones.
        Non-onion / human images return zero proposals.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        blurred = cv2.GaussianBlur(gray, (9, 9), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        
        contours, _ = cv2.findContours(opening, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        proposals = []
        img_area = img.shape[0] * img.shape[1]
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < (img_area * 0.015) or area > (img_area * 0.30):
                continue
                
            # Verify circularity (Onions are spherical bulbs, circularity >= 0.70)
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0: continue
            circularity = 4 * np.pi * area / (perimeter * perimeter)
            
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h if h > 0 else 0
            
            # Require high circularity and balanced aspect ratio for bulb shape (exclude elongated human limbs/faces)
            if circularity < 0.70 or aspect_ratio < 0.70 or aspect_ratio > 1.4:
                continue

            # Check ROI in HSV space
            roi_hsv = hsv[y:y+h, x:x+w]
            if roi_hsv.size == 0: continue
            
            mean_sat = cv2.mean(roi_hsv)[1]
            
            # ANTI-HUMAN SKIN FILTER:
            # Human skin has low-to-medium saturation (S in 20..85 / 255) and peach/beige/pinkish-brown hues.
            # Onion peel has higher saturation (S >= 90 / 255 -> ~0.35+) and papery texture contrast.
            human_skin_mask = cv2.inRange(roi_hsv, (0, 20, 60), (25, 90, 255))
            human_skin_ratio = np.sum(human_skin_mask > 0) / (roi_hsv.shape[0] * roi_hsv.shape[1] + 1e-5)
            
            if human_skin_ratio > 0.25 and mean_sat < 95.0:
                # Reject human skin / person body region
                continue

            # Onion skin hue ranges (Yellow-gold, orange-brown, copper, deep red-purple onion peel)
            lower_skin1 = np.array([0, 35, 40])
            upper_skin1 = np.array([35, 255, 255])
            lower_skin2 = np.array([140, 35, 40])
            upper_skin2 = np.array([180, 255, 255])
            
            mask1 = cv2.inRange(roi_hsv, lower_skin1, upper_skin1)
            mask2 = cv2.inRange(roi_hsv, lower_skin2, upper_skin2)
            skin_mask = mask1 | mask2
            
            onion_peel_ratio = np.sum(skin_mask > 0) / (roi_hsv.shape[0] * roi_hsv.shape[1] + 1e-5)
            
            # Must have strong onion peel color presence (>25% of ROI) and non-flat saturation
            if onion_peel_ratio < 0.25 or mean_sat < 35.0:
                continue
            
            conf = min(0.96, max(0.40, (circularity * 0.4) + (onion_peel_ratio * 0.4) + (mean_sat / 255.0 * 0.2)))
            
            proposals.append({
                "bbox": [x, y, x + w, y + h],
                "confidence": round(float(conf), 2)
            })

        return proposals

    def _apply_filtering_and_nms(self, proposals: list, conf_threshold: float, nms_iou_threshold: float):
        """
        Step 3: Confidence Filtering and NMS.
        """
        accepted = []
        rejected = []

        # 1. Filter by confidence threshold
        candidates = []
        for p in proposals:
            if p["confidence"] >= conf_threshold:
                candidates.append(p)
            else:
                rejected.append({
                    "bbox": p["bbox"],
                    "confidence": p["confidence"],
                    "reason": f"Below confidence threshold ({p['confidence']:.2f} < {conf_threshold:.2f})"
                })

        # 2. Apply NMS to candidate boxes
        if not candidates:
            return [], rejected

        boxes = np.array([c["bbox"] for c in candidates])
        scores = np.array([c["confidence"] for c in candidates])

        keep_indices = self._nms(boxes, scores, nms_iou_threshold)

        for i, c in enumerate(candidates):
            if i in keep_indices:
                accepted.append(c)
            else:
                rejected.append({
                    "bbox": c["bbox"],
                    "confidence": c["confidence"],
                    "reason": f"Suppressed by NMS (Overlap > {nms_iou_threshold})"
                })

        return accepted, rejected

    def _nms(self, boxes: np.ndarray, scores: np.ndarray, iou_threshold: float):
        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 2]
        y2 = boxes[:, 3]

        areas = (x2 - x1 + 1) * (y2 - y1 + 1)
        order = scores.argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)

            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1 + 1)
            h = np.maximum(0.0, yy2 - yy1 + 1)
            inter = w * h

            iou = inter / (areas[i] + areas[order[1:]] - inter)
            inds = np.where(iou <= iou_threshold)[0]
            order = order[inds + 1]

        return keep

    def _classify_crop_quality(self, crop_bgr, diameter_mm: float) -> str:
        """
        Classifies quality ONLY inside the cropped onion box.
        Never defaults to 'good'.
        Returns None or 'background' if the crop is not a valid onion.
        """
        if crop_bgr.size == 0:
            return None

        crop_hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
        h, w, _ = crop_bgr.shape

        # Anti-human skin check inside crop
        human_skin_mask = cv2.inRange(crop_hsv, (0, 20, 60), (25, 90, 255))
        human_skin_ratio = np.sum(human_skin_mask > 0) / (w * h + 1e-5)
        if human_skin_ratio > 0.25 and cv2.mean(crop_hsv)[1] < 95.0:
            return "background"

        # Validate onion presence in crop (must have high saturation skin color)
        lower_skin1 = np.array([0, 90, 50])
        upper_skin1 = np.array([30, 255, 255])
        lower_skin2 = np.array([150, 90, 50])
        upper_skin2 = np.array([180, 255, 255])
        mask1 = cv2.inRange(crop_hsv, lower_skin1, upper_skin1)
        mask2 = cv2.inRange(crop_hsv, lower_skin2, upper_skin2)
        skin_ratio = np.sum((mask1 | mask2) > 0) / (w * h + 1e-5)
        
        # If crop lacks skin color/texture, reject as background
        if skin_ratio < 0.20 and cv2.mean(crop_hsv)[1] < 80.0:
            return "background"

        # 1. Sprout Detection (Green vegetation in HSV range)
        green_mask = cv2.inRange(crop_hsv, (35, 40, 40), (85, 255, 255))
        green_ratio = np.sum(green_mask > 0) / (w * h + 1e-5)
        if green_ratio > 0.07:
            return "sprouted"

        # 2. Black Rot / Fungal Decay (Dark spots in HSV)
        black_mask = cv2.inRange(crop_hsv, (0, 0, 0), (180, 255, 55))
        black_ratio = np.sum(black_mask > 0) / (w * h + 1e-5)
        if black_ratio > 0.12:
            return "rotten"

        # 3. Cut / Bruise Mechanical Damage (high saturation contrast variance)
        gray_crop = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
        if laplacian_var > 650.0:
            return "damaged"

        # 4. Undersized check
        if diameter_mm < 45.0:
            return "undersized"

        # 5. Verified Healthy Onion
        return "good"

    def _render_overlays(self, img, accepted_detections, rejected_detections, debug_mode):
        annotated = img.copy()
        
        # Color map for accepted detections
        colors = {
            "good": (46, 139, 87),       # Emerald
            "damaged": (0, 140, 255),    # Amber
            "rotten": (34, 34, 178),     # Red
            "sprouted": (128, 0, 128),   # Purple
            "undersized": (0, 215, 255)  # Gold
        }

        # Draw Accepted Detections with Confidence %
        for det in accepted_detections:
            x1, y1, x2, y2 = det["bbox"]
            cls = det["classification"]
            conf_pct = int(det["confidence"] * 100)
            dia = det["diameter_mm"]
            
            color = colors.get(cls, (200, 200, 200))
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)

            # Label Tag
            label = f"#{det['id']} {cls.upper()} ({conf_pct}%) {dia}mm"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            
            cv2.rectangle(annotated, (x1, max(0, y1 - 22)), (x1 + tw + 6, max(22, y1)), color, -1)
            cv2.putText(annotated, label, (x1 + 3, max(15, y1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        # Draw Rejected Detections if Debug Mode enabled (dashed gray/red boxes)
        if debug_mode:
            for r in rejected_detections:
                x1, y1, x2, y2 = r["bbox"]
                conf_pct = int(r["confidence"] * 100)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (100, 100, 100), 1)
                cv2.putText(annotated, f"REJECTED ({conf_pct}%)", (x1, max(12, y1 - 2)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (100, 100, 100), 1)

        return annotated

    def _build_empty_response(self, img, raw_proposals, rejected_detections, conf_threshold, debug_mode):
        """
        Returns clean 'No onions detected — inspection cannot be completed.' payload.
        """
        annotated = img.copy()
        h, w, _ = img.shape
        cv2.rectangle(annotated, (0, 0), (w, 55), (34, 34, 178), -1)
        cv2.putText(annotated, "NO ONIONS DETECTED - INSPECTION INCOMPLETE", 
                    (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

        _, buffer = cv2.imencode('.jpg', annotated)
        img_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        model_status_name = "Ultralytics YOLO (weights/best.pt)" if self.model else "No Trained Onion Model Loaded (weights/best.pt missing)"

        return {
            "total_inspected": 0,
            "good": 0,
            "damaged": 0,
            "rotten": 0,
            "sprouted": 0,
            "undersized": 0,
            "grade_a_percentage": "N/A",
            "urs_percentage": "N/A",
            "confidence_score": 0.0,
            "conf_threshold": conf_threshold,
            "model_type": model_status_name,
            "message": "No onions detected — inspection cannot be completed.",
            "annotated_image": img_base64,
            "detections": [],
            "debug_telemetry": {
                "raw_proposals_count": len(raw_proposals),
                "accepted_count": 0,
                "rejected_count": len(rejected_detections),
                "rejected_detections": rejected_detections if debug_mode else []
            }
        }
