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
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse local storage lots:', e);
      return INITIAL_LOTS;
    }
  }

  getLotById(lotId) {
    const lots = this.getLots();
    return lots.find(l => l.lot_id === lotId) || null;
  }

  async saveLot(lot) {
    const lots = this.getLots();
    const existingIdx = lots.findIndex(l => l.lot_id === lot.lot_id);
    
    if (existingIdx >= 0) {
      lots[existingIdx] = { ...lots[existingIdx], ...lot };
    } else {
      lots.unshift(lot);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));

    // Async sync with Python FastAPI backend if available
    try {
      await fetch(`${BACKEND_URL}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lot)
      });
    } catch (e) {
      // System functions seamlessly even if backend endpoint is offline
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
