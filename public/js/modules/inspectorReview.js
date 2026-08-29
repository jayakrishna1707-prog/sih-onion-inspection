/**
 * SIH26031 - Module 6: Inspector Review & Human Decision Sign-off
 * MANDATORY: No automatic procurement decision without human confirmation!
 */

import { storageService } from '../services/storageService.js';

export function renderInspectorReview(container, router, params = {}) {
  const lotId = params.lotId;
  const lot = storageService.getLotById(lotId);

  if (!lot || !lot.ai_results) {
    alert('Inspection lot data missing.');
    router.navigate('dashboard');
    return;
  }

  const ai = lot.ai_results;
  const existingRev = lot.review || {};

  let currentDecision = existingRev.decision || (ai.grade_a_percentage >= 75.0 && ai.rotten <= 2 ? 'ACCEPT' : 'REJECT');

  container.innerHTML = `
    <div class="review-wrapper">
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Mandatory Inspector Review & Procurement Decision</h1>
          <p class="page-subtitle">Lot ID: <strong>${lot.lot_id}</strong> • Official Sign-off Portal</p>
        </div>
        <button class="btn btn-secondary" id="btn-back-ai">⬅ Back to AI Results</button>
      </div>

      <div class="alert alert-warning margin-bottom-lg">
        <span class="alert-icon">🛡️</span>
        <div>
          <strong>Human Inspector Confirmation Required</strong>
          <p>System policy strictly prohibits automated procurement. You must verify AI results, perform count overrides if necessary, and make the final Accept/Reject determination.</p>
        </div>
      </div>

      <div class="review-grid">
        
        <!-- Left: AI Data vs Override Controls -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">AI Summary vs Inspector Adjustment</h3>
          </div>
          <div class="card-body">
            
            <div class="override-grid">
              
              <div class="override-row">
                <div class="override-label">Grade A Yield (%)</div>
                <div class="override-ai-val">${ai.grade_a_percentage}%</div>
                <div class="override-input-wrap">
                  <input type="number" id="input-grade-a" class="form-control" value="${existingRev.grade_a_override || ai.grade_a_percentage}" min="0" max="100" step="0.1">
                </div>
              </div>

              <div class="override-row">
                <div class="override-label">URS (Sub-Standard) %</div>
                <div class="override-ai-val">${ai.urs_percentage}%</div>
                <div class="override-input-wrap">
                  <input type="number" id="input-urs" class="form-control" value="${existingRev.urs_override || ai.urs_percentage}" min="0" max="100" step="0.1">
                </div>
              </div>

              <div class="override-row">
                <div class="override-label">Rotten Count (Bulbs)</div>
                <div class="override-ai-val text-red"><strong>${ai.rotten}</strong></div>
                <div class="override-input-wrap">
                  <input type="number" id="input-rotten-count" class="form-control" value="${ai.rotten}" min="0">
                </div>
              </div>

            </div>

            <!-- Inspector Notes -->
            <div class="form-group margin-top-lg">
              <label class="form-label required">Inspector Remarks / Quality Justification</label>
              <textarea id="inspector-notes" class="form-control" rows="4" placeholder="Enter quality remarks (e.g. FAQ standard met, moisture content within threshold, approved for APMC procurement...)" required>${existingRev.inspector_notes || ''}</textarea>
            </div>

            <!-- Rejection Reason Dropdown (Hidden unless REJECT) -->
            <div class="form-group margin-top-md" id="rejection-reason-group" style="${currentDecision === 'REJECT' ? '' : 'display:none;'}">
              <label class="form-label required text-red">Mandatory Rejection Category</label>
              <select id="rejection-reason" class="form-control border-red">
                <option value="High Rotten/Black Mold Ratio (>5% APMC Limit)">High Rotten/Black Mold Ratio (&gt;5% APMC Limit)</option>
                <option value="Excessive Sprouting Shoot Count">Excessive Sprouting Shoot Count</option>
                <option value="Grade A Yield Below Minimum FAQ Threshold (<75%)">Grade A Yield Below Minimum FAQ Threshold (&lt;75%)</option>
                <option value="Severe Mechanical Bruising & Cut Damage">Severe Mechanical Bruising & Cut Damage</option>
                <option value="High Moisture & Soft Bulb Deterioration">High Moisture & Soft Bulb Deterioration</option>
              </select>
            </div>

          </div>
        </div>

        <!-- Right: Official Accept / Reject Decision Lock -->
        <div class="card">
          <div class="card-header bg-emerald-dark text-white">
            <h3 class="card-title text-white">✍️ Final Procurement Determination</h3>
          </div>
          <div class="card-body">
            
            <div class="decision-toggle-box">
              <button class="decision-btn decision-accept ${currentDecision === 'ACCEPT' ? 'active' : ''}" id="btn-decide-accept">
                <span class="decision-icon">✅</span>
                <span class="decision-text">ACCEPT LOT</span>
                <span class="decision-sub">Procure Consignment</span>
              </button>

              <button class="decision-btn decision-reject ${currentDecision === 'REJECT' ? 'active' : ''}" id="btn-decide-reject">
                <span class="decision-icon">❌</span>
                <span class="decision-text">REJECT LOT</span>
                <span class="decision-sub">Return Consignment</span>
              </button>
            </div>

            <div class="form-group margin-top-lg">
              <label class="form-label required">Inspector Officer Signature Seal</label>
              <input type="text" id="inspector-signature" class="form-control font-bold" value="${existingRev.inspector_signature || 'INS-9042 (S. K. Verma - Digital Seal #9042)'}" required>
            </div>

            <div class="margin-top-xl text-center">
              <button class="btn btn-emerald btn-xl full-width" id="btn-submit-decision">
                🔒 Lock Decision & Generate Quality Certificate
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  `;

  // Attach Event Handlers
  document.getElementById('btn-back-ai').addEventListener('click', () => router.navigate('ai-analysis', { lotId }));

  const btnAccept = document.getElementById('btn-decide-accept');
  const btnReject = document.getElementById('btn-decide-reject');
  const rejGroup = document.getElementById('rejection-reason-group');

  btnAccept.addEventListener('click', () => {
    currentDecision = 'ACCEPT';
    btnAccept.classList.add('active');
    btnReject.classList.remove('active');
    rejGroup.style.display = 'none';
  });

  btnReject.addEventListener('click', () => {
    currentDecision = 'REJECT';
    btnReject.classList.add('active');
    btnAccept.classList.remove('active');
    rejGroup.style.display = 'block';
  });

  document.getElementById('btn-submit-decision').addEventListener('click', async () => {
    if (ai.total_inspected === 0 || ai.grade_a_percentage === 'N/A') {
      alert('No onions detected — inspection cannot be completed. Please recapture or upload a valid onion sample image.');
      return;
    }

    const notes = document.getElementById('inspector-notes').value.trim();
    const signature = document.getElementById('inspector-signature').value.trim();
    const rejReason = document.getElementById('rejection-reason').value;

    if (!notes) {
      alert('Please enter inspector quality remarks before confirming sign-off.');
      return;
    }

    const reviewData = {
      decision: currentDecision,
      rejection_reason: currentDecision === 'REJECT' ? rejReason : '',
      grade_a_override: parseFloat(document.getElementById('input-grade-a').value) || ai.grade_a_percentage,
      urs_override: parseFloat(document.getElementById('input-urs').value) || ai.urs_percentage,
      inspector_notes: notes,
      inspector_signature: signature,
      reviewed_at: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    };

    lot.status = currentDecision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    lot.review = reviewData;

    await storageService.saveLot(lot);

    alert(`Lot ${lot.lot_id} successfully ${lot.status}! Opening Digital Quality Certificate.`);
    router.navigate('report', { lotId: lot.lot_id });
  });
}
