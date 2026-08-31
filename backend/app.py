"""
SIH26031 - FastAPI Backend REST Server for Onion Procurement Quality Inspection
Provides REST endpoints for Lot Management, AI Inspection Inference, and Quality Reports.
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import uvicorn
from yolo_pipeline import YOLOOnionInspector

app = FastAPI(
    title="SIH26031 Onion Quality Inspection & Procurement API",
    description="Operational API for Onion Procurement Centre Inspection, YOLO Detection & Size Classification",
    version="1.0.0"
)

# Enable CORS for frontend application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Inspector
inspector = YOLOOnionInspector(model_path="weights/best.pt")

# In-memory storage for lots (mirrored with persistent frontend DB)
lots_db = {}

@app.get("/api/v1/health")
def health_check():
    if not inspector.model:
        inspector.__init__(model_path="ai/models/best.pt")
    return {
        "status": "online",
        "system": "SIH26031 Procurement Centre System",
        "yolo_model_loaded": inspector.model is not None,
        "mode": "Live PyTorch YOLO (best.pt)" if inspector.model else "No Trained Onion Model Loaded"
    }

@app.post("/api/v1/inspect")
async def inspect_onion_sample(
    file: UploadFile = File(...),
    calibration_mm: float = Form(50.0),
    reference_px: float = Form(0.0),
    conf_threshold: float = Form(0.60),
    nms_iou_threshold: float = Form(0.45),
    debug_mode: bool = Form(False)
):
    """
    Receives sample image file, calibration scale, confidence threshold, NMS, and debug flags.
    Performs onion detection using trained YOLO weights (ai/models/best.pt).
    """
    try:
        if not inspector.model:
            inspector.__init__(model_path="ai/models/best.pt")
        image_bytes = await file.read()
        results = inspector.inspect_image(
            image_bytes,
            calibration_mm=calibration_mm,
            reference_px=reference_px,
            conf_threshold=conf_threshold,
            nms_iou_threshold=nms_iou_threshold,
            debug_mode=debug_mode
        )
        return JSONResponse(content={"status": "success", "data": results})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image inspection failed: {str(e)}")

@app.get("/api/v1/lots")
def get_all_lots():
    return {"status": "success", "lots": list(lots_db.values())}

@app.post("/api/v1/lots")
def create_or_update_lot(lot: dict):
    lot_id = lot.get("lot_id")
    if not lot_id:
        raise HTTPException(status_code=400, detail="Missing lot_id")
    lots_db[lot_id] = lot
    return {"status": "success", "lot": lot}

# Serve static frontend files if directory exists
public_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
if os.path.exists(public_path):
    app.mount("/", StaticFiles(directory=public_path, html=True), name="static")

if __name__ == "__main__":
    print("[SIH26031] Starting FastAPI Server on http://localhost:8000")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
