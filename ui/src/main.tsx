/*
 * Archivo: main.tsx
 *
 * Que contiene:
 * - Punto de entrada de la aplicacion React de la UI.
 * - Importacion del componente raiz (App) y estilos globales.
 * - Montaje del arbol React sobre el nodo DOM #root.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Es el primer archivo ejecutado cuando el usuario abre la pagina.
 * - Inicializa el runtime de React y entrega control a App.tsx, donde comienza
 *   la orquestacion del editor visual, el estado del grafo y las acciones de run.
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
