/**
 * SIH26031 - Master Application Controller & SPA Router
 */

import { renderDashboard } from './modules/dashboard.js';
import { renderLotRegistration } from './modules/lotRegistration.js';
import { renderSampleInspection } from './modules/sampleInspection.js';
import { renderAIAnalysis } from './modules/aiAnalysis.js';
import { renderInspectorReview } from './modules/inspectorReview.js';
import { renderInspectionHistory } from './modules/inspectionHistory.js';
import { renderQualityReport } from './modules/qualityReport.js';

class AppRouter {
  constructor() {
    this.container = document.getElementById('main-content');
    this.currentView = 'dashboard';
    this.params = {};
    
    this.initNavigation();
    this.navigate('dashboard');
  }

  initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = e.currentTarget.dataset.view;
        if (targetView) {
          this.navigate(targetView);
        }
      });
    });
  }

  updateNavState(viewName) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  navigate(viewName, params = {}) {
    this.currentView = viewName;
    this.params = params;
    this.updateNavState(viewName);

    // Scroll to top
    window.scrollTo(0, 0);

    switch (viewName) {
      case 'dashboard':
        renderDashboard(this.container, this);
        break;
      case 'register':
        renderLotRegistration(this.container, this);
        break;
      case 'sample':
        renderSampleInspection(this.container, this, params);
        break;
      case 'ai-analysis':
        renderAIAnalysis(this.container, this, params);
        break;
      case 'review':
        renderInspectorReview(this.container, this, params);
        break;
      case 'history':
        renderInspectionHistory(this.container, this);
        break;
      case 'report':
        renderQualityReport(this.container, this, params);
        break;
      default:
        renderDashboard(this.container, this);
    }
  }
}

// Global App Bootstrapper
function bootstrapApp() {
  if (!window.appRouter) {
    window.appRouter = new AppRouter();
    console.log('[SIH26031] Operational Application Loaded.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
