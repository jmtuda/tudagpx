import { useState } from 'react';
import { TileLayer } from 'react-leaflet';

export function SelectorMapaBase({ onTileError = () => {} }) {
  const [tipoMapa, setTipoMapa] = useState('ign_base');

  const capas = {
    ign_base: {
      nombre: '🗺️ IGN Base (Topográfico)',
      // URL optimizada en teselas WMTS para carga instantánea
      url: 'https://www.ign.es/wmts/ign-base?layer=IGNBaseTodo&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileRow={y}&TileCol={x}',
      attribution: '&copy; <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a>'
    },
    mtn: {
      nombre: '⛰️ MTN (Mapa Topográfico Nacional)',
      url: 'https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileRow={y}&TileCol={x}',
      attribution: '&copy; <a href="https://www.ign.es">IGN - Mapa Topográfico Nacional</a>'
    },
    pnoa_orto: {
      nombre: '🛰️ PNOA (Ortofotografía / Satélite)',
      // Ortofotografía rápida mediante teselas WMTS
      url: 'https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileRow={y}&TileCol={x}',
      attribution: 'PNOA WMTS. Cedido por &copy; <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a>'
    },
    osm: {
      nombre: '🌐 OpenStreetMap (Estándar)',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  };

  return (
    <>
      <TileLayer
        key={tipoMapa} // Fuerza un refresco limpio al cambiar de mapa
        url={capas[tipoMapa].url}
        attribution={capas[tipoMapa].attribution}
        maxZoom={20}
        maxNativeZoom={tipoMapa === 'osm' ? 19 : 18}
        eventHandlers={{ tileerror: () => onTileError(true) }}
        subdomains="abc"
        // Configuración para agilizar la carga en caché del navegador
        keepBuffer={4} 
      />
      
      {/* Desplegable flotante */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'white',
        padding: '6px 10px',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        border: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>Mapa:</label>
        <select
          aria-label="Cartografía"
          value={tipoMapa}
          onChange={(e) => { setTipoMapa(e.target.value); onTileError(false); }}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: '#f8f9fa',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            outline: 'none'
          }}
        >
          <option value="ign_base">🗺️ IGN Base (Topográfico)</option>
          <option value="mtn">⛰️ MTN (Mapa Topográfico Nacional)</option>
          <option value="pnoa_orto">🛰️ PNOA (Ortofotografía / Satélite)</option>
          <option value="osm">🌐 OpenStreetMap (Estándar)</option>
        </select>
      </div>
    </>
  );
}