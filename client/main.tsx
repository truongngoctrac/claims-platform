import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';

// Ensure we have a root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// Create and render the React app
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hot Module Replacement (HMR) - if supported
if (import.meta.hot) {
  import.meta.hot.accept();
}
