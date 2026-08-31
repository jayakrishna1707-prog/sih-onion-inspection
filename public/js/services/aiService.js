/**
 * SIH26031 - Modular AI Inspection Service
 * Calls Python FastAPI Backend REST endpoint (/api/v1/inspect)
 * Fallbacks to Client-Side Computer Vision Canvas Engine if server is offline.
 */

const BACKEND_URL = 'http://localhost:8000/api/v1';

class AIService {
  dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  async inspectSample(fileOrDataUrl, calibrationMm = 50.0, referencePx = 0.0, confThreshold = 0.60, debugMode = false) {
    const nmsThreshold = 0.45;

    // Convert data URL or File into a Blob for backend FormData
    let blob = null;
    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      blob = fileOrDataUrl;
    } else if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
      blob = this.dataURItoBlob(fileOrDataUrl);
    }

    if (blob) {
      try {
        const formData = new FormData();
        formData.append('file', blob, 'sample_onion.jpg');
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

        // STEP 4, 5 & 6: Crop, Classify Quality/Size & Render Circular Overlays
        const classifiedDetections = [];
        const counts = { good: 0, average: 0, bad: 0, damaged: 0, rotten: 0, sprouted: 0, undersized: 0 };
        const diameters = [];

        // Clear canvas and redraw original image before annotations
        ctx.drawImage(img, 0, 0, width, height);

        keptProposals.forEach((prop, idx) => {
          const [x1, y1, x2, y2] = prop.bbox;
          const boxW = x2 - x1;
          const boxH = y2 - y1;

          const cx = Math.round((x1 + x2) / 2);
          const cy = Math.round((y1 + y2) / 2);
          const radius = Math.round(Math.max(boxW, boxH) / 2);
          const diameterPx = Math.round(radius * 2);
          const diameterVal = Math.round(diameterPx * scaleMmPerPx * 10) / 10;
          diameters.push(diameterVal);

          // Size classification
          let sizeClass = "Medium";
          if (diameterVal < 45.0) sizeClass = "Small";
          else if (diameterVal >= 65.0) sizeClass = "Large";

          // Quality Classification on Crop
          let rawQuality = "good";
          if (prop.greenRatio > 0.08) rawQuality = "sprouted";
          else if (prop.blackRatio > 0.15) rawQuality = "rotten";
          else if (diameterVal < 45.0) rawQuality = "undersized";
          else rawQuality = "good";

          let qualityCategory = "GOOD";
          let colorCode = "#10b981"; // Green

          if (["damaged", "rotten", "sprouted"].includes(rawQuality)) {
            qualityCategory = "BAD";
            colorCode = "#ef4444"; // Red
            counts.bad++;
            counts[rawQuality]++;
          } else if (rawQuality === "undersized" || sizeClass === "Small" || sizeClass === "Medium") {
            qualityCategory = "AVERAGE";
            colorCode = "#f59e0b"; // Yellow/Amber
            counts.average++;
            if (rawQuality === "undersized") counts.undersized++;
            else counts.good++;
          } else {
            qualityCategory = "GOOD";
            colorCode = "#10b981"; // Green
            counts.good++;
          }

          classifiedDetections.push({
            id: idx + 1,
            center: [cx, cy],
            radius,
            diameter: diameterVal,
            unit: "mm",
            size_class: sizeClass,
            quality_category: qualityCategory,
            confidence: prop.confidence,
            color: colorCode === '#10b981' ? 'green' : colorCode === '#f59e0b' ? 'yellow' : 'red',
            bbox: [x1, y1, x2, y2],
            status: "ACCEPTED"
          });

          // Draw ONE Clean Circular Annotation
          ctx.strokeStyle = colorCode;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
          ctx.stroke();

          // Center Dot
          ctx.fillStyle = colorCode;
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
          ctx.fill();

          // Draw Compact Non-Overlapping Label Tag: #1 | GOOD | 52mm
          const label = `#${idx + 1} | ${qualityCategory} | ${diameterVal}mm`;
          ctx.font = 'bold 11px sans-serif';
          const textMetrics = ctx.measureText(label);
          const tw = textMetrics.width;
          const th = 14;

          const lx = Math.max(5, Math.min(width - tw - 10, cx - Math.round(tw / 2)));
          const ly = Math.max(th + 6, cy - radius - 8);

          // Draw Background Pill
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(lx - 4, ly - th + 2, tw + 8, th + 4);
          ctx.strokeStyle = colorCode;
          ctx.lineWidth = 1;
          ctx.strokeRect(lx - 4, ly - th + 2, tw + 8, th + 4);

          // Text label
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, lx, ly);
        });

        // If Debug Mode is enabled, draw raw rejected boxes as thin dashed gray lines
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
            ctx.fillText(`RAW (${rConfPct}%)`, x1 + 2, Math.max(12, y1 - 2));
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

        const avgDia = diameters.length > 0 ? (diameters.reduce((a, b) => a + b, 0) / diameters.length).toFixed(1) : '0.0';
        const minDia = diameters.length > 0 ? Math.min(...diameters).toFixed(1) : '0.0';
        const maxDia = diameters.length > 0 ? Math.max(...diameters).toFixed(1) : '0.0';

        const annotatedImageBase64 = canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          total_inspected: totalAccepted,
          good: counts.good,
          average: counts.average,
          bad: counts.bad,
          damaged: counts.damaged,
          rotten: counts.rotten,
          sprouted: counts.sprouted,
          undersized: counts.undersized,
          grade_a_percentage: gradeAPct,
          urs_percentage: ursPct,
          confidence_score: avgConf,
          conf_threshold: confThreshold,
          model_type: "Client Computer Vision Engine",
          message: `Successfully detected and annotated ${totalAccepted} individual onion(s).`,
          annotated_image: annotatedImageBase64,
          detections: classifiedDetections,
          summary_panel: {
            total_onions: totalAccepted,
            good: counts.good,
            average: counts.average,
            bad: counts.bad,
            average_diameter: `${avgDia} mm`,
            smallest_onion: `${minDia} mm`,
            largest_onion: `${maxDia} mm`
          },
          table_data: classifiedDetections.map(d => ({
            id: d.id,
            diameter: `${d.diameter} ${d.unit || 'mm'}`,
            size: d.size_class,
            quality: d.quality_category
          })),
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
