import { distance, validPoint } from "./workspace";

export const routingProfiles = {
  gravel: "Gravel",
  trekking: "Cicloturismo",
  fastbike: "Carretera",
  mtb: "MTB",
};

// Solo se envían las anclas de la parte editada, nunca el archivo GPX.
export async function followRoads(anchors, profile = "gravel", signal) {
  if (
    (!routingProfiles[profile] && profile !== "shortest") ||
    anchors.length < 2 ||
    anchors.some((p) => !validPoint(p))
  )
    throw new Error("No se puede calcular con estas coordenadas.");
  const url = new URL("https://brouter.de/brouter");
  url.search = new URLSearchParams({
    lonlats: anchors.map((p) => `${p.lon},${p.lat}`).join("|"),
    profile,
    alternativeidx: "0",
    format: "geojson",
  });
  const response = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error(
      "BRouter no ha podido calcular este tramo. Prueba con puntos más cercanos a un camino o cambia al modo libre.",
    );
  const json = await response.json();
  const coordinates = json.features?.find(
    (f) => f.geometry?.type === "LineString",
  )?.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2)
    throw new Error("El servicio no ha devuelto un recorrido válido.");
  const points = coordinates.map((c) => ({
    lon: c[0],
    lat: c[1],
    ele: Number.isFinite(c[2]) ? c[2] : null,
    routeSample: true,
  }));
  if (points.some((p) => !validPoint(p)))
    throw new Error("El servicio ha devuelto coordenadas inválidas.");
  if (
    distance(points[0], anchors[0]) > 100 ||
    distance(points.at(-1), anchors.at(-1)) > 100
  )
    throw new Error(
      "No hay un camino suficientemente cerca de uno de los puntos (máximo 100 m). Acércalo a un camino o usa el modo libre.",
    );
  points[0].routeSample = false;
  points.at(-1).routeSample = false;
  return points;
}

// Conservar todos los puntos fuera de la ventana local de edición.
export async function routedEdit(
  points,
  index,
  point,
  action,
  neighbors,
  profile,
  signal,
) {
  const left = neighbors?.left ?? Math.max(0, index - 1);
  const right =
    neighbors?.right ??
    Math.min(points.length - 1, index + (action === "insert" ? 0 : 1));
  if (action === "append") {
    const leg = await followRoads([points.at(-1), point], profile, signal);
    // Conservar exactamente el extremo que enlaza con la geometría anterior.
    return [
      ...points.slice(0, -1),
      { ...points.at(-1), routeSample: false },
      ...leg.slice(1),
    ];
  }
  const anchors = [];
  if (index > 0) anchors.push(points[left]);
  if (action !== "delete") anchors.push(point);
  if (index < points.length - 1 || action === "insert")
    anchors.push(points[right]);
  if (anchors.length < 2) return points.filter((_, i) => i !== index);
  // Dos peticiones como máximo; conservar el punto intermedio como ancla estable.
  let replacement = [];
  for (let i = 1; i < anchors.length; i++) {
    const leg = await followRoads(
      [anchors[i - 1], anchors[i]],
      profile,
      signal,
    );
    replacement = [...replacement, ...leg.slice(i === 1 ? 0 : 1)];
  }
  if (index > 0) replacement[0] = { ...points[left], routeSample: false };
  if (index < points.length - 1 || action === "insert")
    replacement[replacement.length - 1] = {
      ...points[right],
      routeSample: false,
    };
  return [
    ...points.slice(0, index > 0 ? left : 0),
    ...replacement,
    ...points.slice(
      (index < points.length - 1 || action === "insert" ? right : index) + 1,
    ),
  ];
}
