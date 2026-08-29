"""
SIH26031 - Onion AI Model Inference Module
Loads trained model (ai/models/best.pt) and performs onion detection.
"""

import os
import sys
import argparse
import cv2
import numpy as np

class OnionPredictor:
    def __init__(self, model_path="ai/models/best.pt", conf_threshold=0.60, nms_iou_threshold=0.45):
        self.conf_threshold = conf_threshold
        self.nms_iou_threshold = nms_iou_threshold
        self.model_path = model_path
        self.model = None

        # Check alternative model paths if primary path does not exist
        candidate_paths = [
            model_path,
            os.path.join("backend", "weights", "best.pt"),
            os.path.join("weights", "best.pt")
        ]

        active_path = None
        for p in candidate_paths:
            if os.path.exists(p):
                active_path = p
                break

        if active_path:
            try:
                from ultralytics import YOLO
                print(f"[OnionPredictor] Loading trained YOLO model: {active_path}")
                self.model = YOLO(active_path)
                self.model_path = active_path
            except Exception as e:
                print(f"[OnionPredictor] Error loading model from {active_path}: {e}")
                self.model = None
        else:
            print(f"[OnionPredictor] Warning: No trained model file found. Expected at '{model_path}'.")

    def predict(self, image_input, conf_threshold=None, nms_iou_threshold=None):
        """
        Runs onion detection on input image path, cv2 numpy image array, or image bytes.
        """
        conf_thresh = conf_threshold if conf_threshold is not None else self.conf_threshold
        iou_thresh = nms_iou_threshold if nms_iou_threshold is not None else self.nms_iou_threshold

        # Process input image
        if isinstance(image_input, str):
            img = cv2.imread(image_input)
            if img is None:
                raise ValueError(f"Failed to read image file: {image_input}")
        elif isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif isinstance(image_input, np.ndarray):
            img = image_input.copy()
        else:
            raise TypeError("Unsupported image input type. Pass filepath, bytes, or numpy array.")

        if self.model is None:
            return {
                "total_onions": 0,
                "status": "FAILED",
                "message": f"No trained onion model loaded (Expected at {self.model_path}).",
                "detections": []
            }

        # Execute YOLO inference
        results = self.model(img)[0]
        valid_onion_classes = {"onion", "good_onion", "damaged_onion", "rotten_onion", "sprouted_onion", "undersized_onion"}

        proposals = []
        for box in results.boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = results.names.get(cls_id, "onion").lower()

            # Filter for onion class and confidence threshold
            if (cls_name in valid_onion_classes or "onion" in cls_name) and conf >= conf_thresh:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                proposals.append({
                    "bbox": [x1, y1, x2, y2],
                    "confidence": round(conf, 2),
                    "class": "onion"
                })

        # Apply NMS filtering
        accepted_detections = self._apply_nms(proposals, iou_thresh)
        total_onions = len(accepted_detections)

        # Annotate image
        annotated_img = img.copy()
        for idx, det in enumerate(accepted_detections, start=1):
            x1, y1, x2, y2 = det["bbox"]
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (46, 139, 87), 3)
            label = f"#{idx} ONION ({int(det['confidence']*100)}%)"
            cv2.putText(annotated_img, label, (x1 + 4, max(18, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

        return {
            "total_onions": total_onions,
            "status": "SUCCESS" if total_onions > 0 else "NO_ONION_DETECTED",
            "message": f"Detected {total_onions} onion(s)." if total_onions > 0 else "No onions detected — inspection cannot be completed.",
            "confidence_threshold": conf_thresh,
            "model_type": f"Ultralytics YOLO ({os.path.basename(self.model_path)})",
            "detections": accepted_detections,
            "annotated_image": annotated_img
        }

    def _apply_nms(self, proposals, iou_threshold):
        if not proposals:
            return []
        boxes = np.array([p["bbox"] for p in proposals])
        scores = np.array([p["confidence"] for p in proposals])

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
            iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-5)
            inds = np.where(iou <= iou_threshold)[0]
            order = order[inds + 1]

        return [proposals[i] for i in keep]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SIH26031 Onion AI Prediction Module")
    parser.add_argument("--image", type=str, required=True, help="Path to input image")
    parser.add_argument("--model", type=str, default="ai/models/best.pt", help="Path to trained model weights")
    parser.add_argument("--conf", type=float, default=0.60, help="Confidence threshold")

    args = parser.parse_args()
    predictor = OnionPredictor(model_path=args.model, conf_threshold=args.conf)
    res = predictor.predict(args.image)

    print("\n--- PREDICTION RESULT ---")
    print(f"Status: {res['status']}")
    print(f"Message: {res['message']}")
    print(f"Total Onions: {res['total_onions']}")
    for d in res['detections']:
        print(f"  Onion Box: {d['bbox']} | Confidence: {d['confidence']}")
