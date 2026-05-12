import React from 'react';
import { createRoot } from 'react-dom/client';
import { BacktestDashboard } from '../components/backtest/BacktestDashboard';
import '../styles/globals.css';

// Web Components는 HTML에서 직접 로드되거나 여기서 임포트하여 등록 확인 가능
import '../../shared/components/app-header.js';
import '../../shared/components/data-hub-modal.js';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BacktestDashboard />
    </React.StrictMode>
  );
}
