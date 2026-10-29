import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import { SelectorMapaBase } from "./MapaBase";
import { colors, inBounds } from "../utils/workspace";
import { DirectTrace } from "./DirectTrace";
import { EditorTools } from "./EditorTools";
const positions = (points) => points.map((p) => [p.lat, p.lon]);

function Events({ onBounds, drawing, onDraw, focus }) {
  const ignoreClickUntil = useRef(0);
  const map = useMapEvents({
    "editor:drag": () => {
      ignoreClickUntil.current = performance.now() + 500;
    },
    moveend() {
      report();
    },
    click(e) {
      if (drawing && performance.now() > ignoreClickUntil.current) {
        const p = e.latlng.wrap();
        onDraw({ lat: p.lat, lon: p.lng, ele: null });
      }
    },
  });
  function report() {
    const b = map.getBounds();
    onBounds({
      south: b.getSouth(),
      north: b.getNorth(),
      west: b.getWest(),
      east: b.getEast(),
    });
  }
  useEffect(() => {
    const b = map.getBounds();
    onBounds({
      south: b.getSouth(),
      north: b.getNorth(),
      west: b.getWest(),
      east: b.getEast(),
    });
  }, [map, onBounds]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, debounceMoveend: true });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (focus?.points.length)
      map.fitBounds(positions(focus.points), {
        animate: false,
        padding: [55, 55],
        maxZoom: 15,
      });
  }, [focus, map]);
  useEffect(() => {
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
  }, [drawing, map]);
  return null;
}

export function WorkspaceMap({
  data,
  viewing = false,
  visibleRoutes,
  selected,
  hidden,
  hover,
  onHover,
  onToggle,
  onBounds,
  bounds,
  drawing,
  onDraw,
  focus,
  active,
  pointIndex,
  onSelect,
  onMove,
  editing,
  routingBusy,
  mode,
  crop,
  onInsert,
  onPointAction,
  onSplit,
  tools,
  issues,
}) {
  const [tileError, setTileError] = useState(false);

  const shown = useMemo(
    () =>
      data.segments.filter(
        (s) =>
          !hidden.includes(s.id) &&
          (selected.includes(s.id) || inBounds(s.points, bounds)),
      ),
    [data.segments, hidden, selected, bounds],
  );
  return (
    <div className="map-shell">
      <MapContainer
        center={[40.752, -3.984]}
        zoom={13}
        className="workspace-map"
        doubleClickZoom={!editing && !drawing}
      >
        <SelectorMapaBase onTileError={setTileError} />
        <Events
          onBounds={onBounds}
          drawing={editing && mode === "edit" && !routingBusy}
          onDraw={onDraw}
          focus={focus}
        />
        {data.routes
          .filter((r) => visibleRoutes.includes(r.id))
          .map((r, i) => (
            <Polyline
              key={r.id}
              bubblingMouseEvents={false}
              positions={r.tracks.map(positions)}
              pathOptions={{
                color: colors[i % colors.length],
                weight: 4,
                opacity: 0.8,
              }}
            >
              <Tooltip>{r.name}</Tooltip>
            </Polyline>
          ))}
        {!viewing &&
          shown.map((s) => (
            <Polyline
              key={s.id}
              bubblingMouseEvents={false}
              positions={positions(s.points)}
              pathOptions={{
                color: selected.includes(s.id)
                  ? colors[data.segments.indexOf(s) % colors.length]
                  : "#7f8c8c",
                weight: hover === s.id ? 8 : selected.includes(s.id) ? 6 : 3,
                opacity: selected.includes(s.id) || hover === s.id ? 1 : 0.45,
              }}
              eventHandlers={{
                mouseover: () => onHover(s.id),
                mouseout: () => onHover(null),
                click: () => {
                  if (!drawing) onToggle(s.id);
                },
              }}
            >
              <Tooltip>{s.name}</Tooltip>
            </Polyline>
          ))}
        {!viewing &&
          data.draft.map((e) => (
            <DirectTrace
              key={e.id}
              element={e}
              active={e.id === active}
              editing={editing}
              busy={routingBusy}
              mode={mode}
              pointIndex={e.id === active ? pointIndex : 0}
              crop={e.id === active ? crop : null}
              onSelect={onSelect}
              onMove={onMove}
              onInsert={onInsert}
              onAction={onPointAction}
              onSplit={onSplit}
            />
          ))}
        {issues
          ?.filter((i) => i.point)
          .map((issue, i) => (
            <CircleMarker
              key={i}
              center={[issue.point.lat, issue.point.lon]}
              radius={10}
              pathOptions={{ color: "#c93434", weight: 3, fillOpacity: 0.3 }}
            >
              <Tooltip>{issue.message}</Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>
      {!viewing && (
        <EditorTools {...tools} editing={editing} mode={mode} range={crop} />
      )}
      <div className="map-caption">
        {viewing ? (
          "Rutas superpuestas · un color por ruta"
        ) : (
          <>
            <span className="dot gray" /> Biblioteca{" "}
            <span className="dot teal" /> Selección <span className="dash" />{" "}
            Borrador
          </>
        )}
      </div>
      {tileError && (
        <div role="status" className="tile-warning">
          No se han podido cargar algunas teselas. Comprueba internet o cambia
          de mapa.
        </div>
      )}
    </div>
  );
}
