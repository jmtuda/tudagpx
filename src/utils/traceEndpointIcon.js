import L from "leaflet";

export function traceEndpointIcon(
  kind,
  label,
  circular = false,
  editable = false,
) {
  const html = document.createElement("span");
  html.textContent = kind === "start" ? "▶" : "■";
  html.setAttribute("role", "img");
  html.setAttribute("aria-label", label);
  return L.divIcon({
    className: `trace-endpoint trace-${kind}${editable ? " point-handle anchor-handle endpoint-handle" : ""}`,
    html,
    iconSize: [22, 22],
    iconAnchor: [circular ? (kind === "start" ? 24 : -2) : 11, 11],
  });
}
