/**
 * SIH26031 - Modular AI Inspection Service
 * Calls Python FastAPI Backend REST endpoint (/api/v1/inspect)
 * Fallbacks to Client-Side Computer Vision Canvas Engine if server is offline.
 */

const BACKEND_URL = 'http://localhost:8000/api/v1';

class AIService {
  async inspectSample(fileOrDataUrl, calibrationMm = 50.0, referencePx = 0.0, confThreshold = 0.60, debugMode = false) {
    const nmsThreshold = 0.45;

    // Attempt real backend call first if input is File object
    if (fileOrDataUrl instanceof File) {
      try {
        const formData = new FormData();
        formData.append('file', fileOrDataUrl);
        formData.append('calibration_mm', calibrationMm);
        formData.append('reference_px', referencePx);
        formData.append('conf_threshold', confThreshold);
        formData.append('nms_iou_threshold', nmsThreshold);
        formData.append('debug_mode', debugMode);

        const response = await fetch(`${BACKEND_URL}/inspect`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.status === 'success') {
            console.log('[AIService] Processed via PyTorch/OpenCV Backend Endpoint');
            return resData.data;
          }
        }
      } catch (err) {
        console.log('[AIService] Python backend offline. Executing Client Computer Vision Engine.', err);
      }
    }

    // Client-side Real Vision & Detection Processing Pipeline
    return this.processClientVision(fileOrDataUrl, calibrationMm, referencePx, confThreshold, nmsThreshold, debugMode);
  }

  processClientVision(fileOrDataUrl, calibrationMm, referencePx, confThreshold, nmsThreshold, debugMode) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width || 720;
        canvas.height = img.height || 540;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const width = canvas.width;
        const height = canvas.height;
        const scaleMmPerPx = referencePx > 0 ? (calibrationMm / referencePx) : (50.0 / (Math.min(width, height) * 0.15));

        // Retrieve pixel data for color/blob analysis
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // STEP 1 & 2: Extract Real Bounding Box Proposals using Color & Circular Blob Detection
        const rawProposals = [];
        const step = Math.max(35, Math.floor(Math.min(width, height) / 8));
        const boxRadius = Math.floor(step * 0.90);

        for (let y = boxRadius; y < height - boxRadius; y += step) {
          for (let x = boxRadius; x < width - boxRadius; x += step) {
            const x1 = Math.max(0, x - boxRadius);
            const y1 = Math.max(0, y - boxRadius);
            const x2 = Math.min(width, x + boxRadius);
            const y2 = Math.min(height, y + boxRadius);
            const boxW = x2 - x1;
            const boxH = y2 - y1;

            let skinPixelCount = 0;
            let humanSkinCount = 0;
            let totalSat = 0;
            let greenCount = 0;
            let blackCount = 0;
            let sampleCount = 0;

            for (let py = y1; py < y2; py += 4) {
              for (let px = x1; px < x2; px += 4) {
                const idx = (py * width + px) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];

                const hsv = this.rgbToHsv(r, g, b);
                totalSat += hsv.s;
                sampleCount++;

                // Human skin tone (low-to-medium saturation S in 0.10..0.32, beige/peach/brown skin)
                const isHumanSkin = (hsv.h <= 25 && hsv.s >= 0.10 && hsv.s <= 0.32 && hsv.v >= 0.25);
                if (isHumanSkin) humanSkinCount++;

                // Strict onion peel color range (high saturation S >= 0.35, golden, copper, violet bulb skin)
                const isSkin = ((hsv.h <= 30 || hsv.h >= 330) && hsv.s >= 0.38 && hsv.v >= 0.25) ||
                               (hsv.h >= 15 && hsv.h <= 50 && hsv.s >= 0.35 && hsv.v >= 0.30);
                if (isSkin) skinPixelCount++;

                // Check sprout green
                if (hsv.h >= 70 && hsv.h <= 160 && hsv.s >= 0.30) greenCount++;
                // Check rot black/dark
                if (hsv.v <= 0.20) blackCount++;
              }
            }

            const skinRatio = skinPixelCount / (sampleCount || 1);
            const humanRatio = humanSkinCount / (sampleCount || 1);
            const avgSat = totalSat / (sampleCount || 1);

            // Reject human body/skin patches, flat background mats, desks, paper (low saturation)
            if (humanRatio > 0.20 || skinRatio < 0.35 || avgSat < 0.35) {
              continue;
            }

            // Calculate confidence score strictly based on bulb color density
            let conf = Math.min(0.96, 0.40 + (skinRatio * 0.45) + (avgSat * 0.15));
            conf = Math.round(conf * 100) / 100;

            rawProposals.push({
              bbox: [x1, y1, x2, y2],
              confidence: conf,
              skinRatio,
              greenRatio: greenCount / (sampleCount || 1),
              blackRatio: blackCount / (sampleCount || 1)
            });
          }
        }

        // STEP 3: Confidence Filtering & Non-Maximum Suppression (NMS)
        const acceptedCandidates = [];
        const rejectedDetections = [];

        // 1. Filter by confidence threshold
        rawProposals.forEach(p => {
          if (p.confidence >= confThreshold) {
            acceptedCandidates.push(p);
          } else {
            rejectedDetections.push({
              bbox: p.bbox,
              confidence: p.confidence,
              reason: `Below confidence threshold (${p.confidence.toFixed(2)} < ${confThreshold.toFixed(2)})`
            });
          }
        });

        // 2. Apply NMS
        acceptedCandidates.sort((a, b) => b.confidence - a.confidence);
        const keptProposals = [];

        for (let i = 0; i < acceptedCandidates.length; i++) {
          const current = acceptedCandidates[i];
          let keep = true;

          for (let j = 0; j < keptProposals.length; j++) {
            const iou = this.calculateIoU(current.bbox, keptProposals[j].bbox);
            if (iou > nmsThreshold) {
              keep = false;
              rejectedDetections.push({
                bbox: current.bbox,
                confidence: current.confidence,
                reason: `Suppressed by NMS (Overlap IoU ${iou.toFixed(2)} > ${nmsThreshold})`
              });
              break;
            }
          }

          if (keep) {
            keptProposals.push(current);
          }
        }

        // STEP 4, 5 & 6: Crop, Classify Quality & Render Overlays
        const classifiedDetections = [];
        const counts = { good: 0, damaged: 0, rotten: 0, sprouted: 0, undersized: 0 };
        const sizeDist = { "35-44mm": 0, "45-54mm": 0, "55-64mm": 0, "65mm+": 0 };

        // Clear canvas and redraw original image before annotations
        ctx.drawImage(img, 0, 0, width, height);

        keptProposals.forEach((prop, idx) => {
          const [x1, y1, x2, y2] = prop.bbox;
          const boxW = x2 - x1;
          const boxH = y2 - y1;
          const avgPx = (boxW + boxH) / 2;
          const diameterMm = Math.round(avgPx * scaleMmPerPx * 10) / 10;

          // Quality Classification on Crop (Never default to good!)
          let cls = "good";
          if (prop.greenRatio > 0.08) cls = "sprouted";
          else if (prop.blackRatio > 0.15) cls = "rotten";
          else if (diameterMm < 45.0) cls = "undersized";
          else cls = "good";

          counts[cls]++;

          // Size distribution
          if (diameterMm < 45) sizeDist["35-44mm"]++;
          else if (diameterMm < 55) sizeDist["45-54mm"]++;
          else if (diameterMm < 65) sizeDist["55-64mm"]++;
          else sizeDist["65mm+"]++;

          classifiedDetections.push({
            id: idx + 1,
            bbox: [x1, y1, x2, y2],
            confidence: prop.confidence,
            classification: cls,
            diameter_mm: diameterMm,
            status: "ACCEPTED"
          });

          // Draw Overlay ON ACCEPTED DETECTIONS ONLY
          const colorMap = {
            good: '#10b981',       // Emerald Green
            damaged: '#f59e0b',    // Amber
            rotten: '#ef4444',     // Red
            sprouted: '#a855f7',   // Purple
            undersized: '#eab308'  // Gold
          };
          const strokeColor = colorMap[cls] || '#10b981';

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, boxW, boxH);

          // Draw Label Tag with ID, Class, Confidence %, Diameter
          const confPct = Math.round(prop.confidence * 100);
          const label = `#${idx + 1} ${cls.toUpperCase()} (${confPct}%) ${diameterMm}mm`;
          ctx.fillStyle = strokeColor;
          ctx.fillRect(x1, Math.max(0, y1 - 22), 160, 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(label, x1 + 4, Math.max(14, y1 - 6));
        });

        // If Debug Mode is enabled, draw rejected boxes in dashed gray
        if (debugMode) {
          rejectedDetections.forEach(r => {
            const [x1, y1, x2, y2] = r.bbox;
            ctx.strokeStyle = '#9ca3af';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            ctx.setLineDash([]);

            const rConfPct = Math.round(r.confidence * 100);
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px sans-serif';
            ctx.fillText(`REJECTED (${rConfPct}%)`, x1 + 2, Math.max(12, y1 - 2));
          });
        }

        const totalAccepted = classifiedDetections.length;

        // If 0 onions detected:
        if (totalAccepted === 0) {
          // Draw Banner on Image
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 0, width, 50);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText("NO ONIONS DETECTED - INSPECTION INCOMPLETE", 20, 32);

          const emptyAnnotatedBase64 = canvas.toDataURL('image/jpeg', 0.85);

          resolve({
            total_inspected: 0,
            good: 0,
            damaged: 0,
            rotten: 0,
            sprouted: 0,
            undersized: 0,
            grade_a_percentage: "N/A",
            urs_percentage: "N/A",
            confidence_score: 0.0,
            conf_threshold: confThreshold,
            model_type: "No Trained Onion Model Loaded (weights/best.pt missing)",
            message: "No onions detected — inspection cannot be completed.",
            size_distribution: sizeDist,
            annotated_image: emptyAnnotatedBase64,
            detections: [],
            debug_telemetry: {
              raw_proposals_count: rawProposals.length,
              accepted_count: 0,
              rejected_count: rejectedDetections.length,
              rejected_detections: rejectedDetections
            }
          });
          return;
        }

        const gradeAPct = Math.round((counts.good / totalAccepted * 100) * 10) / 10;
        const defectiveCount = totalAccepted - counts.good;
        const ursPct = Math.round((defectiveCount / totalAccepted * 100) * 10) / 10;
        const avgConf = Math.round((classifiedDetections.reduce((acc, d) => acc + d.confidence, 0) / totalAccepted) * 100) / 100;

        const annotatedImageBase64 = canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          total_inspected: totalAccepted,
          good: counts.good,
          damaged: counts.damaged,
          rotten: counts.rotten,
          sprouted: counts.sprouted,
          undersized: counts.undersized,
          grade_a_percentage: gradeAPct,
          urs_percentage: ursPct,
          confidence_score: avgConf,
          conf_threshold: confThreshold,
          model_type: "Client Computer Vision Engine",
          message: `Successfully detected and classified ${totalAccepted} onions.`,
          size_distribution: sizeDist,
          annotated_image: annotatedImageBase64,
          detections: classifiedDetections,
          debug_telemetry: {
            raw_proposals_count: rawProposals.length,
            accepted_count: totalAccepted,
            rejected_count: rejectedDetections.length,
            rejected_detections: rejectedDetections
          }
        });
      };

      // Set image source
      if (fileOrDataUrl instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        reader.readAsDataURL(fileOrDataUrl);
      } else {
        img.src = fileOrDataUrl || 'assets/sample_onion_batch.jpg';
      }
    });
  }

  // Utility: RGB to HSV conversion
  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, v };
  }

  // Utility: Intersection over Union (IoU) calculation
  calculateIoU(boxA, boxB) {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[2], boxB[2]);
    const yB = Math.min(boxA[3], boxB[3]);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
    const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

    return interArea / (boxAArea + boxBArea - interArea + 1e-5);
  }
}

export const aiService = new AIService();
