/*
 * File: main.tsx
 *
 * Contains:
 * - Entry point for the UI React application.
 * - Imports the root component (App) and global styles.
 * - Mounts the React tree onto the DOM node #root.
 *
 * Role in the flow (startup -> graph execution):
 * - First script executed when the page loads.
 * - Initializes the React runtime and hands control to App.tsx, where the
 *   visual editor orchestration, graph state and run actions begin.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

// Create the React root and render App under StrictMode for development checks.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
