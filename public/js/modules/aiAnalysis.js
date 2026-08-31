/**
 * SIH26031 - Module 4 & 5: AI Analysis & Detection Visualizer
 */

import { storageService } from '../services/storageService.js';

export function renderAIAnalysis(container, router, params = {}) {
  const lotId = params.lotId;
  const lot = storageService.getLotById(lotId);

  if (!lot || !lot.ai_results) {
    alert('AI Inspection data missing. Please capture sample.');
    router.navigate('sample', { lotId });
    return;
  }

  const ai = lot.ai_results;
  const isNoOnion = (ai.total_inspected === 0) || (ai.message === "No onion detected");
  const debug = ai.debug_telemetry || {};

  container.innerHTML = `
    <div class="ai-analysis-wrapper">
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">AI Computer Vision Inspection Results</h1>
          <p class="page-subtitle">
            Lot ID: <strong>${lot.lot_id}</strong> • Model Engine: <code>${ai.model_type}</code> • Conf Threshold: <code>${((ai.conf_threshold || 0.60) * 100).toFixed(0)}%</code>
          </p>
        </div>
        <div class="action-buttons">
          <button class="btn btn-secondary" id="btn-re-sample">📷 Recapture Sample</button>
          <button class="btn btn-primary btn-lg" id="btn-proceed-review">
            Proceed to Inspector Sign-Off ➡
          </button>
        </div>
      </div>

      ${isNoOnion ? `
        <div class="alert alert-danger margin-bottom-lg" style="background-color: #fef2f2; border-left: 5px solid #ef4444; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 6px 0; color: #991b1b; font-size: 18px;">⚠️ No onions detected — inspection cannot be completed.</h3>
          <p style="margin: 0; color: #7f1d1d;">
            The inference pipeline did not detect any valid onion bulbs meeting the confidence threshold of <strong>${((ai.conf_threshold || 0.60) * 100).toFixed(0)}%</strong>. Model Engine: <code>${ai.model_type}</code>. Quality grading and procurement sign-off are disabled.
          </p>
        </div>
      ` : ''}

      <!-- Top AI Key KPI Telemetry -->
      <div class="stats-grid">
        <div class="stat-card border-blue">
          <div class="stat-header">
            <span class="stat-title">Total Onions Inspected</span>
            <span class="stat-icon">🧅</span>
          </div>
          <div class="stat-value">${ai.total_inspected} <span class="stat-unit">Bulbs</span></div>
          <div class="stat-meta">${isNoOnion ? 'No Valid Bulbs Detected' : 'Accepted Detections Count'}</div>
        </div>

        <div class="stat-card border-emerald">
          <div class="stat-header">
            <span class="stat-title">Grade A Percentage</span>
            <span class="stat-icon">🏅</span>
          </div>
          <div class="stat-value text-emerald">${ai.grade_a_percentage}${ai.grade_a_percentage !== 'N/A' ? '%' : ''}</div>
          <div class="stat-meta">${isNoOnion ? 'N/A' : `${ai.good} bulbs \u2265 45mm diameter`}</div>
        </div>

        <div class="stat-card border-red">
          <div class="stat-header">
            <span class="stat-title">URS (Under-Spec Sample) %</span>
            <span class="stat-icon">⚠️</span>
          </div>
          <div class="stat-value text-red">${ai.urs_percentage}${ai.urs_percentage !== 'N/A' ? '%' : ''}</div>
          <div class="stat-meta">${isNoOnion ? 'N/A' : `${Math.max(0, ai.total_inspected - ai.good)} sub-standard bulbs`}</div>
        </div>

        <div class="stat-card border-amber">
          <div class="stat-header">
            <span class="stat-title">AI Model Confidence</span>
            <span class="stat-icon">🎯</span>
          </div>
          <div class="stat-value text-amber">${isNoOnion ? 'N/A' : `${(ai.confidence_score * 100).toFixed(0)}%`}</div>
          <div class="stat-meta">Avg Confidence Score</div>
        </div>
      </div>

      <!-- Main Inspection Grid -->
      <div class="ai-content-grid">
        
        <!-- Left: Annotated Image Canvas View -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Annotated Detection Image</h3>
            <div class="defect-legend">
              <span class="legend-item"><span class="dot dot-good"></span> Good</span>
              <span class="legend-item"><span class="dot dot-damaged"></span> Damaged</span>
              <span class="legend-item"><span class="dot dot-rotten"></span> Rotten</span>
              <span class="legend-item"><span class="dot dot-sprouted"></span> Sprouted</span>
              <span class="legend-item"><span class="dot dot-undersized"></span> Undersized</span>
            </div>
          </div>
          <div class="card-body text-center">
            <div class="annotated-image-box">
              <img id="ai-annotated-img" src="${ai.annotated_image}" alt="Annotated AI Inspection Snapshot">
            </div>
          </div>
        </div>

        <!-- Right: Defect Categorization & Size Histogram -->
        <div class="card-stack">
          
          <!-- Defect Count Matrix -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Visible Defect Classification</h3>
            </div>
            <div class="card-body padding-none">
              <ul class="defect-breakdown-list">
                <li class="defect-list-item">
                  <div class="defect-info">
                    <span class="badge badge-good">Good Quality</span>
                    <span class="defect-sub">Clean skin, size &ge; 45mm</span>
                  </div>
                  <div class="defect-count">${ai.good} <span>(${ai.total_inspected ? ((ai.good/ai.total_inspected)*100).toFixed(0) : 0}%)</span></div>
                </li>
                
                <li class="defect-list-item">
                  <div class="defect-info">
                    <span class="badge badge-damaged">Damaged / Cut</span>
                    <span class="defect-sub">Mechanical cuts & bruises</span>
                  </div>
                  <div class="defect-count">${ai.damaged} <span>(${ai.total_inspected ? ((ai.damaged/ai.total_inspected)*100).toFixed(0) : 0}%)</span></div>
                </li>

                <li class="defect-list-item">
                  <div class="defect-info">
                    <span class="badge badge-rotten">Rotten / Mold</span>
                    <span class="defect-sub">Fungal rot / black mold</span>
                  </div>
                  <div class="defect-count text-red"><strong>${ai.rotten}</strong> <span>(${ai.total_inspected ? ((ai.rotten/ai.total_inspected)*100).toFixed(0) : 0}%)</span></div>
                </li>

                <li class="defect-list-item">
                  <div class="defect-info">
                    <span class="badge badge-sprouted">Sprouted</span>
                    <span class="defect-sub">Apical shoot growth</span>
                  </div>
                  <div class="defect-count">${ai.sprouted} <span>(${ai.total_inspected ? ((ai.sprouted/ai.total_inspected)*100).toFixed(0) : 0}%)</span></div>
                </li>

                <li class="defect-list-item">
                  <div class="defect-info">
                    <span class="badge badge-undersized">Undersized (&lt; 45mm)</span>
                    <span class="defect-sub">Diameter below Grade A</span>
                  </div>
                  <div class="defect-count">${ai.undersized} <span>(${ai.total_inspected ? ((ai.undersized/ai.total_inspected)*100).toFixed(0) : 0}%)</span></div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Size Measurement Histogram Table -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Size Measurement (Calibrated Scale)</h3>
            </div>
            <div class="card-body">
              <div class="size-distribution-bars">
                ${Object.entries(ai.size_distribution || { "35-44mm": 0, "45-54mm": 0, "55-64mm": 0, "65mm+": 0 }).map(([range, count]) => {
                  const pct = ai.total_inspected ? ((count / ai.total_inspected) * 100).toFixed(0) : 0;
                  return `
                    <div class="size-bar-row">
                      <span class="size-range-label">${range}</span>
                      <div class="size-bar-track">
                        <div class="size-bar-fill" style="width: ${pct}%;"></div>
                      </div>
                      <span class="size-count-val">${count} (${pct}%)</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Summary Panel -->
      ${ai.summary_panel ? `
        <div class="card margin-top-lg border-emerald" style="background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); border: 1px solid #bbf7d0;">
          <div class="card-header">
            <h3 class="card-title text-emerald">📊 Onion Inspection Summary Panel</h3>
            <span class="badge badge-good">${ai.summary_panel.total_onions} Total Onions</span>
          </div>
          <div class="card-body">
            <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
              <div class="metric-card" style="background:#fff; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div class="metric-value" style="font-size:22px; font-weight:bold; color:#10b981;">${ai.summary_panel.good}</div>
                <div class="metric-label" style="font-size:12px; color:#64748b;">Good (Green)</div>
              </div>
              <div class="metric-card" style="background:#fff; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div class="metric-value" style="font-size:22px; font-weight:bold; color:#f59e0b;">${ai.summary_panel.average}</div>
                <div class="metric-label" style="font-size:12px; color:#64748b;">Average (Yellow)</div>
              </div>
              <div class="metric-card" style="background:#fff; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div class="metric-value" style="font-size:22px; font-weight:bold; color:#ef4444;">${ai.summary_panel.bad}</div>
                <div class="metric-label" style="font-size:12px; color:#64748b;">Bad (Red)</div>
              </div>
              <div class="metric-card" style="background:#fff; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div class="metric-value" style="font-size:20px; font-weight:bold; color:#3b82f6;">${ai.summary_panel.average_diameter}</div>
                <div class="metric-label" style="font-size:12px; color:#64748b;">Avg Diameter</div>
              </div>
              <div class="metric-card" style="background:#fff; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div class="metric-value" style="font-size:20px; font-weight:bold; color:#6b7280;">${ai.summary_panel.smallest_onion}</div>
                <div class="metric-label" style="font-size:12px; color:#64748b;">Smallest</div>
              </div>
              <div class="metric-card" style="background:#fff; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div class="metric-value" style="font-size:20px; font-weight:bold; color:#8b5cf6;">${ai.summary_panel.largest_onion}</div>
                <div class="metric-label" style="font-size:12px; color:#64748b;">Largest</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Individual Detections Telemetry Table -->
      <div class="card margin-top-lg">
        <div class="card-header">
          <h3 class="card-title">🔍 Individual Onion Measurements & Classification Table</h3>
          <span class="badge badge-good">${ai.detections ? ai.detections.length : 0} Accepted Detections</span>
        </div>
        <div class="card-body padding-none">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Diameter</th>
                  <th>Size Class</th>
                  <th>Quality Class</th>
                  <th>Confidence Score</th>
                  <th>Center Position (x, y)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${(ai.detections && ai.detections.length > 0) ? ai.detections.map(d => `
                  <tr>
                    <td><strong>#${d.id}</strong></td>
                    <td><strong>${d.diameter} ${d.unit || 'px'}</strong></td>
                    <td><span class="badge badge-outline">${d.size_class || 'Medium'}</span></td>
                    <td>
                      <span class="badge" style="background-color: ${d.color === 'green' ? '#10b981' : d.color === 'yellow' ? '#f59e0b' : '#ef4444'}; color: #fff;">
                        ${(d.quality_category || d.classification || 'GOOD').toUpperCase()}
                      </span>
                    </td>
                    <td><strong>${(d.confidence * 100).toFixed(0)}%</strong> <code>(${d.confidence})</code></td>
                    <td><code>[${d.center ? d.center.join(', ') : ''}]</code></td>
                    <td><span class="text-emerald font-bold">✓ ACCEPTED</span></td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="7" class="text-center padding-lg text-muted">No accepted detections found meeting confidence threshold.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Debug Telemetry Panel (if debug mode active or telemetry present) -->
      ${(debug.raw_proposals_count !== undefined || (debug.rejected_detections && debug.rejected_detections.length > 0)) ? `
        <div class="card margin-top-lg border-amber" style="border: 2px dashed #f59e0b;">
          <div class="card-header bg-amber-light">
            <h3 class="card-title text-amber">🐛 AI Pipeline Debug Telemetry</h3>
            <div>
              <span class="badge badge-outline">Proposals: ${debug.raw_proposals_count || 0}</span>
              <span class="badge badge-good">Accepted: ${debug.accepted_count || 0}</span>
              <span class="badge badge-red">Rejected: ${debug.rejected_count || 0}</span>
            </div>
          </div>
          <div class="card-body">
            <h4 style="margin-top:0; font-size:14px;">Rejected Proposals & Suppression Log</h4>
            <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
              <table class="table table-sm" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th>BBox</th>
                    <th>Confidence Score</th>
                    <th>Rejection Reason</th>
                  </tr>
                </thead>
                <tbody>
                  ${(debug.rejected_detections && debug.rejected_detections.length > 0) ? debug.rejected_detections.map(r => `
                    <tr>
                      <td><code>[${r.bbox ? r.bbox.join(', ') : ''}]</code></td>
                      <td><strong class="text-red">${(r.confidence * 100).toFixed(0)}%</strong> <code>(${r.confidence})</code></td>
                      <td class="text-red">${r.reason || 'Below confidence threshold / Suppressed'}</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="3" class="text-muted text-center">No proposals were rejected.</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}

    </div>
  `;

  // Attach Event Handlers
  document.getElementById('btn-re-sample').addEventListener('click', () => router.navigate('sample', { lotId }));
  document.getElementById('btn-proceed-review').addEventListener('click', () => {
    if (isNoOnion) {
      alert('No onions detected — inspection cannot be completed. Please recapture or upload a valid sample image containing onions.');
      return;
    }
    router.navigate('review', { lotId });
  });
}

