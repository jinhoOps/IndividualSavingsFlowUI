import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainErrorBoundary } from '../main/ui/common/AppErrorBoundary';
import { SimulationApp } from './ui/SimulationApp';
import '../styles/app-foundation.css';
import '../journey/ui/journey.css';
import './ui/simulation.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Simulation React root was not found.');

createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <SimulationApp />
    </MainErrorBoundary>
  </StrictMode>,
);

registerSW({ immediate: true });
