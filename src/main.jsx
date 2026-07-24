import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { DetallePagina } from './DetallePagina.jsx';
import './index.css';

// Comprobamos si la URL actual tiene un parámetro ?id=...
const params = new URLSearchParams(window.location.search);
const esDetalle = params.has('id');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {esDetalle ? <DetallePagina /> : <App />}
  </React.StrictMode>
);