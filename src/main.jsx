import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { ThemeProvider } from './context/ThemeProvider';
import { WebSocketProvider } from './context/WebSocketProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
if (BACKEND_URL) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${BACKEND_URL}${url}`;
    }
    return originalFetch(url, options);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
