import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { themeManager } from './core/theme/ThemeManager';

// Apply system/device theme before mount
themeManager.applyTheme();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
