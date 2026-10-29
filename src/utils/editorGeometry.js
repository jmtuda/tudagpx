import { distance } from "./workspace";

// Geometría de interfaz: las muestras visibles nunca simplifican el GPX guardado.
export function anchorIndices(points, project, viewport, selected = -1) {
  if (!points.length) return [];
  const indices = [0];
  let last = project(points[0]);
  points.forEach((point, index) => {
    if (!index || index === points.length - 1) return;
    if (point.routeSample) return;
    const pixel = project(point);
    if (
      pixel.x < -40 ||
      pixel.y < -40 ||
      pixel.x > viewport.x + 40 ||
      pixel.y > viewport.y + 40
    )
      return;
    if (Math.hypot(pixel.x - last.x, pixel.y - last.y) >= 38) {
      indices.push(index);
      last = pixel;
    }
  });
  indices.push(points.length - 1);
  const step = Math.max(1, Math.ceil(indices.length / 350));
  return [
    ...new Set([
      ...indices.filter((_, i) => i % step === 0),
      points.length - 1,
      selected,
    ]),
  ]
    .filter((i) => i >= 0 && i < points.length)
    .sort((a, b) => a - b);
}
export function nearestOnTrace(points, target, project, unproject) {
  let nearest = null;
  for (let i = 1; i < points.length; i++) {
    const a = project(points[i - 1]),
      b = project(points[i]);
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((target.x - a.x) * dx + (target.y - a.y) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    const pixel = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(target.x - pixel.x, target.y - pixel.y);
    if (nearest && nearest.distance <= d) continue;
    const snapped =
      Math.hypot(pixel.x - a.x, pixel.y - a.y) < 9
        ? i - 1
        : Math.hypot(pixel.x - b.x, pixel.y - b.y) < 9
          ? i
          : null;
    const ll = unproject(pixel);
    nearest = {
      distance: d,
      index: snapped ?? i,
      insert: snapped === null,
      point:
        snapped === null
          ? { lat: ll.lat, lon: ll.lng, ele: null }
          : points[snapped],
    };
  }
  return nearest;
}
export function splitTrace(points, index, insertedPoint = null) {
  const next = insertedPoint
    ? [...points.slice(0, index), insertedPoint, ...points.slice(index)]
    : points;
  if (index <= 0 || index >= next.length - 1) return null;
  return [
    structuredClone(next.slice(0, index + 1)),
    structuredClone(next.slice(index)),
  ];
}
export function cumulativeDistances(points) {
  const values = [0];
  for (let i = 1; i < points.length; i++)
    values.push(values.at(-1) + distance(points[i - 1], points[i]));
  return values;
}
