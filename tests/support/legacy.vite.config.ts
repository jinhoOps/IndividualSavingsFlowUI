import {defineConfig, mergeConfig} from 'vite';
import productionConfig from '../../vite.config';

// Existing product interaction suites exercise the local repository compatibility
// boundary. The separate cloud project exercises the real authenticated entries.
// This plugin is loaded only by this test config, never by the production build.
const entries: Record<string, {app: string; component: string; styles: string[]}> = {
  '/src/main/main.tsx': {app: '../main/ui/MainApp', component: 'MainApp', styles: ['../main/ui/main.css']},
  '/src/simulation/main.tsx': {app: '../simulation/ui/SimulationApp', component: 'SimulationApp', styles: ['../simulation/ui/simulation.css', '../journey/ui/journey.css']},
  '/src/portfolio/main.tsx': {app: '../portfolio/ui/PortfolioApp', component: 'PortfolioApp', styles: ['../portfolio/ui/portfolio.css']},
  '/src/journey/accountMap.tsx': {app: '../account-map/ui/AccountMapApp', component: 'AccountMapApp', styles: ['../journey/ui/journey.css']},
};
export default mergeConfig(productionConfig, defineConfig({plugins: [{
  name: 'local-repository-compatibility-fixture', enforce: 'pre',
  transform(_code, id) {
    const entry = Object.entries(entries).find(([suffix]) => id.endsWith(suffix))?.[1];
    if (!entry) return;
    return `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {registerSW} from 'virtual:pwa-register';
      import {MainErrorBoundary} from '../main/ui/common/AppErrorBoundary';
      import {${entry.component}} from '${entry.app}';
      import '../styles/app-foundation.css';
      ${entry.styles.map(style => `import '${style}';`).join('\n')}
      createRoot(document.getElementById('root')).render(<React.StrictMode><MainErrorBoundary><${entry.component} /></MainErrorBoundary></React.StrictMode>);
      registerSW({immediate:true});`;
  },
}]}));
