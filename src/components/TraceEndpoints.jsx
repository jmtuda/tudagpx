import { Marker } from "react-leaflet";
import L from "leaflet";
import "../traceEndpoints.css";

const endpointIcon = (kind, symbol, label, circular) => {
  const html = document.createElement("span");
  html.textContent = symbol;
  html.setAttribute("role", "img");
  html.setAttribute("aria-label", label);
  return L.divIcon({
    className: `trace-endpoint trace-${kind}`,
    html,
    iconSize: [22, 22],
    iconAnchor: [circular ? (kind === "start" ? 24 : -2) : 11, 11],
  });
};

// Separar los iconos coincidentes mantiene legibles los extremos de una circular.
export function TraceEndpoints({ points, name }) {
  if (!points.length) return null;
  const circular =
    points.length > 1 &&
    points[0].lat === points.at(-1).lat &&
    points[0].lon === points.at(-1).lon;
  return (
    <>
      {[
        {
          point: points[0],
          kind: "start",
          text: "Inicio",
          symbol: "▶",
        },
        {
          point: points.at(-1),
          kind: "end",
          text: "Final",
          symbol: "■",
        },
      ].map(({ point, kind, text, symbol }) => (
        <Marker
          key={kind}
          position={[point.lat, point.lon]}
          icon={endpointIcon(kind, symbol, `${text} de ${name}`, circular)}
          interactive={false}
          keyboard={false}
          zIndexOffset={-100}
        />
      ))}
    </>
  );
}
