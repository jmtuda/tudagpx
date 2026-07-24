import { useEffect } from 'react';
import { MapContainer, Polyline, useMap } from 'react-leaflet';
import { SelectorMapaBase } from './MapaBase';
import 'leaflet/dist/leaflet.css';

function AjustarZoomMapa({ puntos }) {
  const map = useMap();
  useEffect(() => {
    if (puntos && puntos.length > 0) {
      map.fitBounds(puntos, { padding: [30, 30] });
    }
  }, [puntos, map]);
  return null;
}

export function MapaPrevisualizacion({ puntos }) {
  if (!puntos || puntos.length === 0) return null;
  const centroInicial = puntos[0];

  return (
    <div style={{ height: '350px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', position: 'relative' }}>
      <MapContainer center={centroInicial} zoom={13} style={{ height: '100%', width: '100%' }}>
        <SelectorMapaBase />
        <Polyline positions={puntos} color="blue" weight={4} />
        <AjustarZoomMapa puntos={puntos} />
      </MapContainer>
    </div>
  );
}