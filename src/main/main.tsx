import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainApp } from './ui/MainApp';
import './ui/main.css';

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Main React root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <MainApp />
  </StrictMode>,
);

registerSW({ immediate: true });
