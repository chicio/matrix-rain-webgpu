import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// oxlint-disable-next-line import/no-unassigned-import -- imported for side effects
import './demo/demo.css';
import App from './demo/App.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
