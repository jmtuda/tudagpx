import { useEffect, useRef, useState } from "react";
import { DomEvent } from "leaflet";
import { TileLayer } from "react-leaflet";

export function SelectorMapaBase({ onTileError = () => {} }) {
  const [tipoMapa, setTipoMapa] = useState("pnoa_orto");
  const [showReferences, setShowReferences] = useState(() => {
    try {
      return localStorage.getItem("tudagpx-pnoa-references") !== "false";
    } catch {
      return true;
    }
  });
  const [referencesError, setReferencesError] = useState(false);
  const [open, setOpen] = useState(false);
  const control = useRef(null);
  useEffect(() => {
    DomEvent.disableClickPropagation(control.current);
    DomEvent.disableScrollPropagation(control.current);
  }, []);

  const capas = {
    ign_base: {
      nombre: "🗺️ IGN Base (Topográfico)",
      // URL optimizada en teselas WMTS para carga instantánea
      url: "https://www.ign.es/wmts/ign-base?layer=IGNBaseTodo&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileRow={y}&TileCol={x}",
      attribution:
        '&copy; <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a>',
    },
    mtn: {
      nombre: "⛰️ MTN (Mapa Topográfico Nacional)",
      url: "https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileRow={y}&TileCol={x}",
      attribution:
        '&copy; <a href="https://www.ign.es">IGN - Mapa Topográfico Nacional</a>',
    },
    pnoa_orto: {
      nombre: "🛰️ PNOA (Ortofotografía / Satélite)",
      // Ortofotografía rápida mediante teselas WMTS
      url: "https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileRow={y}&TileCol={x}",
      attribution:
        'PNOA WMTS. Cedido por &copy; <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a>',
    },
    osm: {
      nombre: "🌐 OpenStreetMap (Estándar)",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  };

  return (
    <>
      <TileLayer
        key={tipoMapa} // Fuerza un refresco limpio al cambiar de mapa
        url={capas[tipoMapa].url}
        attribution={capas[tipoMapa].attribution}
        maxZoom={20}
        maxNativeZoom={tipoMapa === "osm" ? 19 : 18}
        eventHandlers={{ tileerror: () => onTileError(true) }}
        subdomains="abc"
        // Configuración para agilizar la carga en caché del navegador
        keepBuffer={4}
      />

      {tipoMapa === "pnoa_orto" && showReferences && (
        <TileLayer
          url="https://www.ign.es/wmts/ign-base?layer=IGNBaseOrto&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileRow={y}&TileCol={x}"
          attribution='Nombres y referencias: &copy; <a href="https://www.ign.es">IGN</a>'
          maxZoom={20}
          maxNativeZoom={18}
          zIndex={250}
          keepBuffer={4}
          eventHandlers={{ tileerror: () => setReferencesError(true) }}
        />
      )}

      {/* Desplegable flotante */}
      <div
        ref={control}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1001,
          background: "white",
          padding: "6px 10px",
          borderRadius: "6px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          border: "1px solid #ccc",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "6px",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <button
          aria-label="Seleccionar mapa"
          title="Seleccionar mapa"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{ padding: "3px", width: 32, height: 32 }}
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15" />
          </svg>
        </button>
        {open && (
          <>
            <select
              size={4}
              aria-label="Cartografía"
              value={tipoMapa}
              onChange={(e) => {
                setTipoMapa(e.target.value);
                onTileError(false);
                setOpen(false);
              }}
              style={{
                padding: "4px 8px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
                background: "#f8f9fa",
                color: "#333",
                border: "1px solid #ccc",
                borderRadius: "4px",
                outline: "none",
              }}
            >
              <option value="ign_base">🗺️ IGN Base (Topográfico)</option>
              <option value="mtn">⛰️ MTN (Mapa Topográfico Nacional)</option>
              <option value="pnoa_orto">
                🛰️ PNOA (Ortofotografía / Satélite)
              </option>
              <option value="osm">🌐 OpenStreetMap (Estándar)</option>
            </select>
            {tipoMapa === "pnoa_orto" && (
              <>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={showReferences}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowReferences(checked);
                      setReferencesError(false);
                      try {
                        localStorage.setItem(
                          "tudagpx-pnoa-references",
                          String(checked),
                        );
                      } catch {
                        // La opción sigue funcionando si el navegador impide guardarla.
                      }
                    }}
                  />
                  Mostrar nombres y referencias
                </label>
                {showReferences && referencesError && (
                  <span role="status" style={{ maxWidth: 220, fontSize: 12 }}>
                    No se han podido cargar algunas referencias del IGN. Las
                    ortofotos siguen disponibles.
                  </span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
