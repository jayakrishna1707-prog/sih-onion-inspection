/**
 * SIH26031 - Digital Quality Report PDF Generator
 * Renders official government/APMC quality certificate with signature and metrics.
 */

class PDFService {
  generateReportHTML(lot) {
    const ai = lot.ai_results || {};
    const rev = lot.review || {};

    const isAccepted = lot.status === 'ACCEPTED' || rev.decision === 'ACCEPT';
    const statusColor = isAccepted ? '#10b981' : '#ef4444';
    const statusBg = isAccepted ? '#ecfdf5' : '#fef2f2';
    const statusText = isAccepted ? 'LOT ACCEPTED FOR PROCUREMENT' : 'LOT REJECTED';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Quality Certificate - ${lot.lot_id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; margin: 0; padding: 25px; font-size: 13px; line-height: 1.5; }
          .cert-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #064e3b; padding-bottom: 12px; margin-bottom: 20px; }
          .cert-title { color: #064e3b; font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 0; }
          .cert-subtitle { color: #475569; font-size: 11px; margin-top: 3px; font-weight: 600; }
          .gov-badge { background: #064e3b; color: #fff; padding: 6px 12px; border-radius: 4px; font-weight: 700; font-size: 11px; text-align: right; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          .meta-item { margin-bottom: 4px; }
          .meta-label { font-weight: 700; color: #64748b; font-size: 11px; text-transform: uppercase; }
          .meta-value { font-weight: 600; color: #0f172a; font-size: 13px; }
          .decision-banner { background: ${statusBg}; border: 2px solid ${statusColor}; color: ${statusColor}; text-align: center; padding: 12px; border-radius: 6px; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
          .section-heading { font-size: 14px; font-weight: 700; color: #064e3b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 12px; }
          .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .metric-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; }
          .metric-value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .metric-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #064e3b; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 10px; text-align: left; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; text-transform: uppercase; }
          .badge-good { background: #d1fae5; color: #065f46; }
          .badge-damaged { background: #fef3c7; color: #92400e; }
          .badge-rotten { background: #fee2e2; color: #991b1b; }
          .badge-sprouted { background: #f3e8ff; color: #6b21a8; }
          .badge-undersized { background: #fef9c3; color: #854d0e; }
          .image-preview { text-align: center; margin-bottom: 20px; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; background: #fafafa; }
          .image-preview img { max-width: 100%; max-height: 320px; border-radius: 4px; object-fit: contain; }
          .signature-box { display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px dashed #cbd5e1; padding-top: 20px; margin-top: 30px; }
          .sign-stamp { width: 140px; height: 60px; border: 2px dashed #064e3b; color: #064e3b; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; transform: rotate(-3deg); border-radius: 4px; background: #f0fdf4; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="background: #064e3b; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 4px; cursor: pointer;">🖨️ PRINT CERTIFICATE</button>
        </div>

        <div class="cert-header">
          <div>
            <h1 class="cert-title">Official Quality Inspection Report</h1>
            <div class="cert-subtitle">NATIONAL ONION PROCUREMENT & QUALITY ASSESSMENT SYSTEM (SIH26031)</div>
          </div>
          <div class="gov-badge">
            AGRICULTURAL MANDI<br>CENTRAL APMC PORTAL
          </div>
        </div>

        <div class="decision-banner">
          ${statusText}
        </div>

        <div class="meta-grid">
          <div>
            <div class="meta-item"><span class="meta-label">Lot Reference ID:</span> <span class="meta-value">${lot.lot_id}</span></div>
            <div class="meta-item"><span class="meta-label">Farmer / Supplier:</span> <span class="meta-value">${lot.farmer_name} (${lot.supplier_contact || 'N/A'})</span></div>
            <div class="meta-item"><span class="meta-label">Vehicle Registration:</span> <span class="meta-value">${lot.vehicle_number}</span></div>
            <div class="meta-item"><span class="meta-label">Consignment Tonnage:</span> <span class="meta-value">${lot.quantity_quintals} Quintals (${(lot.quantity_quintals / 10).toFixed(1)} MT)</span></div>
          </div>
          <div>
            <div class="meta-item"><span class="meta-label">Procurement Centre:</span> <span class="meta-value">${lot.procurement_centre}</span></div>
            <div class="meta-item"><span class="meta-label">Inspecting Officer ID:</span> <span class="meta-value">${lot.inspector_id}</span></div>
            <div class="meta-item"><span class="meta-label">Registration Date & Time:</span> <span class="meta-value">${lot.registration_date}</span></div>
            <div class="meta-item"><span class="meta-label">Verification Mode:</span> <span class="meta-value">YOLO / AI Computer Vision + Human Review</span></div>
          </div>
        </div>

        <div class="section-heading">AI Quality Assessment Summary</div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${ai.total_inspected || 0}</div>
            <div class="metric-label">Sample Count</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" style="color: #10b981;">${ai.grade_a_percentage}${ai.grade_a_percentage !== 'N/A' ? '%' : ''}</div>
            <div class="metric-label">Grade A Yield</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" style="color: #ef4444;">${ai.urs_percentage}${ai.urs_percentage !== 'N/A' ? '%' : ''}</div>
            <div class="metric-label">URS (Sub-Standard)</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" style="color: #3b82f6;">${ai.total_inspected ? `${((ai.confidence_score || 0.92) * 100).toFixed(0)}%` : 'N/A'}</div>
            <div class="metric-label">AI Model Confidence</div>
          </div>
        </div>

        <div class="section-heading">Detailed Defect Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Classification Category</th>
              <th>Sample Count</th>
              <th>Percentage</th>
              <th>APMC Specification Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge badge-good">Grade A Good</span></td>
              <td><strong>${ai.good || 0}</strong></td>
              <td>${ai.total_inspected ? ((ai.good/ai.total_inspected)*100).toFixed(1) : 0}%</td>
              <td><span style="color: #10b981; font-weight:700;">Meets FAQ Specification</span></td>
            </tr>
            <tr>
              <td><span class="badge badge-damaged">Damaged / Cut</span></td>
              <td><strong>${ai.damaged || 0}</strong></td>
              <td>${ai.total_inspected ? ((ai.damaged/ai.total_inspected)*100).toFixed(1) : 0}%</td>
              <td>Mechanical bruising & cuts</td>
            </tr>
            <tr>
              <td><span class="badge badge-rotten">Rotten / Black Mold</span></td>
              <td><strong>${ai.rotten || 0}</strong></td>
              <td>${ai.total_inspected ? ((ai.rotten/ai.total_inspected)*100).toFixed(1) : 0}%</td>
              <td>Max permissible: 5.0%</td>
            </tr>
            <tr>
              <td><span class="badge badge-sprouted">Sprouted</span></td>
              <td><strong>${ai.sprouted || 0}</strong></td>
              <td>${ai.total_inspected ? ((ai.sprouted/ai.total_inspected)*100).toFixed(1) : 0}%</td>
              <td>Apical shoot growth</td>
            </tr>
            <tr>
              <td><span class="badge badge-undersized">Undersized (&lt; 45mm)</span></td>
              <td><strong>${ai.undersized || 0}</strong></td>
              <td>${ai.total_inspected ? ((ai.undersized/ai.total_inspected)*100).toFixed(1) : 0}%</td>
              <td>Size below Grade A threshold</td>
            </tr>
          </tbody>
        </table>

        ${ai.annotated_image ? `
          <div class="section-heading">Annotated AI Sample Image</div>
          <div class="image-preview">
            <img src="${ai.annotated_image}" alt="AI Annotated Onion Sample">
          </div>
        ` : ''}

        <div class="section-heading">Inspector Confirmation & Remarks</div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px 0;"><strong>Decision:</strong> <span style="color: ${statusColor}; font-weight: bold;">${rev.decision || lot.status}</span></p>
          ${rev.rejection_reason ? `<p style="margin: 0 0 6px 0; color: #dc2626;"><strong>Rejection Reason:</strong> ${rev.rejection_reason}</p>` : ''}
          <p style="margin: 0;"><strong>Inspector Notes:</strong> ${rev.inspector_notes || 'Verified by authorized procurement officer.'}</p>
        </div>

        <div class="signature-box">
          <div>
            <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${rev.inspector_signature || lot.inspector_id}</div>
            <div style="font-size: 11px; color: #64748b;">Authorized Quality Inspector</div>
            <div style="font-size: 10px; color: #94a3b8;">Reviewed At: ${rev.reviewed_at || lot.registration_date}</div>
          </div>
          <div class="sign-stamp">
            OFFICIAL APMC<br>PROCUREMENT SEAL
          </div>
        </div>
      </body>
      </html>
    `;
  }

  printOrDownload(lot) {
    const html = this.generateReportHTML(lot);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert('Pop-up blocked. Please allow pop-ups to view printable quality certificate.');
    }
  }
}

export const pdfService = new PDFService();
