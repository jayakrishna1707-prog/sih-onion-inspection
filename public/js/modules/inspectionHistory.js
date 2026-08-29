/**
 * SIH26031 - Module 7: Searchable Inspection History
 */

import { storageService } from '../services/storageService.js';
import { pdfService } from '../services/pdfService.js';

export function renderInspectionHistory(container, router) {
  let allLots = storageService.getLots();
  let filteredLots = [...allLots];

  let currentSearch = '';
  let currentStatus = 'ALL';

  function renderTable() {
    filteredLots = allLots.filter(l => {
      const matchSearch = !currentSearch || (
        l.lot_id.toLowerCase().includes(currentSearch) ||
        l.farmer_name.toLowerCase().includes(currentSearch) ||
        l.vehicle_number.toLowerCase().includes(currentSearch) ||
        l.procurement_centre.toLowerCase().includes(currentSearch)
      );

      const matchStatus = currentStatus === 'ALL' || l.status === currentStatus;
      return matchSearch && matchStatus;
    });

    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    if (filteredLots.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center padding-xl color-gray">
            🔍 No matching inspection lot records found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredLots.map(lot => {
      const ai = lot.ai_results || {};
      const rev = lot.review || {};
      return `
        <tr>
          <td><strong>${lot.lot_id}</strong></td>
          <td>${lot.registration_date}</td>
          <td>
            <strong>${lot.farmer_name}</strong>
            <div class="font-xs text-muted">${lot.supplier_contact || ''}</div>
          </td>
          <td><code>${lot.vehicle_number}</code></td>
          <td>${lot.quantity_quintals} Qtl</td>
          <td>
            <strong>${ai.grade_a_percentage ? ai.grade_a_percentage + '%' : 'N/A'}</strong>
            <div class="font-xs text-muted">URS: ${ai.urs_percentage || 0}%</div>
          </td>
          <td>
            <span class="badge badge-${lot.status.toLowerCase()}">
              ${lot.status.replace('_', ' ')}
            </span>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-outline btn-sm btn-view-report" data-id="${lot.lot_id}" title="View Digital Quality Report">
                📄 Certificate
              </button>
              <button class="btn btn-secondary btn-sm btn-print-pdf" data-id="${lot.lot_id}" title="Print Official PDF">
                🖨️ Print
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Re-bind buttons
    tbody.querySelectorAll('.btn-view-report').forEach(btn => {
      btn.addEventListener('click', (e) => router.navigate('report', { lotId: e.currentTarget.dataset.id }));
    });

    tbody.querySelectorAll('.btn-print-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lot = storageService.getLotById(e.currentTarget.dataset.id);
        if (lot) pdfService.printOrDownload(lot);
      });
    });
  }

  container.innerHTML = `
    <div class="history-wrapper">
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Inspection History & Procurement Records</h1>
          <p class="page-subtitle">Central APMC Audit Trail • Searchable Lot Database</p>
        </div>
        <div class="action-buttons">
          <button class="btn btn-outline" id="btn-export-csv">📥 Export CSV</button>
          <button class="btn btn-primary" id="btn-hist-new">➕ Register Lot</button>
        </div>
      </div>

      <!-- Search & Filter Controls Card -->
      <div class="card margin-bottom-lg">
        <div class="card-body">
          <div class="filter-bar-grid">
            
            <!-- Search Input -->
            <div class="form-group">
              <label class="form-label">Search Query</label>
              <input type="text" id="search-input" class="form-control" placeholder="Search Lot ID, Farmer, Vehicle, Centre...">
            </div>

            <!-- Status Filter Pills -->
            <div class="form-group">
              <label class="form-label">Procurement Status Filter</label>
              <div class="status-filter-pills">
                <button class="pill-btn active" data-status="ALL">All Lots</button>
                <button class="pill-btn" data-status="ACCEPTED">Accepted</button>
                <button class="pill-btn" data-status="REJECTED">Rejected</button>
                <button class="pill-btn" data-status="PENDING_REVIEW">Pending Review</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- History Data Table Card -->
      <div class="card">
        <div class="card-body padding-none">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Lot ID</th>
                  <th>Date & Time</th>
                  <th>Farmer / Supplier</th>
                  <th>Vehicle No</th>
                  <th>Quantity</th>
                  <th>Quality Grade A</th>
                  <th>Decision Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="history-tbody">
                <!-- Dynamic rows -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  document.getElementById('btn-hist-new').addEventListener('click', () => router.navigate('register'));

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    renderTable();
  });

  const filterPills = container.querySelectorAll('.pill-btn');
  filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      filterPills.forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentStatus = e.currentTarget.dataset.status;
      renderTable();
    });
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (filteredLots.length === 0) {
      alert('No inspection records to export.');
      return;
    }

    const headers = ['Lot_ID', 'Registration_Date', 'Farmer_Name', 'Contact', 'Vehicle_No', 'Quantity_Qtl', 'Centre', 'Grade_A_Pct', 'URS_Pct', 'Status', 'Inspector_Notes'];
    const csvRows = [headers.join(',')];

    filteredLots.forEach(l => {
      const ai = l.ai_results || {};
      const rev = l.review || {};
      const row = [
        l.lot_id,
        `"${l.registration_date}"`,
        `"${l.farmer_name}"`,
        `"${l.supplier_contact || ''}"`,
        l.vehicle_number,
        l.quantity_quintals,
        `"${l.procurement_centre}"`,
        ai.grade_a_percentage || 0,
        ai.urs_percentage || 0,
        l.status,
        `"${(rev.inspector_notes || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Onion_Procurement_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  renderTable();
}
