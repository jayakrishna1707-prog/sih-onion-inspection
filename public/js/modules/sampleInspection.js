/**
 * SIH26031 - Module 3: Sample Inspection / Camera & Scale Calibration
 */

import { storageService } from '../services/storageService.js';
import { aiService } from '../services/aiService.js';

export function renderSampleInspection(container, router, params = {}) {
  const lotId = params.lotId;
  const lot = storageService.getLotById(lotId);

  if (!lot) {
    alert('Lot not found! Returning to Dashboard.');
    router.navigate('dashboard');
    return;
  }

  let capturedImageFile = null;
  let capturedDataUrl = 'assets/sample_onion_batch.jpg';
  let cameraStream = null;

  container.innerHTML = `
    <div class="sample-wrapper">
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Sample Image Capture & Calibration</h1>
          <p class="page-subtitle">Lot ID: <strong>${lot.lot_id}</strong> • Farmer: ${lot.farmer_name}</p>
        </div>
        <button class="btn btn-secondary" id="btn-back-reg">⬅ Back</button>
      </div>

      <div class="sample-grid">
        <!-- Left: Image Source / Camera View -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📷 Field Camera Feed / File Upload</h3>
            <div class="source-toggles">
              <button class="btn btn-sm btn-outline active" id="tab-sample-img">Sample Batch</button>
              <button class="btn btn-sm btn-outline" id="tab-live-cam">Live Camera</button>
              <button class="btn btn-sm btn-outline" id="tab-upload">Upload File</button>
            </div>
          </div>
          <div class="card-body text-center">
            
            <!-- Camera View Container -->
            <div class="viewfinder-box" id="viewfinder">
              <img id="preview-image" src="assets/sample_onion_batch.jpg" alt="Onion Sample Batch">
              <video id="camera-video" autoplay playsinline style="display:none; width:100%; height:100%; object-fit:cover;"></video>
              
              <!-- Target Overlay Guidelines -->
              <div class="camera-grid-overlay">
                <div class="calibration-target-box">
                  <span>Target 50mm Coin Here</span>
                </div>
              </div>
            </div>

            <!-- Hidden File Input -->
            <input type="file" id="file-input" accept="image/*" style="display:none;">

            <div class="viewfinder-controls margin-top-md">
              <button class="btn btn-secondary" id="btn-snap" style="display:none;">📸 Capture Frame</button>
              <button class="btn btn-outline" id="btn-choose-file" style="display:none;">📁 Select Image File</button>
            </div>

          </div>
        </div>

        <!-- Right: Scale Calibration Settings -->
        <div class="card">
          <div class="card-header bg-emerald-dark text-white">
            <h3 class="card-title text-white">📐 Reference Calibration Scale</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Reference Calibration Target</label>
              <select id="calib-target-type" class="form-control">
                <option value="50">Standard 50mm Reference Target / Coin</option>
                <option value="25">25mm Standard APMC Ring Token</option>
                <option value="100">100mm Field Grid Mat Square</option>
              </select>
            </div>

            <div class="form-group margin-top-md">
              <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                <span>🎯 Detection Confidence Threshold</span>
                <span id="conf-val-badge" class="badge badge-good" style="font-size:12px;">0.60 (60%)</span>
              </label>
              <input type="range" id="conf-threshold" class="form-control" min="0.10" max="0.95" step="0.05" value="0.60">
              <span class="form-help">Reject detections below this score. Default is 0.60 (60%).</span>
            </div>

            <div class="form-group margin-top-md" style="background:#f8fafc; padding:10px 12px; border-radius:6px; border:1px solid #e2e8f0; display:flex; align-items:center; gap:10px;">
              <input type="checkbox" id="toggle-debug-mode" style="width:18px; height:18px; cursor:pointer;">
              <label for="toggle-debug-mode" style="cursor:pointer; margin:0; font-size:13px; font-weight:600; color:#334155;">
                🐛 Enable AI Debug Mode (Displays raw proposals, rejected boxes & reasons)
              </label>
            </div>

            <div class="calibration-status-box margin-top-lg">
              <div class="status-icon">✓</div>
              <div>
                <strong>Scale Calibrated</strong>
                <p>Ratio: ~0.24 mm/pixel (Field Resolution Ready)</p>
              </div>
            </div>

            <div class="margin-top-xl text-center">
              <button class="btn btn-primary btn-lg full-width" id="btn-run-ai">
                ⚡ Execute AI Segmentation & Inspection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  document.getElementById('btn-back-reg').addEventListener('click', () => router.navigate('register'));

  const confInput = document.getElementById('conf-threshold');
  const confBadge = document.getElementById('conf-val-badge');
  if (confInput && confBadge) {
    confInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value).toFixed(2);
      confBadge.textContent = `${val} (${Math.round(val * 100)}%)`;
    });
  }

  const tabSample = document.getElementById('tab-sample-img');
  const tabCam = document.getElementById('tab-live-cam');
  const tabUpload = document.getElementById('tab-upload');

  const previewImg = document.getElementById('preview-image');
  const cameraVideo = document.getElementById('camera-video');
  const btnSnap = document.getElementById('btn-snap');
  const btnChoose = document.getElementById('btn-choose-file');
  const fileInput = document.getElementById('file-input');

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  };

  tabSample.addEventListener('click', () => {
    stopCamera();
    tabSample.classList.add('active');
    tabCam.classList.remove('active');
    tabUpload.classList.remove('active');

    previewImg.style.display = 'block';
    cameraVideo.style.display = 'none';
    btnSnap.style.display = 'none';
    btnChoose.style.display = 'none';
    previewImg.src = 'assets/sample_onion_batch.jpg';
    capturedDataUrl = 'assets/sample_onion_batch.jpg';
    capturedImageFile = null;
  });

  tabCam.addEventListener('click', async () => {
    tabCam.classList.add('active');
    tabSample.classList.remove('active');
    tabUpload.classList.remove('active');

    previewImg.style.display = 'none';
    cameraVideo.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnChoose.style.display = 'none';

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraVideo.srcObject = cameraStream;
    } catch (err) {
      alert('Camera access unavailable or blocked. Please select Upload File or Sample Batch.');
      tabSample.click();
    }
  });

  tabUpload.addEventListener('click', () => {
    stopCamera();
    tabUpload.classList.add('active');
    tabSample.classList.remove('active');
    tabCam.classList.remove('active');

    previewImg.style.display = 'block';
    cameraVideo.style.display = 'none';
    btnSnap.style.display = 'none';
    btnChoose.style.display = 'inline-block';
    fileInput.click();
  });

  btnChoose.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      capturedImageFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        capturedDataUrl = evt.target.result;
        previewImg.src = capturedDataUrl;
      };
      reader.readAsDataURL(capturedImageFile);
    }
  });

  btnSnap.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth || 640;
    canvas.height = cameraVideo.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    capturedDataUrl = canvas.toDataURL('image/jpeg');
    
    stopCamera();
    cameraVideo.style.display = 'none';
    previewImg.style.display = 'block';
    previewImg.src = capturedDataUrl;
    btnSnap.style.display = 'none';
  });

  // Run AI Inspection
  document.getElementById('btn-run-ai').addEventListener('click', async () => {
    const btn = document.getElementById('btn-run-ai');
    btn.disabled = true;
    btn.innerHTML = '⏳ Running AI Computer Vision Model...';

    try {
      const calibMm = parseFloat(document.getElementById('calib-mm')?.value || 50.0);
      const confThreshold = parseFloat(document.getElementById('conf-threshold')?.value || 0.60);
      const debugMode = document.getElementById('toggle-debug-mode')?.checked || false;

      const imageSource = capturedImageFile || capturedDataUrl || previewImg.src;

      const aiResults = await aiService.inspectSample(
        imageSource,
        calibMm,
        0.0,
        confThreshold,
        debugMode
      );
      
      // Save AI results to lot object
      lot.ai_results = aiResults;
      await storageService.saveLot(lot);

      router.navigate('ai-analysis', { lotId: lot.lot_id });
    } catch (err) {
      console.error('[sampleInspection] AI Inspection failed:', err);
      alert('Inspection failed: ' + (err.message || 'Error executing AI model.'));
      btn.disabled = false;
      btn.innerHTML = '🔍 Run AI Computer Vision Inspection';
    }
  });
}
