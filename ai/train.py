"""
SIH26031 - Onion AI Model Training Script
Trains YOLO26n model on local YOLO onion dataset (1 class: 'onion').
Saves trained model weights to ai/models/best.pt and backend/weights/best.pt.
"""

import os
import sys
import argparse
import shutil

def train_onion_model(data_path="dataset/data.yaml", epochs=25, imgsz=640, batch=16, model_weights="yolov8n.pt", output_dir="ai/models"):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[AI Train] Error: 'ultralytics' package is not installed. Please run: pip install ultralytics")
        sys.exit(1)

    abs_data_path = os.path.abspath(data_path)
    if not os.path.exists(abs_data_path):
        raise FileNotFoundError(f"[AI Train] Dataset configuration not found at: {abs_data_path}")

    os.makedirs(output_dir, exist_ok=True)
    print(f"[AI Train] Starting YOLO Onion Model Training...")
    print(f"  - Dataset Config: {abs_data_path}")
    print(f"  - Base Architecture: {model_weights}")
    print(f"  - Epochs: {epochs}, Batch Size: {batch}, Image Size: {imgsz}")

    # Load YOLO base model
    model = YOLO(model_weights)

    # Train model on onion dataset
    results = model.train(
        data=abs_data_path,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project="runs/detect",
        name="onion_train",
        exist_ok=True,
        save=True
    )

    # Locate trained weights
    best_weights_src = os.path.join("runs", "detect", "onion_train", "weights", "best.pt")
    target_weights_path = os.path.join(output_dir, "best.pt")

    if os.path.exists(best_weights_src):
        shutil.copy(best_weights_src, target_weights_path)
        print(f"[AI Train] Successfully saved trained model to: {target_weights_path}")

        # Also copy to backend/weights/best.pt for backend integration
        backend_weights_dir = os.path.abspath(os.path.join("backend", "weights"))
        os.makedirs(backend_weights_dir, exist_ok=True)
        backend_best_path = os.path.join(backend_weights_dir, "best.pt")
        shutil.copy(best_weights_src, backend_best_path)
        print(f"[AI Train] Updated backend weights at: {backend_best_path}")
    else:
        print(f"[AI Train] Warning: Trained weights not found at {best_weights_src}")

    return target_weights_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SIH26031 YOLO Onion Model Training Script")
    parser.add_argument("--data", type=str, default="dataset/data.yaml", help="Path to dataset data.yaml")
    parser.add_argument("--epochs", type=int, default=25, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Image input size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model architecture (e.g. yolov8n.pt or yolo11n.pt)")
    parser.add_argument("--output", type=str, default="ai/models", help="Directory to save trained model")

    args = parser.parse_args()
    train_onion_model(
        data_path=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        model_weights=args.model,
        output_dir=args.output
    )
