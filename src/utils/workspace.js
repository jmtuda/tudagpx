// Modelo local independiente del proveedor de almacenamiento y de Leaflet.
export const uid = () => crypto.randomUUID();
export const colors = [
  "#007d77",
  "#b44b98",
  "#dc7617",
  "#3f64d7",
  "#a75330",
  "#6a51bd",
];
export const validPoint = (p) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lon) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lon) <= 180;
export function distance(a, b) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function stats(tracks) {
  let meters = 0,
    ascent = 0,
    missing = 0;
  for (const points of tracks)
    points.forEach((p, i) => {
      if (!Number.isFinite(p.ele)) missing++;
      if (!i) return;
      meters += distance(points[i - 1], p);
      if (Number.isFinite(p.ele) && Number.isFinite(points[i - 1].ele))
        ascent += Math.max(0, p.ele - points[i - 1].ele);
    });
  return { km: meters / 1000, ascent: Math.round(ascent), missing };
}
const children = (node, name) =>
  [...node.children].filter((n) => n.localName === name);
export function parseGPX(text, filename = "Ruta importada") {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "gpx"
  )
    throw new Error("El archivo no es un GPX válido.");
  const read = (node) => {
    const lat = node.getAttribute("lat"),
      lon = node.getAttribute("lon");
    const elevation = children(node, "ele")[0]?.textContent;
    const p = {
      lat: lat?.trim() ? Number(lat) : NaN,
      lon: lon?.trim() ? Number(lon) : NaN,
      ele:
        elevation?.trim() && Number.isFinite(Number(elevation))
          ? Number(elevation)
          : null,
    };
    if (!validPoint(p))
      throw new Error(
        "El GPX contiene coordenadas inválidas. No se ha importado.",
      );
    return p;
  };
  const tracks = [];
  for (const trk of children(doc.documentElement, "trk")) {
    for (const seg of children(trk, "trkseg")) {
      const points = children(seg, "trkpt").map(read);
      if (points.length) tracks.push(points);
    }
  }
  for (const route of children(doc.documentElement, "rte")) {
    const points = children(route, "rtept").map(read);
    if (points.length) tracks.push(points);
  }
  if (!tracks.length)
    throw new Error("No hay trazados en este GPX (trkpt o rtept).");
  const named = [...doc.getElementsByTagNameNS("*", "name")].find(
    (n) => n.parentNode.localName === "trk" || n.parentNode.localName === "rte",
  );
  return {
    id: uid(),
    name: named?.textContent.trim() || filename.replace(/\.gpx$/i, ""),
    tracks,
    original: text,
    filename,
    createdAt: new Date().toISOString(),
    sport: "Sin clasificar",
  };
}
export const escapeXML = (s) =>
  String(s).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function exportGPX(elements, name) {
  if (
    !elements.length ||
    elements.some(
      (e) => e.points.length < 2 || e.points.some((p) => !validPoint(p)),
    )
  )
    throw new Error("Cada tramo debe tener al menos dos puntos válidos.");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="TudaGPX" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${escapeXML(name)}</name>${elements.map((e) => `<trkseg>${e.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${Number.isFinite(p.ele) ? `<ele>${p.ele}</ele>` : ""}</trkpt>`).join("")}</trkseg>`).join("")}</trk></gpx>`;
}
export function review(elements) {
  const issues = [],
    edges = new Set();
  if (!elements.length)
    issues.push({ blocking: true, message: "El borrador está vacío." });
  elements.forEach((e, i) => {
    if (e.points.length < 2)
      issues.push({
        blocking: true,
        message: `${e.name}: necesita al menos dos puntos.`,
      });
    if (e.points.some((p) => !validPoint(p)))
      issues.push({
        blocking: true,
        message: `${e.name}: coordenadas inválidas.`,
      });
    const missing = e.points.filter((p) => !Number.isFinite(p.ele)).length;
    if (missing)
      issues.push({
        message: `${e.name}: ${missing} puntos sin elevación.`,
        point: e.points.find(validPoint),
      });
    if (i && elements[i - 1].points.length && e.points.length) {
      const end = elements[i - 1].points.at(-1),
        start = e.points[0];
      if (validPoint(end) && validPoint(start) && distance(end, start) > 30)
        issues.push({
          message: `Hueco antes de «${e.name}»: ${Math.round(distance(end, start))} m. Comprueba orden y sentido.`,
          point: start,
        });
    }
    let duplicated = false;
    e.points.forEach((p, j) => {
      if (!j || !validPoint(p) || !validPoint(e.points[j - 1])) return;
      const key = [e.points[j - 1], p]
        .map((q) => `${q.lat.toFixed(6)},${q.lon.toFixed(6)}`)
        .sort()
        .join("|");
      if (edges.has(key)) duplicated = true;
      edges.add(key);
    });
    if (duplicated)
      issues.push({
        message: `${e.name}: hay aristas duplicadas, también en sentido inverso.`,
        point: e.points.find(validPoint),
      });
  });
  return issues;
}
// Intersección línea-rectángulo: también encuentra trazados sin vértices dentro de la vista.
export function inBounds(points, b) {
  if (!b) return true;
  const inside = (p) =>
    p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;
  if (points.some(inside)) return true;
  return points.some((p, i) => {
    if (!i) return false;
    const a = points[i - 1],
      dx = p.lon - a.lon,
      dy = p.lat - a.lat;
    let lo = 0,
      hi = 1;
    for (const [v, q] of [
      [-dx, a.lon - b.west],
      [dx, b.east - a.lon],
      [-dy, a.lat - b.south],
      [dy, b.north - a.lat],
    ]) {
      if (v === 0) {
        if (q < 0) return false;
      } else if (v < 0) lo = Math.max(lo, q / v);
      else hi = Math.min(hi, q / v);
      if (lo > hi) return false;
    }
    return true;
  });
}
export function initialWorkspace() {
  const a = [
    { lat: 40.735, lon: -3.99, ele: 1160 },
    { lat: 40.745, lon: -4.002, ele: 1220 },
    { lat: 40.758, lon: -4.012, ele: 1305 },
    { lat: 40.77, lon: -4.008, ele: 1380 },
  ];
  const b = [
    a.at(-1),
    { lat: 40.776, lon: -3.985, ele: 1420 },
    { lat: 40.769, lon: -3.961, ele: 1330 },
    { lat: 40.755, lon: -3.953, ele: 1210 },
  ];
  const c = [
    b.at(-1),
    { lat: 40.742, lon: -3.96, ele: 1190 },
    { lat: 40.73, lon: -3.975, ele: 1120 },
    a[0],
  ];
  return {
    schema: 1,
    routes: [
      {
        id: "demo-route",
        name: "Vuelta por la sierra · DEMO",
        tracks: [[...a, ...b.slice(1), ...c.slice(1)]],
        sport: "Gravel",
        demo: true,
      },
    ],
    segments: [a, b, c].map((points, i) => ({
      id: `demo-${i}`,
      name: [
        "Subida al mirador · DEMO",
        "Camino de la ladera · DEMO",
        "Regreso al pueblo · DEMO",
      ][i],
      points,
      demo: true,
    })),
    draft: [],
    draftName: "Mi nueva ruta",
    projects: [],
  };
}
export function validateWorkspace(data) {
  if (
    data?.schema !== 1 ||
    !Array.isArray(data.routes) ||
    !Array.isArray(data.segments) ||
    !Array.isArray(data.draft) ||
    !Array.isArray(data.projects) ||
    typeof data.draftName !== "string"
  )
    throw new Error("Copia de seguridad incompatible.");
  const ids = new Set();
  const check = (item, tracks, allowEmpty = false) => {
    if (
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      typeof item.name !== "string" ||
      !Array.isArray(tracks) ||
      !tracks.length ||
      tracks.some(
        (t) =>
          !Array.isArray(t) ||
          (!allowEmpty && !t.length) ||
          t.some(
            (p) =>
              !p ||
              !validPoint(p) ||
              (p.ele !== null &&
                p.ele !== undefined &&
                !Number.isFinite(p.ele)),
          ),
      )
    )
      throw new Error(
        "La copia contiene trazados inválidos o identificadores repetidos.",
      );
    ids.add(item.id);
  };
  data.routes.forEach((r) => {
    check(r, r.tracks);
    if (r.original !== undefined && typeof r.original !== "string")
      throw new Error("Original GPX inválido.");
    if (r.originalBase64 !== undefined) {
      if (typeof r.originalBase64 !== "string")
        throw new Error("Bytes originales inválidos.");
      try {
        atob(r.originalBase64);
      } catch {
        throw new Error("Bytes originales dañados.");
      }
    }
  });
  data.segments.forEach((s) => check(s, [s.points]));
  data.draft.forEach((e) => check(e, [e.points], true));
  data.projects.forEach((p) => {
    if (
      typeof p.id !== "string" ||
      typeof p.name !== "string" ||
      !Array.isArray(p.elements)
    )
      throw new Error("Proyecto inválido.");
    // Los snapshots conservan los mismos identificadores del borrador por diseño.
    p.elements.forEach((e) => {
      if (
        !e ||
        typeof e.name !== "string" ||
        !Array.isArray(e.points) ||
        e.points.some((q) => !q || !validPoint(q))
      )
        throw new Error("Proyecto con puntos inválidos.");
    });
  });
  return data;
}
