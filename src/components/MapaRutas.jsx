import { useEffect } from 'react';
import { MapContainer, Polyline, useMap } from 'react-leaflet';
import { SelectorMapaBase } from './MapaBase';
import 'leaflet/dist/leaflet.css';

const COLORES_RUTAS = ['#0070f3', '#e63946', '#2a9d8f', '#f4a261', '#9b5de5', '#f15bb5', '#00bbf9'];

function AjustarZoomMultiple({ rutas }) {
  const map = useMap();
  useEffect(() => {
    if (!rutas || rutas.length === 0) return;
    const todosLosPuntos = rutas.flatMap(r => r.puntos || []);
    if (todosLosPuntos.length > 0) {
      map.fitBounds(todosLosPuntos, { padding: [40, 40] });
    }
  }, [rutas, map]);
  return null;
}

export function MapaRutas({ rutasSeleccionadas }) {
  if (!rutasSeleccionadas || rutasSeleccionadas.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'var(--card-bg, #f8fafc)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', textAlign: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>Selecciona una o más rutas en la lista de la izquierda para visualizarlas juntas en el mapa.</p>
      </div>
    );
  }

  const centroInicial = rutasSeleccionadas[0]?.puntos?.[0] || [40.4168, -3.7038];

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' }}>
      <MapContainer center={centroInicial} zoom={13} style={{ height: '100%', width: '100%' }}>
        <SelectorMapaBase />

        {rutasSeleccionadas.map((ruta, index) => {
          if (!ruta.puntos || ruta.puntos.length === 0) return null;
          const colorAsignado = COLORES_RUTAS[index % COLORES_RUTAS.length];
          return (
            <Polyline key={ruta.id} positions={ruta.puntos} color={colorAsignado} weight={5} opacity={0.8} />
          );
        })}

        <AjustarZoomMultiple rutas={rutasSeleccionadas} />
      </MapContainer>
    </div>
  );
}