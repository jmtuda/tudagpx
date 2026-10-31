import { Marker } from "react-leaflet";
import { traceEndpointIcon } from "../utils/traceEndpointIcon";
import "../traceEndpoints.css";

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
        },
        {
          point: points.at(-1),
          kind: "end",
          text: "Final",
        },
      ].map(({ point, kind, text }) => (
        <Marker
          key={kind}
          position={[point.lat, point.lon]}
          icon={traceEndpointIcon(kind, `${text} de ${name}`, circular)}
          interactive={false}
          keyboard={false}
          zIndexOffset={-100}
        />
      ))}
    </>
  );
}
