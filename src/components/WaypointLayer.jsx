import { Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { getGroupWaypoints } from "../utils/waypoints";
import "../waypoints.css";

const waypointIcon = L.divIcon({
  className: "waypoint-marker",
  html: '<span aria-hidden="true"><svg width="28" height="34" viewBox="0 0 24 30" fill="currentColor"><path d="M12 1a10 10 0 0 0-10 10c0 7 10 18 10 18s10-11 10-18A10 10 0 0 0 12 1Z"/><circle cx="12" cy="11" r="4" fill="white"/></svg></span>',
  iconSize: [28, 34],
  iconAnchor: [14, 34],
  popupAnchor: [0, -30],
});

export function WaypointLayer({
  elements = [],
  active,
  adding,
  onAdd,
  onEdit,
  readOnly = false,
  waypoints,
}) {
  useMapEvents({
    click(event) {
      if (event.originalEvent?.target?.closest?.("button,input,select,textarea,a")) return;
      if (
        adding &&
        !readOnly &&
        elements.some((element) => element.id === active)
      ) {
        const point = event.latlng.wrap();
        onAdd?.({ lat: point.lat, lon: point.lng, ele: null });
      }
    },
  });
  const points = waypoints ?? getGroupWaypoints(elements, active);
  return points.map((waypoint) => (
    <Marker
      key={waypoint.id}
      position={[waypoint.lat, waypoint.lon]}
      icon={waypointIcon}
      title={waypoint.name || "Waypoint"}
      alt={`Waypoint: ${waypoint.name || "Waypoint"}`}
      keyboard
      bubblingMouseEvents={false}
    >
      <Popup autoPanPaddingTopLeft={[20, readOnly ? 60 : 190]} autoPanPaddingBottomRight={[20, 25]} maxHeight={190} maxWidth={260}>
        <div className="waypoint-popup">
          <strong>{waypoint.name || "Waypoint"}</strong>
          <p>{waypoint.description}</p>
          {!readOnly && onEdit && (
            <button type="button" onClick={() => onEdit(waypoint)}>
              Editar waypoint
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  ));
}

export default WaypointLayer;
