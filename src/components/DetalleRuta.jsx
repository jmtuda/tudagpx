import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
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

export function DetalleRuta({ rutaId, onVolver }) {
  const [ruta, setRuta] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarRutaDetalle() {
      const { data, error } = await supabase
        .from('rutas')
        .select('*')
        .eq('id', rutaId)
        .single();

      if (error) {
        console.error('Error al cargar la ruta:', error);
      } else {
        setRuta(data);
      }
      setCargando(false);
    }

    if (rutaId) {
      cargarRutaDetalle();
    }
  }, [rutaId]);

  if (cargando) return <p style={{ padding: '20px' }}>Cargando datos de la ruta...</p>;
  if (!ruta) return <p style={{ padding: '20px' }}>No se ha encontrado la ruta.</p>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <button
        onClick={onVolver}
        style={{
          padding: '8px 16px',
          background: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}
      >
        ← Volver al listado
      </button>

      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>{ruta.nombre}</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '15px', color: '#444' }}>
          <span>📍 <strong>Salida:</strong> {ruta.localidad_salida}</span>
          <span>🚴‍♂️ <strong>Actividad:</strong> {ruta.actividad}</span>
          <span>📏 <strong>Distancia:</strong> {ruta.distancia_km} km</span>
          <span>⛰️ <strong>Desnivel:</strong> {ruta.desnivel_m} m</span>
          {ruta.del_club && <span style={{ background: '#d4edda', color: '#155724', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>Ruta del Club</span>}
        </div>
        <div style={{ marginTop: '15px' }}>
          <a
            href={ruta.archivo_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}
          >
            📥 Descargar archivo GPX original
          </a>
        </div>
      </div>

      {/* Mapa Grande a pantalla completa */}
      <div style={{ height: '550px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
        <MapContainer center={ruta.puntos?.[0] || [40.4168, -3.7038]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {ruta.puntos && <Polyline positions={ruta.puntos} color="#0070f3" weight={5} />}
          <AjustarZoom puntos={ruta.puntos} />
        </MapContainer>
      </div>
    </div>
  );
}