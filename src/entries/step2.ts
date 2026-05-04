import '../styles/globals.css';
import '../../shared/styles/step-theme.css';
import '../../apps/step2/styles.css';

import { initCompatibilityBridge } from '../core/storage/CompatibilityBridge';

// Initialize modern storage and legacy bridge
initCompatibilityBridge();

import '../../shared/core/utils.js';
import '../../shared/components/feedback-manager.js';
import '../../shared/pwa/pwa-manager.js';
import '../../shared/core/share-utils.js';

// Load Web Components
import '../../shared/components/app-header.js';
import '../../shared/components/data-hub-modal.js';

// Main app module
import '../../apps/step2/app.js';
