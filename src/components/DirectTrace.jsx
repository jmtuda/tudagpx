import { useMemo, useState } from "react";
import { Marker, Polyline, Popup, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { anchorIndices, nearestOnTrace } from "../utils/editorGeometry";
import { TraceEndpoints } from "./TraceEndpoints";
const positions = (points) => points.map((p) => [p.lat, p.lon]);
const icon = (className, html = "", size = 16) =>
  L.divIcon({
    className,
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
const anchorIcon = icon("point-handle anchor-handle");
const selectedIcon = icon("point-handle anchor-handle selected-anchor");
const startIcon = icon("point-handle anchor-handle start-anchor");
const endIcon = icon("point-handle anchor-handle end-anchor");
const insertIcon = icon("insert-handle", "+", 14);
const scissorsIcon = icon("scissors-handle", "✂", 24);

export function DirectTrace({
  element,
  color,
  active,
  showDirection,
  editing,
  mode,
  busy,
  pointIndex,
  crop,
  onSelect,
  onMove,
  onInsert,
  onAction,
  onSplit,
}) {
  const [view, setView] = useState(null);
  const [preview, setPreview] = useState(null),
    [hover, setHover] = useState(null);
  const map = useMapEvents({
    zoomend: () => setView({ size: map.getSize() }),
    moveend: () => setView({ size: map.getSize() }),
  });
  const project = (p) => map.latLngToContainerPoint([p.lat, p.lon]);
  const nearest = (e) =>
    nearestOnTrace(
      element.points,
      map.latLngToContainerPoint(e.latlng),
      project,
      (p) => map.containerPointToLatLng([p.x, p.y]),
    );
  const indices = useMemo(
    () =>
      anchorIndices(
        element.points,
        (p) => map.latLngToContainerPoint([p.lat, p.lon]),
        view?.size || map.getSize(),
        pointIndex,
      ),
    [element.points, map, pointIndex, view],
  );
  const visualPoints = preview
    ? preview.insert
      ? [
          ...element.points.slice(0, preview.index),
          preview.point,
          ...element.points.slice(preview.index),
        ]
      : element.points.map((p, i) => (i === preview.index ? preview.point : p))
    : element.points;
  const isCrop = active && editing && mode === "crop";
  const from = crop?.start ?? 0,
    to = crop?.end ?? element.points.length - 1;
  const act = (action, index) => {
    map.closePopup();
    onAction(action, element.id, index, neighbors(index));
  };
  function neighbors(index, insert = false) {
    return {
      left: indices.filter((i) => i < index).at(-1) ?? 0,
      right:
        indices.find((i) => (insert ? i >= index : i > index)) ??
        element.points.length - 1,
    };
  }
  function drag(e, index, insert = false, commit = false) {
    map.fire("editor:drag");
    const ll = e.target.getLatLng().wrap(),
      point = { lat: ll.lat, lon: ll.lng, ele: null };
    if (commit) {
      setPreview(null);
      if (insert) onInsert(element.id, index, point, neighbors(index, true));
      else onMove(element.id, index, point, neighbors(index));
    } else setPreview({ index, point, insert });
  }
  return (
    <>
      <Polyline
        key={mode}
        positions={positions(visualPoints)}
        bubblingMouseEvents={false}
        pathOptions={{
          color,
          weight: active ? 5 : 4,
          opacity: isCrop ? 0.3 : 1,
          dashArray: "",
          className:
            editing && mode === "split"
              ? "draft-line split-cursor"
              : "draft-line",
        }}
        eventHandlers={{
          mousemove: (e) => {
            if (active && editing && mode === "split") setHover(nearest(e));
          },
          mouseout: (e) => {
            if (!e.originalEvent?.relatedTarget?.closest?.(".scissors-handle"))
              setHover(null);
          },
          click: (e) => {
            if (busy) return;
            if (!editing || !active) {
              onSelect(element.id, 0);
              return;
            }
            const hit = nearest(e);
            if (!hit) return;
            if (mode === "split") {
              onSplit(element.id, hit.index, hit.insert ? hit.point : null);
              setHover(null);
              return;
            }
            if (active && mode === "edit" && hit.insert) {
              onInsert(
                element.id,
                hit.index,
                hit.point,
                neighbors(hit.index, true),
              );
              return;
            }
            onSelect(element.id, hit.index);
          },
        }}
      >
        <Tooltip>
          {element.name}
          {editing ? " · pulsa para editar" : ""}
        </Tooltip>
      </Polyline>
      {showDirection && !isCrop && (
        <TraceEndpoints points={visualPoints} name={element.name} />
      )}
      {isCrop && element.points.length > 1 && (
        <>
          <Polyline
            positions={positions(element.points.slice(from, to + 1))}
            interactive={false}
            pathOptions={{
              color,
              weight: 7,
              dashArray: "",
              className: "crop-line",
            }}
          />
          {[from, to].map((index, i) => (
            <Marker
              key={`crop-${i}`}
              position={[element.points[index].lat, element.points[index].lon]}
              icon={i ? endIcon : startIcon}
              interactive={false}
            >
              <Tooltip permanent direction={i ? "right" : "left"}>
                {i ? "Final" : "Inicio"}
              </Tooltip>
            </Marker>
          ))}
        </>
      )}
      {active &&
        editing &&
        mode === "edit" &&
        indices.map((index) => {
          const p =
            preview && !preview.insert && preview.index === index
              ? preview.point
              : element.points[index];
          return (
            <Marker
              key={`anchor-${index}`}
              position={[p.lat, p.lon]}
              icon={
                index === pointIndex
                  ? selectedIcon
                  : index === 0
                    ? startIcon
                    : index === element.points.length - 1
                      ? endIcon
                      : anchorIcon
              }
              draggable={!busy}
              bubblingMouseEvents={false}
              title={`Editar punto ${index + 1}`}
              eventHandlers={{
                drag: (e) => drag(e, index),
                dragend: (e) => drag(e, index, false, true),
                click: (e) => {
                  if (busy) return;
                  if (e.originalEvent?.shiftKey) {
                    act("delete", index);
                    e.target.closePopup();
                  } else onSelect(element.id, index);
                },
                contextmenu: (e) => {
                  if (busy) return;
                  L.DomEvent.preventDefault(e.originalEvent);
                  onSelect(element.id, index);
                  e.target.openPopup();
                },
              }}
            >
              <Popup autoPan={false} className="anchor-popup">
                <div className="point-menu">
                  <strong>Editar este punto</strong>
                  <button
                    disabled={element.points.length < 2}
                    onClick={() => act("delete", index)}
                  >
                    Eliminar punto
                  </button>
                  <button
                    disabled={index <= 0 || index >= element.points.length - 1}
                    onClick={() => onSplit(element.id, index)}
                  >
                    Dividir aquí
                  </button>
                  <button
                    disabled={index >= element.points.length - 1}
                    onClick={() => act("crop-start", index)}
                  >
                    Marcar inicio del recorte
                  </button>
                  <button
                    disabled={index <= 0}
                    onClick={() => act("crop-end", index)}
                  >
                    Marcar final del recorte
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      {active &&
        editing &&
        mode === "edit" &&
        indices.slice(1).map((right, i) => {
          const edge = Math.max(
            indices[i] + 1,
            Math.ceil((indices[i] + right) / 2),
          );
          const a = element.points[edge - 1],
            b = element.points[edge];
          const midpoint = map.containerPointToLatLng(
            project(a).add(project(b)).divideBy(2),
          );
          const p =
            preview?.insert && preview.index === edge
              ? preview.point
              : { lat: midpoint.lat, lon: midpoint.lng };
          return (
            <Marker
              key={`insert-${edge}`}
              position={[p.lat, p.lon]}
              icon={insertIcon}
              draggable={!busy}
              bubblingMouseEvents={false}
              title={`Insertar punto entre ${edge} y ${edge + 1}`}
              eventHandlers={{
                drag: (e) => drag(e, edge, true),
                dragend: (e) => drag(e, edge, true, true),
                click: () =>
                  !busy &&
                  onInsert(
                    element.id,
                    edge,
                    {
                      lat: p.lat,
                      lon: p.lon,
                      ele: null,
                    },
                    neighbors(edge, true),
                  ),
              }}
            >
              <Tooltip>Arrastra para añadir un punto</Tooltip>
            </Marker>
          );
        })}
      {active && editing && mode === "split" && hover && (
        <Marker
          position={[hover.point.lat, hover.point.lon]}
          icon={scissorsIcon}
          bubblingMouseEvents={false}
          title="Dividir en este lugar"
          eventHandlers={{
            click: () => {
              onSplit(
                element.id,
                hover.index,
                hover.insert ? hover.point : null,
              );
              setHover(null);
            },
          }}
        />
      )}
    </>
  );
}
