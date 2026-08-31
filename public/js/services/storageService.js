/**
 * SIH26031 - Unified Storage Service
 * Manages LocalStorage persistence & synchronization with Backend REST API.
 */

import { INITIAL_LOTS } from '../data/mockData.js';

const STORAGE_KEY = 'sih26031_onion_procurement_lots_v1';
const BACKEND_URL = 'http://localhost:8000/api/v1';

class StorageService {
  constructor() {
    this.initStorage();
  }

  initStorage() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LOTS));
    }
  }

  getLots() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return INITIAL_LOTS;
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return INITIAL_LOTS;
      return parsed;
    } catch (e) {
      console.error('[StorageService] Corrupted localStorage reset:', e);
      localStorage.removeItem(STORAGE_KEY);
      return INITIAL_LOTS;
    }
  }

  getLotById(lotId) {
    const lots = this.getLots();
    let lot = lots.find(l => l.lot_id === lotId) || null;
    if (!lot && this.currentLot && this.currentLot.lot_id === lotId) {
      lot = this.currentLot;
    }
    return lot;
  }

  async saveLot(lot) {
    this.currentLot = lot;
    const lots = this.getLots();
    const existingIdx = lots.findIndex(l => l.lot_id === lot.lot_id);
    
    if (existingIdx >= 0) {
      lots[existingIdx] = { ...lots[existingIdx], ...lot };
    } else {
      lots.unshift(lot);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
    } catch (quotaErr) {
      console.warn('[StorageService] LocalStorage quota exceeded. Pruning historical image payloads:', quotaErr);
      // Prune base64 annotated_image from older lots
      lots.forEach((l, idx) => {
        if (idx > 0 && l.ai_results && l.ai_results.annotated_image) {
          l.ai_results = { ...l.ai_results, annotated_image: null };
        }
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
      } catch (e2) {
        console.error('[StorageService] LocalStorage write failed after pruning:', e2);
      }
    }

    // Async sync with Python FastAPI backend if available
    try {
      await fetch(`${BACKEND_URL}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lot)
      });
    } catch (e) {
      console.log('Backend REST endpoint offline, saved locally to state.');
    }

    return lot;
  }

  deleteLot(lotId) {
    let lots = this.getLots();
    lots = lots.filter(l => l.lot_id !== lotId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
  }

  resetToMockData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LOTS));
    return INITIAL_LOTS;
  }
}

export const storageService = new StorageService();
