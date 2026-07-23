import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { ThemeProvider } from './context/ThemeProvider';
import { WebSocketProvider } from './context/WebSocketProvider';

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
