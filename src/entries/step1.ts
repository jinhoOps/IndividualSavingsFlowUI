import '../../shared/core/utils.js';
import '../core/storage/CompatibilityBridge';
import '../styles/globals.css';
import '../../shared/styles/step-theme.css';
import '../../apps/main/styles.css';

// Load legacy global scripts as side effects (excluding replaced storage)
import '../../shared/components/feedback-manager.js';
import '../../shared/pwa/pwa-manager.js';
import '../../shared/core/share-utils.js';

// Load Web Components
import '../../shared/components/app-header.js';
import '../../shared/components/data-hub-modal.js';

// Main app module
import '../../apps/main/app.js';
