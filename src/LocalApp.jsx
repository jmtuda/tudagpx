import { useEffect, useRef, useState } from "react";
import { WorkspaceMap } from "./components/WorkspaceMap";
import {
  colors,
  uid,
  parseGPX,
  stats,
  inBounds,
  initialWorkspace,
  review,
  exportGPX,
  validateWorkspace,
} from "./utils/workspace";
import { loadWorkspace, saveWorkspace, download } from "./utils/localStore";
import "./workspace.css";
const clone = (value) => structuredClone(value);
const toggle = (items, id) =>
  items.includes(id) ? items.filter((x) => x !== id) : [...items, id];
function Metrics({ tracks }) {
  const s = stats(tracks);
  return (
    <span className="metrics">
      {s.km.toFixed(2)} km{" "}
      <span>
        ↗ {s.ascent} m{s.missing ? " · elevación parcial" : ""}
      </span>
    </span>
  );
}
function Profile({ tracks, color }) {
  const values = tracks
    .flat()
    .filter((p) => Number.isFinite(p.ele))
    .map((p) => p.ele);
  if (values.length < 2) return <small>Sin perfil de elevación</small>;
  const low = values.reduce((a, b) => Math.min(a, b), Infinity),
    high = values.reduce((a, b) => Math.max(a, b), -Infinity);
  const path = values
    .map(
      (v, i) =>
        `${(i * 240) / (values.length - 1)},${44 - ((v - low) * 37) / (high - low || 1)}`,
    )
    .join(" ");
  return (
    <svg
      className="profile"
      viewBox="0 0 240 50"
      role="img"
      aria-label={`Perfil de elevación: ${Math.round(low)} a ${Math.round(high)} metros. Eje horizontal por puntos.`}
    >
      <polyline
        points={`0,50 ${path} 240,50`}
        fill={color}
        fillOpacity=".09"
        stroke="none"
      />
      <polyline points={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
export default function LocalApp() {
  const [data, setData] = useState(null),
    [fatal, setFatal] = useState(""),
    [saved, setSaved] = useState("Cargando…");
  const [tab, setTab] = useState("segments"),
    [query, setQuery] = useState(""),
    [sport, setSport] = useState("Todos");
  const [selected, setSelected] = useState([]),
    [hidden, setHidden] = useState([]),
    [visibleRoutes, setVisibleRoutes] = useState([]);
  const [hover, setHover] = useState(null),
    [bounds, setBounds] = useState(null),
    [focus, setFocus] = useState(null);
  const [active, setActive] = useState(null),
    [pointIndex, setPointIndex] = useState(0),
    [drawing, setDrawing] = useState(false);
  const [past, setPast] = useState([]),
    [future, setFuture] = useState([]),
    [issues, setIssues] = useState(null),
    [accept, setAccept] = useState(false);
  const [notice, setNotice] = useState(""),
    [importing, setImporting] = useState(false),
    [importKind, setImportKind] = useState("routes");
  const fileInput = useRef(),
    backupInput = useRef(),
    queue = useRef(Promise.resolve()),
    revision = useRef(0);
  useEffect(() => {
    let alive = true;
    loadWorkspace()
      .then((value) => {
        if (alive) {
          setData(value ? validateWorkspace(value) : initialWorkspace());
          setSaved("Guardado local");
        }
      })
      .catch(() => {
        if (alive)
          setFatal(
            "No se ha podido abrir el almacenamiento local. No se ha sobrescrito ningún dato. Comprueba que este navegador permite IndexedDB y vuelve a cargar.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const rev = ++revision.current;
    setSaved("Guardando…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveWorkspace(data));
    queue.current
      .then(() => {
        if (revision.current === rev) setSaved("Guardado en este navegador");
      })
      .catch(() => {
        setSaved("Error de guardado: descarga una copia de seguridad");
      });
  }, [data]);
  function update(fn) {
    setData((d) => fn(d));
  }
  function edit(next) {
    setPast((p) => [...p, clone(data.draft)].slice(-80));
    setFuture([]);
    update((d) => ({
      ...d,
      draft: typeof next === "function" ? next(d.draft) : next,
    }));
    setIssues(null);
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [clone(data.draft), ...f]);
    update((d) => ({ ...d, draft: past.at(-1) }));
    setPast((p) => p.slice(0, -1));
    setDrawing(false);
    setIssues(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, clone(data.draft)]);
    update((d) => ({ ...d, draft: future[0] }));
    setFuture((f) => f.slice(1));
    setDrawing(false);
    setIssues(null);
  }
  function addSegments(ids) {
    const additions = data.segments
      .filter((s) => ids.includes(s.id))
      .map((s) => ({
        id: uid(),
        name: s.name,
        points: clone(s.points),
        sourceId: s.id,
      }));
    if (!additions.length) return;
    edit([...data.draft, ...additions]);
    setActive(additions[0].id);
    setPointIndex(0);
    setTab("draft");
    setNotice(
      "Copias añadidas al borrador. Los segmentos originales no cambian.",
    );
  }
  function focusPoints(points) {
    setFocus({ id: uid(), points });
  }
  async function importFiles(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    setImporting(true);
    const routes = [],
      errors = [];
    for (const file of files) {
      try {
        if (file.size > 25 * 1024 * 1024)
          throw new Error("El límite por archivo es 25 MB.");
        routes.push(parseGPX(await file.text(), file.name));
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }
    if (routes.length) {
      if (importKind === "segments") {
        const additions = routes.flatMap((r) =>
          r.tracks.map((points, i) => ({
            id: uid(),
            name: r.name + (r.tracks.length > 1 ? ` · tramo ${i + 1}` : ""),
            points: clone(points),
            sourceRouteId: r.id,
          })),
        );
        update((d) => ({
          ...d,
          routes: [...d.routes, ...routes],
          segments: [...d.segments, ...additions],
        }));
        setSelected((s) => [...s, ...additions.map((x) => x.id)]);
        setTab("segments");
      } else {
        update((d) => ({ ...d, routes: [...d.routes, ...routes] }));
        setVisibleRoutes((v) => [...v, ...routes.map((r) => r.id)]);
        setTab("routes");
      }
      focusPoints(routes.flatMap((r) => r.tracks.flat()));
    }
    setNotice(
      `${routes.length} GPX importados; originales conservados.${errors.length ? " " + errors.join(" ") : ""}`,
    );
    setImporting(false);
  }
  function routeSegments(route) {
    const additions = route.tracks.map((points, i) => ({
      id: uid(),
      name: `${route.name} · tramo ${i + 1}`,
      points: clone(points),
      sourceRouteId: route.id,
    }));
    update((d) => ({ ...d, segments: [...d.segments, ...additions] }));
    setSelected((s) => [...s, ...additions.map((x) => x.id)]);
    setTab("segments");
    setNotice(
      "Segmentos independientes creados. Puedes incorporarlos y recortarlos en el borrador.",
    );
  }
  function startDraw() {
    const e = {
      id: uid(),
      name: `Trazado libre ${data.draft.length + 1}`,
      points: [],
    };
    edit([...data.draft, e]);
    setActive(e.id);
    setPointIndex(0);
    setDrawing(true);
    setTab("draft");
  }
  function changeElement(fn) {
    edit(data.draft.map((e) => (e.id === active ? fn(clone(e)) : e)));
  }
  function saveProject() {
    const p = {
      id: uid(),
      name: data.draftName || "Sin título",
      elements: clone(data.draft),
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, projects: [...d.projects, p] }));
    setNotice(
      "Versión del proyecto guardada, sin sustituir versiones anteriores.",
    );
  }
  function loadProject(p) {
    const previous = {
      id: uid(),
      name: `${data.draftName} · antes de abrir proyecto`,
      elements: clone(data.draft),
      createdAt: new Date().toISOString(),
    };
    edit(clone(p.elements));
    update((d) => ({
      ...d,
      draftName: p.name,
      projects: [...d.projects, previous],
    }));
    setActive(null);
    setDrawing(false);
    setTab("draft");
    focusPoints(p.elements.flatMap((e) => e.points));
    setNotice(
      "Proyecto abierto. El borrador anterior se ha conservado como otra versión.",
    );
  }
  async function importBackup(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const source = validateWorkspace(JSON.parse(await file.text()));
      const idMap = new Map(
        [...source.routes, ...source.segments].map((e) => [e.id, uid()]),
      );
      const copy = (e) => ({
        ...clone(e),
        id: uid(),
        sourceId: idMap.get(e.sourceId) || e.sourceId,
      });
      const routes = source.routes.map((r) => ({ ...r, id: idMap.get(r.id) }));
      const segments = source.segments.map((s) => ({
        ...s,
        id: idMap.get(s.id),
        sourceRouteId: idMap.get(s.sourceRouteId) || s.sourceRouteId,
      }));
      const projects = [
        ...source.projects.map((p) => ({
          ...p,
          id: uid(),
          elements: p.elements.map(copy),
        })),
        {
          id: uid(),
          name: source.draftName + " · copia importada",
          createdAt: new Date().toISOString(),
          elements: source.draft.map(copy),
        },
      ];
      update((d) => ({
        ...d,
        routes: [...d.routes, ...routes],
        segments: [...d.segments, ...segments],
        projects: [...d.projects, ...projects],
      }));
      setNotice(
        "Copia añadida sin borrar ni reemplazar datos actuales. Su borrador está en Proyectos.",
      );
      setTab("projects");
    } catch (e) {
      setNotice(`No se ha importado la copia: ${e.message}`);
    }
  }
  if (fatal)
    return (
      <main className="startup">
        <h1>TudaGPX</h1>
        <p role="alert">{fatal}</p>
      </main>
    );
  if (!data) return <main className="startup">Abriendo TudaGPX…</main>;
  const activeElement = data.draft.find((e) => e.id === active);
  const viewportSegments = data.segments.filter((s) =>
    inBounds(s.points, bounds),
  );
  const listSegments = data.segments.filter(
    (s) =>
      (inBounds(s.points, bounds) || selected.includes(s.id)) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  const routes = data.routes.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) &&
      (sport === "Todos" || r.sport === sport),
  );
  const patchPoint = (point) =>
    changeElement((e) => ({
      ...e,
      points: e.points.map((p, i) => (i === pointIndex ? point : p)),
    }));
  const exportDraft = () => {
    try {
      const xml = exportGPX(data.draft, data.draftName);
      parseGPX(xml);
      download(xml, "TudaGPX-ruta.gpx");
      setNotice(
        "GPX exportado. Los tramos se mantienen separados: no se han añadido conexiones.",
      );
      setIssues(null);
    } catch (e) {
      setNotice(e.message);
    }
  };
  return (
    <div className="local-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">⌁</span>
          <div>
            <h1>
              Tuda<span>GPX</span>
            </h1>
            <small>Tu próxima ruta empieza aquí</small>
          </div>
        </div>
        <div className="local-status">
          <i /> Solo local · privado <span>{saved}</span>
        </div>
        <button
          className="primary"
          disabled={importing}
          onClick={() => fileInput.current.click()}
        >
          {importing ? "Importando…" : "+ Importar GPX"}
        </button>
      </header>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".gpx,application/gpx+xml"
        multiple
        onChange={importFiles}
      />
      <input
        hidden
        ref={backupInput}
        type="file"
        accept=".json"
        onChange={importBackup}
      />
      <div className="workbench">
        <aside className="sidebar">
          <div className="sidebar-top">
            <p className="eyebrow">TU ESPACIO DE RUTAS</p>
            <nav aria-label="Biblioteca">
              <button
                className={tab === "segments" ? "active" : ""}
                onClick={() => setTab("segments")}
              >
                Segmentos <b>{data.segments.length}</b>
              </button>
              <button
                className={tab === "routes" ? "active" : ""}
                onClick={() => setTab("routes")}
              >
                Rutas <b>{data.routes.length}</b>
              </button>
              <button
                className={tab === "draft" ? "active" : ""}
                onClick={() => setTab("draft")}
              >
                Borrador <b>{data.draft.length}</b>
              </button>
              <button
                className={tab === "projects" ? "active" : ""}
                onClick={() => setTab("projects")}
              >
                Proyectos
              </button>
            </nav>
          </div>
          {(tab === "segments" || tab === "routes") && (
            <div className="filters">
              <input
                aria-label="Buscar en la biblioteca"
                placeholder="Buscar por nombre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="import-options">
                <label>
                  Importar como{" "}
                  <select
                    aria-label="Destino del GPX"
                    value={importKind}
                    onChange={(e) => setImportKind(e.target.value)}
                  >
                    <option value="routes">Rutas</option>
                    <option value="segments">Segmentos + original</option>
                  </select>
                </label>
                {tab === "routes" && (
                  <select
                    aria-label="Filtrar ciclismo"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                  >
                    {[
                      "Todos",
                      "Sin clasificar",
                      "Carretera",
                      "Gravel",
                      "MTB",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
          <div className="panel-content">
            {tab === "segments" && (
              <>
                <div className="section-heading">
                  <h2>Segmentos de la zona</h2>
                  <span>{viewportSegments.length} en el mapa</span>
                </div>
                <p className="hint">
                  Mueve el mapa para explorar. Los seleccionados permanecen
                  contigo, aunque salgan de la vista.
                </p>
                {selected.length > 0 && (
                  <button
                    className="primary full"
                    onClick={() => addSegments(selected)}
                  >
                    Añadir {selected.length} seleccionados al borrador
                  </button>
                )}
                {!listSegments.length && (
                  <p className="empty">
                    No hay segmentos en esta zona. Importa un GPX o vuelve a la
                    zona de demostración.
                  </p>
                )}
                {listSegments.map((s) => {
                  const index = data.segments.indexOf(s),
                    isSelected = selected.includes(s.id);
                  return (
                    <article
                      key={s.id}
                      className={`library-card ${isSelected ? "selected" : ""} ${hover === s.id ? "hovered" : ""}`}
                      style={{ "--route-color": colors[index % colors.length] }}
                      onMouseEnter={() => setHover(s.id)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <div className="card-title">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${s.name}`}
                          checked={isSelected}
                          onChange={() => setSelected((v) => toggle(v, s.id))}
                        />
                        <h3>{s.name}</h3>
                        <span className="color-mark" />
                      </div>
                      <Metrics tracks={[s.points]} />
                      <p className="tags">
                        {s.demo
                          ? "Demostración sintética · no seguir en campo"
                          : "Original protegido"}
                        {!inBounds(s.points, bounds)
                          ? " · fuera de la vista"
                          : ""}
                      </p>
                      <div className="card-actions">
                        <button onClick={() => focusPoints(s.points)}>
                          Centrar
                        </button>
                        <button
                          onClick={() => setHidden((h) => toggle(h, s.id))}
                        >
                          {hidden.includes(s.id) ? "Mostrar" : "Ocultar"}
                        </button>
                        <button onClick={() => addSegments([s.id])}>
                          + Borrador
                        </button>
                      </div>
                    </article>
                  );
                })}
              </>
            )}
            {tab === "routes" && (
              <>
                <div className="section-heading">
                  <h2>Biblioteca de rutas</h2>
                  <span>{visibleRoutes.length} superpuestas</span>
                </div>
                <p className="hint">
                  Marca varias rutas para compararlas. La elevación es la del
                  archivo, sin corrección automática.
                </p>
                {routes.map((r) => {
                  const color =
                    colors[
                      data.routes
                        .filter((x) => visibleRoutes.includes(x.id))
                        .indexOf(r) % colors.length
                    ] || colors[0];
                  return (
                    <article className="library-card" key={r.id}>
                      <div className="card-title">
                        <input
                          type="checkbox"
                          aria-label={`Mostrar ${r.name}`}
                          checked={visibleRoutes.includes(r.id)}
                          onChange={() =>
                            setVisibleRoutes((v) => toggle(v, r.id))
                          }
                        />
                        <h3>{r.name}</h3>
                      </div>
                      <Metrics tracks={r.tracks} />
                      <Profile tracks={r.tracks} color={color} />
                      <select
                        aria-label={`Ciclismo de ${r.name}`}
                        value={r.sport}
                        onChange={(e) =>
                          update((d) => ({
                            ...d,
                            routes: d.routes.map((x) =>
                              x.id === r.id
                                ? { ...x, sport: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      >
                        {["Sin clasificar", "Carretera", "Gravel", "MTB"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                      <div className="card-actions">
                        <button onClick={() => focusPoints(r.tracks.flat())}>
                          Centrar
                        </button>
                        <button onClick={() => routeSegments(r)}>
                          Crear segmentos
                        </button>
                        {r.original && (
                          <button
                            onClick={() => download(r.original, r.filename)}
                          >
                            Original GPX ↓
                          </button>
                        )}
                      </div>
                      {r.demo && (
                        <small>
                          Datos sintéticos de demostración, no una ruta
                          recomendada.
                        </small>
                      )}
                    </article>
                  );
                })}
                {!routes.length && (
                  <p className="empty">Importa tu primer archivo GPX.</p>
                )}
              </>
            )}
            {tab === "draft" && (
              <>
                <div className="section-heading">
                  <h2>Tu borrador libre</h2>
                  <span>Copias editables</span>
                </div>
                <input
                  aria-label="Nombre del proyecto"
                  value={data.draftName}
                  onChange={(e) =>
                    update((d) => ({ ...d, draftName: e.target.value }))
                  }
                />
                <p className="hint">
                  No es necesario conectar los tramos mientras editas. Pulsa
                  sobre una línea naranja para elegir un punto y arrástralo.
                </p>
                <div className="tools">
                  <button onClick={undo} disabled={!past.length}>
                    ↶ Deshacer
                  </button>
                  <button onClick={redo} disabled={!future.length}>
                    ↷ Rehacer
                  </button>
                  <button
                    className={drawing ? "primary" : ""}
                    onClick={() => (drawing ? setDrawing(false) : startDraw())}
                  >
                    {drawing ? "Terminar dibujo" : "+ Dibujar"}
                  </button>
                  <button disabled={!data.draft.length} onClick={saveProject}>
                    Guardar versión
                  </button>
                </div>
                {data.draft.map((e, i) => (
                  <article
                    className={`draft-card ${e.id === active ? "selected" : ""}`}
                    key={e.id}
                  >
                    <button
                      className="element-title"
                      onClick={() => {
                        setActive(e.id);
                        setPointIndex(0);
                        setDrawing(false);
                        focusPoints(e.points);
                      }}
                    >
                      {i + 1}. {e.name}
                    </button>
                    <Metrics tracks={[e.points]} />
                    <div className="card-actions">
                      <button
                        aria-label={`Subir ${e.name}`}
                        disabled={!i}
                        onClick={() => {
                          const next = [...data.draft];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          edit(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Bajar ${e.name}`}
                        disabled={i === data.draft.length - 1}
                        onClick={() => {
                          const next = [...data.draft];
                          [next[i], next[i + 1]] = [next[i + 1], next[i]];
                          edit(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() =>
                          edit(
                            data.draft.map((x) =>
                              x.id === e.id
                                ? { ...x, points: [...x.points].reverse() }
                                : x,
                            ),
                          )
                        }
                      >
                        Invertir
                      </button>
                      <button
                        onClick={() =>
                          edit([
                            ...data.draft,
                            {
                              ...clone(e),
                              id: uid(),
                              name: e.name + " · copia",
                            },
                          ])
                        }
                      >
                        Duplicar
                      </button>
                      <button
                        onClick={() => {
                          edit(data.draft.filter((x) => x.id !== e.id));
                          if (active === e.id) {
                            setActive(null);
                            setDrawing(false);
                          }
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  </article>
                ))}
                {activeElement && (
                  <section className="point-editor">
                    <h3>Editar tramo activo</h3>
                    <input
                      aria-label="Nombre del tramo"
                      value={activeElement.name}
                      onChange={(e) =>
                        changeElement((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                    <label>
                      Punto{" "}
                      <input
                        aria-label="Índice del punto"
                        type="number"
                        min="1"
                        max={activeElement.points.length || 1}
                        value={
                          Math.min(
                            pointIndex + 1,
                            activeElement.points.length,
                          ) || 1
                        }
                        onChange={(e) =>
                          setPointIndex(
                            Math.max(
                              0,
                              Math.min(
                                activeElement.points.length - 1,
                                Number(e.target.value) - 1,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="tools">
                      <button
                        disabled={activeElement.points.length < 2}
                        onClick={() => {
                          changeElement((e) => ({
                            ...e,
                            points: e.points.filter((_, i) => i !== pointIndex),
                          }));
                          setPointIndex(Math.max(0, pointIndex - 1));
                        }}
                      >
                        Eliminar punto
                      </button>
                      <button
                        disabled={
                          pointIndex <= 0 ||
                          pointIndex >= activeElement.points.length - 1
                        }
                        onClick={() => {
                          const i = data.draft.findIndex(
                            (e) => e.id === active,
                          );
                          edit([
                            ...data.draft.slice(0, i),
                            {
                              ...clone(activeElement),
                              points: clone(
                                activeElement.points.slice(0, pointIndex + 1),
                              ),
                            },
                            {
                              ...clone(activeElement),
                              id: uid(),
                              name: activeElement.name + " · parte 2",
                              points: clone(
                                activeElement.points.slice(pointIndex),
                              ),
                            },
                            ...data.draft.slice(i + 1),
                          ]);
                        }}
                      >
                        Dividir aquí
                      </button>
                      <button
                        disabled={pointIndex <= 0}
                        onClick={() => {
                          changeElement((e) => ({
                            ...e,
                            points: e.points.slice(pointIndex),
                          }));
                          setPointIndex(0);
                        }}
                      >
                        Recortar antes
                      </button>
                      <button
                        disabled={pointIndex >= activeElement.points.length - 1}
                        onClick={() =>
                          changeElement((e) => ({
                            ...e,
                            points: e.points.slice(0, pointIndex + 1),
                          }))
                        }
                      >
                        Recortar después
                      </button>
                      <button
                        disabled={activeElement.points.length < 2}
                        onClick={() => {
                          const segment = {
                            id: uid(),
                            name: activeElement.name,
                            points: clone(activeElement.points),
                            sourceId: activeElement.sourceId,
                            createdAt: new Date().toISOString(),
                          };
                          update((d) => ({
                            ...d,
                            segments: [...d.segments, segment],
                          }));
                          setNotice(
                            "Nuevo segmento guardado. La referencia original permanece intacta.",
                          );
                        }}
                      >
                        Guardar como nuevo segmento
                      </button>
                    </div>
                  </section>
                )}
                {!data.draft.length && (
                  <p className="empty">
                    Selecciona segmentos de la biblioteca o empieza a dibujar en
                    el mapa.
                  </p>
                )}
                <p className="hint">
                  El borrador se guarda automáticamente. «Guardar versión»
                  conserva además una copia independiente.
                </p>
              </>
            )}
            {tab === "projects" && (
              <>
                <h2>Proyectos y copias</h2>
                <p className="hint">
                  Todo se guarda en este navegador y en esta dirección local.
                  Exporta una copia para protegerlo frente al borrado de datos
                  del navegador.
                </p>
                <div className="tools">
                  <button
                    onClick={() =>
                      download(
                        JSON.stringify(data, null, 2),
                        "TudaGPX-copia.json",
                        "application/json",
                      )
                    }
                  >
                    Descargar copia completa
                  </button>
                  <button onClick={() => backupInput.current.click()}>
                    Añadir copia de seguridad
                  </button>
                </div>
                {[...data.projects].reverse().map((p) => (
                  <article className="library-card" key={p.id}>
                    <h3>{p.name}</h3>
                    <p className="hint">
                      {new Date(p.createdAt).toLocaleString("es-ES")} ·{" "}
                      {p.elements.length} tramos
                    </p>
                    <button onClick={() => loadProject(p)}>
                      Abrir esta versión
                    </button>
                  </article>
                ))}
                {!data.projects.length && (
                  <p className="empty">
                    Guarda una versión desde el borrador. También se admiten
                    proyectos incompletos.
                  </p>
                )}
              </>
            )}
          </div>
          <footer className="sidebar-footer">
            <button
              onClick={() =>
                focusPoints(
                  initialWorkspace().segments.flatMap((s) => s.points),
                )
              }
            >
              ⌖ Zona de demostración
            </button>
            <small>Originales protegidos · sin conexión a Supabase</small>
          </footer>
        </aside>
        <main className="map-area">
          <div className="map-toolbar">
            <div>
              <strong>
                {tab === "draft"
                  ? "Construye sin límites"
                  : "Explora. Selecciona. Conecta."}
              </strong>
              <span>Carretera · Gravel · MTB</span>
            </div>
            <button
              onClick={() => {
                setTab("draft");
                focusPoints(data.draft.flatMap((e) => e.points));
              }}
            >
              Ver borrador
            </button>
          </div>
          <WorkspaceMap
            data={data}
            visibleRoutes={visibleRoutes}
            selected={selected}
            hidden={hidden}
            hover={hover}
            onHover={setHover}
            onToggle={(id) => setSelected((s) => toggle(s, id))}
            onBounds={setBounds}
            bounds={bounds}
            drawing={drawing}
            onDraw={(p) => {
              edit(
                data.draft.map((e) =>
                  e.id === active ? { ...e, points: [...e.points, p] } : e,
                ),
              );
              setPointIndex(activeElement?.points.length || 0);
            }}
            focus={focus}
            active={active}
            pointIndex={Math.min(
              pointIndex,
              Math.max(0, (activeElement?.points.length || 1) - 1),
            )}
            onSelect={(id, index) => {
              if (!drawing) {
                setActive(id);
                setPointIndex(index);
                setTab("draft");
              }
            }}
            onMove={patchPoint}
            issues={issues}
          />
          <div className="bottom-bar">
            <div>
              <span className="eyebrow">BORRADOR ACTUAL</span>
              <strong>
                {data.draft.length} tramos <span>·</span>{" "}
                <Metrics tracks={data.draft.map((e) => e.points)} />
              </strong>
            </div>
            <button
              className="primary"
              onClick={() => {
                setDrawing(false);
                setIssues(review(data.draft));
                setAccept(false);
              }}
            >
              Revisar y exportar →
            </button>
          </div>
        </main>
      </div>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {issues !== null && (
        <div
          className="review-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Revisión GPX"
        >
          <div className="section-heading">
            <h2>Revisión antes de exportar</h2>
            <button
              aria-label="Cerrar revisión"
              onClick={() => setIssues(null)}
            >
              ×
            </button>
          </div>
          <p>
            No cambiamos tu trazado. Cada elemento se exporta como un tramo GPX
            separado, sin unir huecos.
          </p>
          {!issues.length ? (
            <p className="ok">Sin incidencias en las comprobaciones básicas.</p>
          ) : (
            <ul>
              {issues.map((issue, i) => (
                <li key={i}>
                  <span>
                    {issue.blocking ? "Error: " : "Aviso: "}
                    {issue.message}
                  </span>
                  {issue.point && (
                    <button onClick={() => focusPoints([issue.point])}>
                      Ver
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            Se comprueban coordenadas, huecos entre elementos (más de 30 m),
            elevaciones y aristas idénticas. El orden y sentido requieren tu
            revisión visual. No se detectan aún todos los solapamientos
            parciales.
          </p>
          {issues.some((i) => !i.blocking) && (
            <label className="accept">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
              />{" "}
              Acepto las advertencias y conservar los tramos separados.
            </label>
          )}
          <div className="tools">
            <button
              onClick={() => {
                setIssues(null);
                setTab("draft");
              }}
            >
              Volver al editor
            </button>
            <button
              className="primary"
              disabled={
                issues.some((i) => i.blocking) || (issues.length > 0 && !accept)
              }
              onClick={exportDraft}
            >
              Descargar GPX
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
