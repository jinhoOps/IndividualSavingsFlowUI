import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SharedResultPage } from './SharedResultPage';
import '../../styles/app-foundation.css';
import './share.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Shared result root was not found.');
createRoot(root).render(<StrictMode><SharedResultPage /></StrictMode>);
