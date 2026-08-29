/**
 * SIH26031 - Module 8: Digital Quality Report & PDF Certificate Viewer
 */

import { storageService } from '../services/storageService.js';
import { pdfService } from '../services/pdfService.js';

export function renderQualityReport(container, router, params = {}) {
  const lotId = params.lotId;
  const lot = storageService.getLotById(lotId);

  if (!lot) {
    alert('Lot record not found.');
    router.navigate('history');
    return;
  }

  const ai = lot.ai_results || {};
  const rev = lot.review || {};

  const isAccepted = lot.status === 'ACCEPTED' || rev.decision === 'ACCEPT';

  container.innerHTML = `
    <div class="report-wrapper">
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Digital Quality Certificate</h1>
          <p class="page-subtitle">Lot ID: <strong>${lot.lot_id}</strong> • APMC Official Procurement Record</p>
        </div>
        <div class="action-buttons">
          <button class="btn btn-outline" id="btn-back-hist">⬅ History</button>
          <button class="btn btn-secondary" id="btn-edit-review">✏ Edit Review</button>
          <button class="btn btn-primary btn-lg" id="btn-print-cert">🖨️ Download / Print Official PDF</button>
        </div>
      </div>

      <!-- Printable Certificate Box container -->
      <div class="card cert-display-card margin-center max-w-4xl">
        
        <div class="cert-header-bar">
          <div>
            <div class="cert-gov-title">National Agricultural Procurement Portal</div>
            <h2 class="cert-main-title">ONION QUALITY ASSESSMENT CERTIFICATE</h2>
            <div class="cert-code">Document Ref: SIH26031 / ${lot.lot_id}</div>
          </div>
          <div class="cert-status-tag ${isAccepted ? 'tag-accepted' : 'tag-rejected'}">
            ${isAccepted ? 'ACCEPT' : 'REJECT'}
          </div>
        </div>

        <div class="cert-body">
          
          <!-- Metadata Table -->
          <div class="cert-section-box">
            <h4 class="cert-section-title">1. Consignment Intake Details</h4>
            <div class="cert-details-grid">
              <div><strong>Lot ID:</strong> ${lot.lot_id}</div>
              <div><strong>Date & Time:</strong> ${lot.registration_date}</div>
              <div><strong>Farmer / Supplier:</strong> ${lot.farmer_name}</div>
              <div><strong>Mobile Contact:</strong> ${lot.supplier_contact || 'N/A'}</div>
              <div><strong>Vehicle Reg No:</strong> <code>${lot.vehicle_number}</code></div>
              <div><strong>Consignment Quantity:</strong> ${lot.quantity_quintals} Quintals (${(lot.quantity_quintals / 10).toFixed(1)} MT)</div>
              <div><strong>Procurement Hub:</strong> ${lot.procurement_centre}</div>
              <div><strong>Inspector ID:</strong> ${lot.inspector_id}</div>
            </div>
          </div>

          <!-- AI Inspection Summary -->
          <div class="cert-section-box margin-top-md">
            <h4 class="cert-section-title">2. AI Vision Defect Classification & Quality Breakdown</h4>
            
            ${(ai.total_inspected === 0 || ai.grade_a_percentage === 'N/A') ? `
              <div class="alert alert-danger margin-bottom-md" style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px;">
                <strong style="color:#991b1b;">⚠️ No onions detected — inspection cannot be completed.</strong>
              </div>
            ` : ''}

            <div class="stats-grid margin-bottom-md">
              <div class="stat-card border-blue text-center">
                <div class="stat-title">Sample Inspected</div>
                <div class="stat-value font-xl">${ai.total_inspected || 0}</div>
              </div>

              <div class="stat-card border-emerald text-center">
                <div class="stat-title">Grade A Yield %</div>
                <div class="stat-value font-xl text-emerald">${ai.grade_a_percentage}${ai.grade_a_percentage !== 'N/A' ? '%' : ''}</div>
              </div>

              <div class="stat-card border-red text-center">
                <div class="stat-title">URS (Sub-Spec) %</div>
                <div class="stat-value font-xl text-red">${ai.urs_percentage}${ai.urs_percentage !== 'N/A' ? '%' : ''}</div>
              </div>

              <div class="stat-card border-amber text-center">
                <div class="stat-title">Model Confidence</div>
                <div class="stat-value font-xl text-amber">${ai.total_inspected ? `${((ai.confidence_score || 0.92)*100).toFixed(0)}%` : 'N/A'}</div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table font-sm">
                <thead>
                  <tr>
                    <th>Defect Category</th>
                    <th>Count</th>
                    <th>Percentage</th>
                    <th>FAQ Standard Specification</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="badge badge-good">Good Quality</span></td>
                    <td><strong>${ai.good || 0}</strong></td>
                    <td>${ai.total_inspected ? ((ai.good/ai.total_inspected)*100).toFixed(1) : 0}%</td>
                    <td><span class="text-emerald font-bold">Meets FAQ Grade A (&ge; 45mm)</span></td>
                  </tr>
                  <tr>
                    <td><span class="badge badge-damaged">Damaged / Cut</span></td>
                    <td><strong>${ai.damaged || 0}</strong></td>
                    <td>${ai.total_inspected ? ((ai.damaged/ai.total_inspected)*100).toFixed(1) : 0}%</td>
                    <td>Mechanical cuts & skin bruising</td>
                  </tr>
                  <tr>
                    <td><span class="badge badge-rotten">Rotten / Mold</span></td>
                    <td><strong class="text-red">${ai.rotten || 0}</strong></td>
                    <td>${ai.total_inspected ? ((ai.rotten/ai.total_inspected)*100).toFixed(1) : 0}%</td>
                    <td>Max APMC limit: 5.0%</td>
                  </tr>
                  <tr>
                    <td><span class="badge badge-sprouted">Sprouted</span></td>
                    <td><strong>${ai.sprouted || 0}</strong></td>
                    <td>${ai.total_inspected ? ((ai.sprouted/ai.total_inspected)*100).toFixed(1) : 0}%</td>
                    <td>Apical shoot growth</td>
                  </tr>
                  <tr>
                    <td><span class="badge badge-undersized">Undersized</span></td>
                    <td><strong>${ai.undersized || 0}</strong></td>
                    <td>${ai.total_inspected ? ((ai.undersized/ai.total_inspected)*100).toFixed(1) : 0}%</td>
                    <td>Bulb diameter &lt; 45mm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          ${ai.annotated_image ? `
            <div class="cert-section-box margin-top-md">
              <h4 class="cert-section-title">3. Calibrated Computer Vision Annotated Image Snapshot</h4>
              <div class="text-center padding-sm">
                <img src="${ai.annotated_image}" style="max-width:100%; max-height:300px; border-radius:6px; border:1px solid #cbd5e1;" alt="AI Sample Segmentation">
              </div>
            </div>
          ` : ''}

          <!-- Inspector Sign-off Details -->
          <div class="cert-section-box margin-top-md bg-slate-light">
            <h4 class="cert-section-title">4. Authorized Quality Officer Confirmation</h4>
            <div class="cert-sign-grid">
              <div>
                <p><strong>Official Determination:</strong> <span class="${isAccepted ? 'text-emerald' : 'text-red'} font-bold">${lot.status}</span></p>
                ${rev.rejection_reason ? `<p class="text-red"><strong>Rejection Cause:</strong> ${rev.rejection_reason}</p>` : ''}
                <p><strong>Quality Remarks:</strong> ${rev.inspector_notes || 'Verified according to APMC FAQ guidelines.'}</p>
                <div class="margin-top-sm font-xs text-muted">Sign-off Timestamp: ${rev.reviewed_at || lot.registration_date}</div>
              </div>
              <div class="cert-seal-box text-center">
                <div class="seal-circle">
                  OFFICIAL APMC<br>PROCUREMENT SEAL
                </div>
                <div class="margin-top-xs font-bold font-xs">${rev.inspector_signature || lot.inspector_id}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  document.getElementById('btn-back-hist').addEventListener('click', () => router.navigate('history'));
  document.getElementById('btn-edit-review').addEventListener('click', () => router.navigate('review', { lotId }));

  document.getElementById('btn-print-cert').addEventListener('click', () => {
    pdfService.printOrDownload(lot);
  });
}
