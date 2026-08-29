/**
 * SIH26031 - Module 2: New Lot Registration Form
 */

import { storageService } from '../services/storageService.js';

export function renderLotRegistration(container, router) {
  const autoLotId = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  container.innerHTML = `
    <div class="registration-wrapper">
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">New Lot Intake Registration</h1>
          <p class="page-subtitle">Register incoming onion consignment at procurement gate before sampling</p>
        </div>
        <button class="btn btn-secondary" id="btn-back-dash">⬅ Back to Dashboard</button>
      </div>

      <div class="card max-w-4xl margin-center">
        <div class="card-header bg-emerald-dark text-white">
          <h3 class="card-title text-white">📋 Mandatory Lot Registration Details</h3>
        </div>
        <div class="card-body">
          <form id="lot-registration-form">
            <div class="form-grid">
              
              <!-- Lot ID -->
              <div class="form-group">
                <label class="form-label required">Lot Reference ID</label>
                <input type="text" id="reg-lot-id" class="form-control font-mono font-bold" value="${autoLotId}" required readonly>
                <span class="form-help">Auto-generated unique APMC consignment tracking number</span>
              </div>

              <!-- Date & Time -->
              <div class="form-group">
                <label class="form-label required">Date & Time</label>
                <input type="text" id="reg-datetime" class="form-control" value="${nowIso}" required readonly>
              </div>

              <!-- Farmer/Supplier Name -->
              <div class="form-group">
                <label class="form-label required">Farmer / Supplier Name</label>
                <input type="text" id="reg-farmer-name" class="form-control" placeholder="e.g. Balasaheb Kadam" required>
              </div>

              <!-- Supplier Contact -->
              <div class="form-group">
                <label class="form-label required">Supplier Mobile Contact</label>
                <input type="tel" id="reg-contact" class="form-control" placeholder="+91 98765 43210" required>
              </div>

              <!-- Vehicle Number -->
              <div class="form-group">
                <label class="form-label required">Transport Vehicle Number</label>
                <input type="text" id="reg-vehicle" class="form-control uppercase" placeholder="e.g. MH-15-AB-1234" required>
              </div>

              <!-- Quantity in Quintals -->
              <div class="form-group">
                <label class="form-label required">Consignment Quantity (Quintals)</label>
                <input type="number" id="reg-quantity" class="form-control" placeholder="e.g. 150" min="1" step="1" required>
                <span class="form-help">1 MT = 10 Quintals</span>
              </div>

              <!-- Procurement Centre Location -->
              <div class="form-group">
                <label class="form-label required">Procurement Centre Hub</label>
                <select id="reg-centre" class="form-control" required>
                  <option value="Lasalgaon Central Mandi (Hub 4)">Lasalgaon Central Mandi (Hub 4)</option>
                  <option value="Pimpalgaon Baswant Hub">Pimpalgaon Baswant Hub</option>
                  <option value="Nashik APMC Main Gate">Nashik APMC Main Gate</option>
                  <option value="Rahuri Sub-Centre">Rahuri Sub-Centre</option>
                  <option value="Yeola Regional Mandi">Yeola Regional Mandi</option>
                </select>
              </div>

              <!-- Inspector ID -->
              <div class="form-group">
                <label class="form-label required">Inspector Officer ID</label>
                <input type="text" id="reg-inspector" class="form-control" value="INS-9042 (S. K. Verma)" required>
              </div>

            </div>

            <div class="form-actions border-top margin-top-lg padding-top-md">
              <button type="button" class="btn btn-secondary btn-lg" id="btn-cancel-reg">Cancel</button>
              <button type="submit" class="btn btn-primary btn-lg">
                Proceed to Sample Capture 📷 ➡
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  document.getElementById('btn-back-dash').addEventListener('click', () => router.navigate('dashboard'));
  document.getElementById('btn-cancel-reg').addEventListener('click', () => router.navigate('dashboard'));

  const form = document.getElementById('lot-registration-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newLot = {
      lot_id: document.getElementById('reg-lot-id').value,
      registration_date: document.getElementById('reg-datetime').value,
      farmer_name: document.getElementById('reg-farmer-name').value,
      supplier_contact: document.getElementById('reg-contact').value,
      vehicle_number: document.getElementById('reg-vehicle').value.toUpperCase(),
      quantity_quintals: Number(document.getElementById('reg-quantity').value),
      procurement_centre: document.getElementById('reg-centre').value,
      inspector_id: document.getElementById('reg-inspector').value,
      status: 'PENDING_REVIEW',
      ai_results: null,
      review: null
    };

    await storageService.saveLot(newLot);
    router.navigate('sample', { lotId: newLot.lot_id });
  });
}
