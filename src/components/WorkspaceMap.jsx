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
import { EditorTraceTabs } from "./EditorTraceTabs";
import { TraceEndpoints } from "./TraceEndpoints";
import { editorRouteColors, editorRouteKey } from "../utils/editorRoutes";
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
      if (
        e.originalEvent?.target?.closest?.("button, input, select, textarea, a")
      )
        return;
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
  onToggleRoute,
  onDropFiles,
  importing,
  bounds,
  selected,
  hidden,
  hover,
  onHover,
  onOpenSegment,
  onBounds,

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
  const [dropping, setDropping] = useState(false);
  const routeColors = editorRouteColors(data.draft);

  const shown = useMemo(
    () =>
      data.segments.filter(
        (s) =>
          !hidden.includes(s.id) &&
          selected.includes(s.id) &&
          !data.draft.some((element) => element.sourceId === s.id),
      ),
    [data.segments, data.draft, hidden, selected],
  );
  return (
    <div
      className="map-shell"
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = importing ? "none" : "copy";
        setDropping(!importing);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setDropping(false);
      }}
      onDrop={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setDropping(false);
        if (!importing) onDropFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {dropping && (
        <div className="map-drop-hint" role="status">
          Suelta uno o varios archivos GPX para importarlos
        </div>
      )}
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
          .filter(
            (r) =>
              viewing &&
              (visibleRoutes.includes(r.id) ||
                r.tracks.some((points) => inBounds(points, bounds))),
          )
          .sort(
            (a, b) =>
              Number(visibleRoutes.includes(a.id)) -
              Number(visibleRoutes.includes(b.id)),
          )
          .map((r) => (
            <Polyline
              key={`${r.id}-${visibleRoutes.includes(r.id) ? "selected" : "reference"}`}
              bubblingMouseEvents={false}
              positions={r.tracks.map(positions)}
              pathOptions={{
                color: visibleRoutes.includes(r.id)
                  ? colors[data.routes.indexOf(r) % colors.length]
                  : "#c1cbd0",
                weight: visibleRoutes.includes(r.id) ? 6 : 4,
                opacity: visibleRoutes.includes(r.id) ? 0.95 : 0.5,
                className: visibleRoutes.includes(r.id)
                  ? "viewer-route viewer-route-selected"
                  : "viewer-route-reference",
              }}
              eventHandlers={{ click: () => onToggleRoute(r.id) }}
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
                className: "editor-segment-reference",
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
                  onOpenSegment(s.id);
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
              color={routeColors.get(editorRouteKey(e))}
              active={e.id === active}
              showDirection={
                tools.mergeSelection?.length
                  ? tools.mergeSelection.includes(editorRouteKey(e))
                  : e.id === active
              }
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
        {viewing &&
          data.routes
            .filter((r) => visibleRoutes.includes(r.id))
            .flatMap((route) =>
              route.tracks.map((points, i) => (
                <TraceEndpoints
                  key={`${route.id}-${i}`}
                  points={points}
                  name={`${route.name} · tramo ${i + 1}`}
                />
              )),
            )}
        {!viewing &&
          shown.map((segment) => (
            <TraceEndpoints
              key={`ends-${segment.id}`}
              points={segment.points}
              name={segment.name}
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
      {!viewing && (
        <EditorTraceTabs
          elements={data.draft}
          active={active}
          onSelect={tools.onSelectFile}
          selection={tools.mergeSelection}
          onClose={tools.onCloseRoute}
        />
      )}
      <div className={`map-caption${!viewing ? " editor-map-caption" : ""}`}>
        {viewing ? (
          "Rutas de la zona atenuadas · pulsa para seleccionar"
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
