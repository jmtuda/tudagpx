import { editorRouteKey } from "./editorRoutes";
import { followRoads } from "./routing";

export const sameEndpoint = (a, b) => a.lat === b.lat && a.lon === b.lon;
export function orderedMergeElements(draft, keys) {
  return keys.flatMap((key) => draft.filter((e) => editorRouteKey(e) === key));
}

// Operación atómica: ningún cambio del borrador hasta terminar TODOS los enlaces.
export async function mergeRoutePoints(elements, signal) {
  if (elements.length < 2 || elements.some((e) => e.points.length < 2))
    throw new Error(
      "Selecciona al menos dos trazados con dos puntos cada uno.",
    );
  const points = structuredClone(elements[0].points);
  for (const element of elements.slice(1)) {
    signal?.throwIfAborted();
    const end = points.at(-1),
      start = element.points[0];
    if (!sameEndpoint(end, start)) {
      const connection = await followRoads([end, start], "all-paths", signal);
      // Conservar extremos originales y la geometría calculada, sin recalcular los tracks.
      for (const p of connection) {
        if (!sameEndpoint(points.at(-1), p) && !sameEndpoint(p, start))
          points.push(p);
      }
      for (const p of structuredClone(element.points)) points.push(p);
    } else
      for (const p of structuredClone(element.points.slice(1))) points.push(p);
  }
  signal?.throwIfAborted();
  return points;
}
