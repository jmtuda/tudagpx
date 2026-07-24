import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { MapContainer, Polyline, useMap } from 'react-leaflet';
import { SelectorMapaBase } from './components/MapaBase';
import 'leaflet/dist/leaflet.css';

function AjustarZoom({ puntos }) {
  const map = useMap();
  useEffect(() => {
    if (puntos && puntos.length > 0) {
      map.fitBounds(puntos, { padding: [50, 50] });
    }
  }, [puntos, map]);
  return null;
}

export function DetallePagina() {
  const [ruta, setRuta] = useState(null);
  const [cargando, setCargando] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const rutaId = params.get('id');

  useEffect(() => {
    async function cargarRuta() {
      if (!rutaId) return;
      const { data, error } = await supabase.from('rutas').select('*').eq('id', rutaId).single();
      if (!error) setRuta(data);
      setCargando(false);
    }
    cargarRuta();
  }, [rutaId]);

  if (cargando) return <p style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Cargando ruta...</p>;
  if (!ruta) return <p style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Ruta no encontrada.</p>;

  // Extraer las altitudes de los puntos si están disponibles (formato [lat, lon, ele])
  const puntosConAltitud = ruta.puntos || [];
  const tieneAltitudes = puntosConAltitud.some(p => p[2] !== undefined && p[2] !== null);

  // Generar coordenadas SVG para el perfil de elevación
  let puntosSvg = '';
  let minAlt = 0;
  let maxAlt = 100;

  if (tieneAltitudes && puntosConAltitud.length > 0) {
    const altitudes = puntosConAltitud.map(p => p[2] || 0);
    minAlt = Math.min(...altitudes);
    maxAlt = Math.max(...altitudes);
    const rangoAlt = maxAlt - minAlt || 1;

    const anchoSvg = 800;
    const altoSvg = 150;

    puntosSvg = puntosConAltitud.map((p, index) => {
      const x = (index / (puntosConAltitud.length - 1)) * anchoSvg;
      const ele = p[2] || 0;
      // Invertir eje Y porque en SVG el 0 está arriba
      const y = altoSvg - ((ele - minAlt) / rangoAlt) * (altoSvg - 20) - 10;
      return `${x},${y}`;
    }).join(' ');
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* Cabecera con información */}
      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>{ruta.nombre}</h1>
        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', fontSize: '15px', color: '#444' }}>
          <span>📍 <strong>Salida:</strong> {ruta.localidad_salida}</span>
          <span>🚴‍♂️ <strong>Actividad:</strong> {ruta.actividad}</span>
          <span>📏 <strong>Distancia:</strong> {ruta.distancia_km} km</span>
          <span>⛰️ <strong>Desnivel:</strong> {ruta.desnivel_m} m</span>
          {ruta.del_club && <span style={{ background: '#d4edda', color: '#155724', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>Ruta del Club</span>}
        </div>
        <div style={{ marginTop: '15px' }}>
          <a href={ruta.archivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
            📥 Descargar archivo GPX original
          </a>
        </div>
      </div>

      {/* Contenedor Principal: Mapa y Perfil de Altimetría */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Mapa Interactivo con Selector de Capas */}
        <div style={{ height: '55vh', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', position: 'relative' }}>
          <MapContainer center={ruta.puntos?.[0] || [40.4168, -3.7038]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <SelectorMapaBase />
            {ruta.puntos && <Polyline positions={ruta.puntos} color="#0070f3" weight={5} />}
            <AjustarZoom puntos={ruta.puntos} />
          </MapContainer>
        </div>

        {/* Gráfica de Perfil de Altimetría */}
        {tieneAltitudes ? (
          <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#333' }}>📈 Perfil de Altimetría</h3>
            
            <div style={{ position: 'relative', width: '100%', height: '160px' }}>
              <svg viewBox="0 0 800 150" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {/* Fondo degradado bajo la línea */}
                <defs>
                  <linearGradient id="gradAlt" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0070f3" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Área bajo la curva */}
                <polygon points={`0,150 ${puntosSvg} 800,150`} fill="url(#gradAlt)" />

                {/* Línea de perfil */}
                <polyline fill="none" stroke="#0070f3" strokeWidth="2.5" points={puntosSvg} />
              </svg>

              {/* Etiquetas de altitud máxima y mínima */}
              <div style={{ position: 'absolute', top: '0', left: '0', fontSize: '11px', color: '#666', background: 'rgba(255,255,255,0.8)', padding: '2px 4px' }}>
                Máx: {Math.round(maxAlt)} m
              </div>
              <div style={{ position: 'absolute', bottom: '0', left: '0', fontSize: '11px', color: '#666', background: 'rgba(255,255,255,0.8)', padding: '2px 4px' }}>
                Mín: {Math.round(minAlt)} m
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', color: '#666', fontSize: '13px' }}>
            ℹ️ Este archivo GPX no contiene datos de altitud detallados por punto para generar la gráfica.
          </div>
        )}

      </div>
    </div>
  );
}