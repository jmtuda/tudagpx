import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SelectorMapaBase } from "./MapaBase";
import { colors, inBounds } from "../utils/workspace";
const positions = (points) => points.map((p) => [p.lat, p.lon]);
const handleIcon = L.divIcon({
  className: "point-handle",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
function Events({ onBounds, drawing, onDraw, focus }) {
  const map = useMapEvents({
    moveend() {
      report();
    },
    click(e) {
      if (drawing) onDraw({ lat: e.latlng.lat, lon: e.latlng.lng, ele: null });
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
    if (focus?.points.length)
      map.fitBounds(positions(focus.points), {
        padding: [55, 55],
        maxZoom: 15,
      });
  }, [focus, map]);
  useEffect(() => {
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
  }, [drawing, map]);
  return null;
}
function DraftLine({ element, index, active, onSelect }) {
  const map = useMap();
  return (
    <Polyline
      positions={positions(element.points)}
      pathOptions={{
        color: active ? "#e05d23" : "#e79962",
        weight: active ? 6 : 4,
        dashArray: "10 7",
      }}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          let closest = 0,
            min = Infinity;
          element.points.forEach((p, i) => {
            const d = map
              .latLngToLayerPoint([p.lat, p.lon])
              .distanceTo(map.latLngToLayerPoint(e.latlng));
            if (d < min) {
              min = d;
              closest = i;
            }
          });
          onSelect(element.id, closest);
        },
      }}
    >
      <Tooltip>
        {index + 1}. {element.name} · pulsa para editar un punto
      </Tooltip>
    </Polyline>
  );
}
export function WorkspaceMap({
  data,
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
  issues,
}) {
  const [tileError, setTileError] = useState(false);
  const element = data.draft.find((e) => e.id === active);
  const point = element?.points[pointIndex];
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
        doubleClickZoom={!drawing}
      >
        <SelectorMapaBase onTileError={setTileError} />
        <Events
          onBounds={onBounds}
          drawing={drawing}
          onDraw={onDraw}
          focus={focus}
        />
        {data.routes
          .filter((r) => visibleRoutes.includes(r.id))
          .map((r, i) => (
            <Polyline
              key={r.id}
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
        {shown.map((s) => (
          <Polyline
            key={s.id}
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
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (!drawing) onToggle(s.id);
              },
            }}
          >
            <Tooltip>{s.name}</Tooltip>
          </Polyline>
        ))}
        {data.draft.map((e, i) => (
          <DraftLine
            key={e.id}
            element={e}
            index={i}
            active={e.id === active}
            onSelect={onSelect}
          />
        ))}
        {point && !drawing && (
          <Marker
            position={[point.lat, point.lon]}
            icon={handleIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onMove({ lat: p.lat, lon: p.lng, ele: null });
              },
            }}
          >
            <Tooltip permanent>Arrastra el punto {pointIndex + 1}</Tooltip>
          </Marker>
        )}
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
      <div className="map-caption">
        <span className="dot gray" /> Biblioteca <span className="dot teal" />{" "}
        Selección <span className="dash" /> Borrador
      </div>
      {tileError && (
        <div role="status" className="tile-warning">
          No se han podido cargar algunas teselas. Comprueba internet o cambia
          de mapa.
        </div>
      )}
      {drawing && (
        <div className="drawing-hint">
          Pulsa en el mapa para añadir puntos. El trazado es libre, sin ajuste a
          caminos.
        </div>
      )}
    </div>
  );
}
