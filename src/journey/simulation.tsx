import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainErrorBoundary } from '../main/ui/common/AppErrorBoundary';
import { ReadinessApp } from './ui/ReadinessApp';
import './ui/journey.css';

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Simulation React root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <ReadinessApp destination="simulation" />
    </MainErrorBoundary>
  </StrictMode>,
);

registerSW({ immediate: true });
