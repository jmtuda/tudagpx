import { useEffect, useRef, useState } from "react";
import { WorkspaceMap } from "./components/WorkspaceMap";
import {
  uid,
  parseGPX,
  initialWorkspace,
  review,
  exportGPX,
  validateWorkspace,
} from "./utils/workspace";
import { loadWorkspace, saveWorkspace, download } from "./utils/localStore";
import {
  cloudEnabled,
  loadCloudWorkspace,
  saveCloudWorkspace,
  stageCloudWorkspace,
} from "./utils/cloudStore";
import { readGPXFile, originalContent } from "./utils/gpxFiles";
import { splitTrace } from "./utils/editorGeometry";
import { routedEdit } from "./utils/routing";
import { editorRouteKey } from "./utils/editorRoutes";
import {
  mergeRoutePoints,
  orderedMergeElements,
  sameEndpoint,
} from "./utils/mergeRoutes";
import { ViewerLibrary } from "./components/ViewerLibrary";
import { viewerLibrary } from "./utils/viewerLibrary";
import { SegmentNameDialog } from "./components/SegmentNameDialog";
import { emptyRouteFilters } from "./utils/routeFilters";
import "./workspace.css";
import "./editor.css";
import "./workspaceNavigation.css";
import "./editorFiles.css";
import "./dockInterface.css";
const clone = (value) => structuredClone(value);
const toggle = (items, id) =>
  items.includes(id) ? items.filter((x) => x !== id) : [...items, id];

export default function LocalApp({ onLogout }) {
  const [workspace, setWorkspace] = useState("view");
  const [routeFilters, setRouteFilters] = useState({ ...emptyRouteFilters });
  function switchWorkspace(value) {
    cancelRouting();
    setDrawing(false);
    setIssues(null);
    setWorkspace(value);
  }
  const [routing, setRouting] = useState(
    () => localStorage.getItem("tudagpx-routing-mode-v3") !== "free",
  );
  // The owner explicitly authorized automatic BRouter calculation by default.
  const [routingConsent, setRoutingConsent] = useState(true);

  const [routingBusy, setRoutingBusy] = useState(false);
  const routingJob = useRef(null);
  function cancelRouting() {
    routingJob.current?.abort();
    routingJob.current = null;
    setRoutingBusy(false);
  }
  function changeRouting(value) {
    cancelRouting();
    setRouting(value);
    localStorage.setItem("tudagpx-routing-mode-v3", value ? "roads" : "free");
  }

  const [editorMode, setEditorMode] = useState("edit"),
    [crop, setCrop] = useState(null);
  const [data, setData] = useState(null),
    [fatal, setFatal] = useState(""),
    [saved, setSaved] = useState("Cargando…");
  const [tab, setTab] = useState("routes");
  const [visibleRoutes, setVisibleRoutes] = useState([]);
  const [bounds, setBounds] = useState(null),
    [focus, setFocus] = useState(null);
  const [active, setActive] = useState(null),
    [pointIndex, setPointIndex] = useState(0),
    [drawing, setDrawing] = useState(false);
  const [past, setPast] = useState([]),
    [mergeSelection, setMergeSelection] = useState([]),
    [future, setFuture] = useState([]),
    [issues, setIssues] = useState(null),
    [accept, setAccept] = useState(false);
  const [notification, setNotification] = useState(null);
  const notice = notification?.message || "";
  function setNotice(message) {
    setNotification(message ? { message } : null);
  }
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);
  const [segmentRequest, setSegmentRequest] = useState(null);
  const [routeRequest, setRouteRequest] = useState(null);
  const [outputRequest, setOutputRequest] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef(),
    backupInput = useRef(),
    queue = useRef(Promise.resolve()),
    revision = useRef(0);
  useEffect(() => {
    let alive = true;
    (cloudEnabled ? loadCloudWorkspace() : loadWorkspace())
      .then((value) => {
        if (alive) {
          setData(value ? validateWorkspace(value) : initialWorkspace());
          setSaved("Guardado local");
        }
      })
      .catch(() => {
        if (alive)
          setFatal(
            cloudEnabled
              ? "No se ha podido abrir tu biblioteca privada en Neon. No se ha sobrescrito ningún dato. Comprueba la conexión y vuelve a cargar."
              : "No se ha podido abrir el almacenamiento local. No se ha sobrescrito ningún dato. Comprueba que este navegador permite IndexedDB y vuelve a cargar.",
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
      .then(async () => {
        await saveWorkspace(data);
        if (cloudEnabled) await stageCloudWorkspace(data);
        if (cloudEnabled && revision.current === rev)
          setSaved("Guardado local · pendiente de Neon");
      });
    queue.current
      .then(() => (cloudEnabled ? saveCloudWorkspace(data) : undefined))
      .then(() => {
        if (revision.current === rev)
          setSaved(
            cloudEnabled ? "Guardado en Neon" : "Guardado en este navegador",
          );
      })
      .catch((error) => {
        setSaved(
          cloudEnabled
            ? `No guardado en Neon: ${error.message} Descarga una copia.`
            : "Error de guardado: descarga una copia de seguridad",
        );
      });
  }, [data]);
  function update(fn) {
    cancelRouting();
    revision.current++;
    setSaved("Guardando…");
    setData((d) => fn(d));
  }
  function renameItem(collection, item) {
    const value = window.prompt("Nuevo nombre", item.name);
    if (value === null) return;
    const name = value.trim();
    if (!name) {
      setNotice("El nombre no puede estar vacío.");
      return;
    }
    update((d) => ({
      ...d,
      [collection]: d[collection].map((entry) =>
        entry.id === item.id ? { ...entry, name } : entry,
      ),
    }));
    setNotice("Nombre actualizado. El GPX original no se ha modificado.");
  }
  function deleteItem(collection, item) {
    if (
      !window.confirm(
        `¿Borrar «${item.name}» de la biblioteca? Las copias abiertas en el editor se conservarán.`,
      )
    )
      return;
    // Logical deletion preserves original bytes and historical cloud revisions.
    update((d) => ({
      ...d,
      [collection]: d[collection].map((entry) =>
        entry.id === item.id
          ? { ...entry, deletedAt: new Date().toISOString() }
          : entry,
      ),
    }));
    setVisibleRoutes((ids) => ids.filter((id) => id !== item.id));
    setNotice(
      "Elemento borrado de la biblioteca. Las copias abiertas y el historial se conservan.",
    );
  }
  function requestOutput(kind, elements, name, execute, alwaysReview = false) {
    cancelRouting();
    const findings = review(elements);
    try {
      const xml = exportGPX(elements, name);
      const parsed = parseGPX(xml);
      if (
        parsed.tracks.length !== elements.length ||
        parsed.tracks.some(
          (track, i) => track.length !== elements[i].points.length,
        )
      )
        throw new Error(
          "El GPX generado no conserva todos los tramos y puntos.",
        );
    } catch (error) {
      findings.push({ blocking: true, message: error.message });
    }
    const relevant =
      kind === "export" ? findings : findings.filter((issue) => issue.blocking);
    if (relevant.length || alwaysReview) {
      setDrawing(false);
      setOutputRequest({ kind, execute });
      setIssues(relevant);
      setAccept(false);
    } else execute();
  }
  function edit(next) {
    setMergeSelection([]);
    setPast((p) => [...p, clone(data.draft)].slice(-80));
    setFuture([]);
    update((d) => ({
      ...d,
      draft: typeof next === "function" ? next(d.draft) : next,
    }));
    setIssues(null);
    setCrop(null);
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [clone(data.draft), ...f]);
    update((d) => ({ ...d, draft: past.at(-1) }));
    setPast((p) => p.slice(0, -1));
    setDrawing(false);
    setIssues(null);
    setCrop(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, clone(data.draft)]);
    update((d) => ({ ...d, draft: future[0] }));
    setFuture((f) => f.slice(1));
    setDrawing(false);
    setIssues(null);
    setCrop(null);
  }

  function focusPoints(points) {
    setFocus({ id: uid(), points });
  }
  async function importFiles(event) {
    const files = [...event.target.files];
    event.target.value = "";
    await importRouteFiles(files);
  }
  async function importRouteFiles(files, editorOnly = false) {
    if (importing) return;
    if (!files.length) return;
    setImporting(true);
    const routes = [],
      errors = [];
    for (const file of files) {
      try {
        if (file.size > 25 * 1024 * 1024)
          throw new Error("El límite por archivo es 25 MB.");
        routes.push(await readGPXFile(file));
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }
    if (routes.length) {
      if (editorOnly) {
        const copies = routes.flatMap((route) => editorCopies(route, false));
        edit((draft) => [...draft, ...copies]);
        selectElement(copies[0].id);
        setTool("edit");
      } else {
        update((d) => ({ ...d, routes: [...d.routes, ...routes] }));
        setVisibleRoutes((v) => [...v, ...routes.map((r) => r.id)]);
        setTab("routes");
        switchWorkspace("view");
      }
      focusPoints(routes.flatMap((r) => r.tracks.flat()));
    }
    setNotice(
      `${editorOnly ? `${routes.length} GPX abiertos solo en el editor; no se han añadido a la biblioteca.` : `${routes.length} GPX importados; originales conservados.`}${errors.length ? " " + errors.join(" ") : ""}`,
    );
    setImporting(false);
  }

  function startDraw() {
    switchWorkspace("edit");
    const e = {
      id: uid(),
      name: `Trazado libre ${data.draft.length + 1}`,
      points: [],
    };
    edit([...data.draft, e]);
    setActive(e.id);
    setPointIndex(0);
    setDrawing(true);
    setEditorMode("edit");
  }
  function changeElement(fn) {
    edit(data.draft.map((e) => (e.id === active ? fn(clone(e)) : e)));
  }
  function selectElement(id, index = 0) {
    cancelRouting();
    const element = data.draft.find((e) => e.id === id);
    setMergeSelection(element ? [editorRouteKey(element)] : []);
    if (id !== active) {
      setEditorMode("edit");
      setCrop(null);
      setIssues(null);
    }
    if (workspace !== "edit") switchWorkspace("edit");
    setActive(id);
    setPointIndex(index);
  }
  function setTool(mode) {
    cancelRouting();
    setEditorMode(mode);
    setDrawing(false);
    setCrop(null);
  }
  function selectedEditorKeys() {
    const keys = new Set(data.draft.map(editorRouteKey));
    return mergeSelection.filter((key) => keys.has(key));
  }
  function selectEditorFile(id, additive = false) {
    const element = data.draft.find((e) => e.id === id);
    if (!element) return;
    const key = editorRouteKey(element);
    const previous = selectedEditorKeys();
    selectElement(id);
    setTool(additive ? "view" : "edit");
    setMergeSelection(additive ? toggle(previous, key) : [key]);
    if (!additive) focusPoints(element.points);
  }
  async function mergeEditorRoutes() {
    if (routingJob.current) return;
    const keys = selectedEditorKeys();
    if (keys.length < 2) return;
    const elements = orderedMergeElements(data.draft, keys);
    if (elements.some((e) => e.points.length < 2)) {
      setNotice(
        "Todos los trazados seleccionados deben tener al menos dos puntos.",
      );
      return;
    }
    const needsRoads = elements
      .slice(1)
      .some((e, i) => !sameEndpoint(elements[i].points.at(-1), e.points[0]));
    if (needsRoads && !routingConsent) {
      setNotice(
        "Para conectar los huecos por el camino más corto, activa Seguir caminos en Editar trazado: solo se enviarán sus extremos a BRouter. Después pulsa Unir trazados.",
      );
      return;
    }
    const controller = new AbortController();
    routingJob.current = controller;
    setRoutingBusy(true);
    setEditorMode("view");
    setDrawing(false);
    try {
      const points = await mergeRoutePoints(elements, controller.signal);
      if (controller.signal.aborted || routingJob.current !== controller)
        return;
      const name = elements[0].editorRouteName || elements[0].name;
      const merged = {
        id: uid(),
        editorRouteId: uid(),
        editorRouteName: name,
        name,
        points,
      };
      const remaining = data.draft.filter(
        (e) => !keys.includes(editorRouteKey(e)),
      );
      const insertion = data.draft
        .slice(0, data.draft.indexOf(elements[0]))
        .filter((e) => !keys.includes(editorRouteKey(e))).length;
      remaining.splice(insertion, 0, merged);
      edit(remaining);
      selectElement(merged.id);
      setTool("view");
      focusPoints(points);
      setNotice(
        "Trazados fusionados en el orden de selección. Puedes deshacer; los originales no cambian.",
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(`No se ha unido ningún trazado: ${error.message}`);
    } finally {
      if (routingJob.current === controller) {
        routingJob.current = null;
        setRoutingBusy(false);
      }
    }
  }
  function editorCopies(route, linked = true) {
    const editorRouteId = uid();
    return route.tracks.map((points, i) => ({
      id: uid(),
      name: route.name + (route.tracks.length > 1 ? ` · tramo ${i + 1}` : ""),
      points: clone(points),
      ...(linked
        ? route.kind === "segment"
          ? { sourceId: route.id }
          : { sourceRouteId: route.id }
        : {}),
      editorRouteId,
      editorRouteName: route.name,
    }));
  }
  function editRoute(route) {
    const copies = editorCopies(route);
    edit([...data.draft, ...copies]);
    selectElement(copies[0].id);
    setTool("edit");
    focusPoints(copies.flatMap((e) => e.points));
    setNotice("Editas una copia. El GPX original permanece intacto.");
  }
  function closeEditorRoute(id) {
    const remaining = data.draft.filter(
      (e) => (e.editorRouteId || e.id) !== id,
    );
    edit(remaining);

    setDrawing(false);
    setEditorMode("view");
    if (!remaining.some((e) => e.id === active)) {
      setActive(remaining[0]?.id || null);
      setPointIndex(0);
    }
    setNotice(
      "Ruta cerrada del editor. El original se conserva; puedes deshacer el cierre.",
    );
  }
  function clearEditor() {
    edit([]);
    setActive(null);
    setPointIndex(0);
    setDrawing(false);
    setEditorMode("view");
    setNotice(
      "Mapa limpio. Las rutas y segmentos guardados se conservan en la biblioteca. Puedes deshacer la limpieza.",
    );
  }
  async function routeChange(id, index, point, action, neighbors) {
    if (routingJob.current) return;
    if (!routingConsent) {
      setNotice(
        "Antes de seguir caminos, permite el cálculo con BRouter en las opciones del lápiz, o elige modo libre. No se ha modificado el trazado.",
      );
      return;
    }
    const element = data.draft.find((e) => e.id === id);
    if (!element) return;
    const controller = new AbortController();
    routingJob.current = controller;
    setRoutingBusy(true);
    try {
      const points = await routedEdit(
        element.points,
        index,
        point,
        action,
        neighbors,
        "all-paths",
        controller.signal,
      );
      if (controller.signal.aborted || routingJob.current !== controller)
        return;
      edit(data.draft.map((e) => (e.id === id ? { ...e, points } : e)));
      const target = point || points[Math.min(index, points.length - 1)];
      let selectedIndex = 0;
      points.forEach((p, i) => {
        if (
          Math.hypot(p.lat - target.lat, p.lon - target.lon) <
          Math.hypot(
            points[selectedIndex].lat - target.lat,
            points[selectedIndex].lon - target.lon,
          )
        )
          selectedIndex = i;
      });
      selectElement(id, selectedIndex);
      setNotice(
        "Tramo calculado siguiendo caminos. Puedes deshacer; el original no cambia.",
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(
          `${error.name === "TimeoutError" ? "El cálculo ha tardado demasiado." : error.message} El trazado anterior se conserva; no se ha sustituido por una recta.`,
        );
    } finally {
      if (routingJob.current === controller) {
        routingJob.current = null;
        setRoutingBusy(false);
      }
    }
  }
  function movePoint(id, index, point, neighbors) {
    if (routing && data.draft.find((e) => e.id === id)?.points.length > 1)
      return routeChange(id, index, point, "move", neighbors);
    edit(
      data.draft.map((e) =>
        e.id === id
          ? { ...e, points: e.points.map((p, i) => (i === index ? point : p)) }
          : e,
      ),
    );
    selectElement(id, index);
  }
  function insertPoint(id, index, point, neighbors) {
    if (routing) return routeChange(id, index, point, "insert", neighbors);
    edit(
      data.draft.map((e) =>
        e.id === id
          ? {
              ...e,
              points: [
                ...e.points.slice(0, index),
                point,
                ...e.points.slice(index),
              ],
            }
          : e,
      ),
    );
    selectElement(id, index);
  }
  function splitElement(id, index, point = null) {
    const position = data.draft.findIndex((e) => e.id === id),
      element = data.draft[position];
    if (!element) return;
    const parts = splitTrace(element.points, index, point);
    if (!parts) {
      setNotice("Elige un lugar intermedio del trazado para dividirlo.");
      return;
    }
    const secondId = uid();
    const secondName = element.name + " · parte 2";
    edit([
      ...data.draft.slice(0, position),
      { ...clone(element), points: parts[0] },
      {
        ...clone(element),
        id: secondId,
        name: secondName,
        editorRouteId: uid(),
        editorRouteName: secondName,
        points: parts[1],
      },
      ...data.draft.slice(position + 1),
    ]);
    selectElement(secondId, 0);
    setEditorMode("edit");
    setDrawing(false);
    setNotice(
      "Corte realizado: la segunda parte es una ruta independiente. Puedes guardarla como ruta o segmento, o cerrarla. El original no cambia.",
    );
  }
  function pointAction(action, id, index, neighbors) {
    const element = data.draft.find((e) => e.id === id);
    if (!element) return;
    selectElement(id, index);
    if (action === "delete") {
      if (element.points.length < 2) return;
      if (routing && index > 0 && index < element.points.length - 1)
        return routeChange(id, index, null, "delete", neighbors);
      edit(
        data.draft.map((e) =>
          e.id === id
            ? { ...e, points: e.points.filter((_, i) => i !== index) }
            : e,
        ),
      );
      setPointIndex(Math.max(0, index - 1));
    } else {
      const previous =
        crop?.id === id ? crop : { start: 0, end: element.points.length - 1 };
      const range =
        action === "crop-start"
          ? {
              start: Math.min(index, element.points.length - 2),
              end: Math.max(previous.end, index + 1),
            }
          : {
              start: Math.min(previous.start, index - 1),
              end: Math.max(1, index),
            };
      setCrop({ id, ...range });
      setEditorMode("crop");
      setDrawing(false);
    }
  }
  function commitSegments(segments, select = false) {
    const snapshot = clone(segments);
    requestOutput("segment", snapshot, snapshot[0]?.name || "Segmento", () =>
      commitSegmentsUnchecked(snapshot, select),
    );
  }
  function commitSegmentsUnchecked(segments, select = false) {
    update((data) => ({ ...data, segments: [...data.segments, ...segments] }));
    if (select) {
      setVisibleRoutes((previous) => [
        ...previous,
        ...segments.map((segment) => segment.id),
      ]);
      setTab("segments");
    }
    setNotice(
      segments.length === 1
        ? `Segmento «${segments[0].name}» guardado. Los originales y el borrador se conservan.`
        : `${segments.length} segmentos guardados. Los originales y el borrador se conservan.`,
    );
  }
  function saveSegment(points, name) {
    const element = data.draft.find((e) => e.id === active);
    const segment = {
      id: uid(),
      name,
      points: clone(points),
      sourceId: element?.sourceId,
      sourceRouteId: element?.sourceRouteId,
      createdAt: new Date().toISOString(),
    };
    requestOutput("segment", [segment], name, () =>
      setSegmentRequest({ segments: [segment], select: false }),
    );
  }
  function saveEditorRoute() {
    const element = data.draft.find((e) => e.id === active);
    if (!element) return;
    const key = element.editorRouteId || element.id;
    const elements = data.draft.filter(
      (e) => (e.editorRouteId || e.id) === key,
    );
    const snapshot = clone(elements);
    const name = element.editorRouteName || element.name;
    requestOutput("route", snapshot, name, () =>
      setRouteRequest({ elements: snapshot, name }),
    );
  }
  async function commitRoute(name) {
    try {
      const xml = exportGPX(routeRequest.elements, name);
      const route = await readGPXFile(
        new File([xml], `${name}.gpx`, { type: "application/gpx+xml" }),
      );
      update((d) => ({ ...d, routes: [...d.routes, route] }));
      setRouteRequest(null);
      setNotice(
        `Ruta «${name}» guardada. El original y las copias del editor se conservan.`,
      );
    } catch (error) {
      setNotice(`No se pudo guardar la ruta: ${error.message}`);
    }
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
      const editorIds = new Map();
      const copy = (e) => {
        if (e.editorRouteId && !editorIds.has(e.editorRouteId))
          editorIds.set(e.editorRouteId, uid());
        return {
          ...clone(e),
          id: uid(),
          sourceId: idMap.get(e.sourceId) || e.sourceId,
          sourceRouteId: idMap.get(e.sourceRouteId) || e.sourceRouteId,
          editorRouteId: editorIds.get(e.editorRouteId),
        };
      };
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
      const restored = source.draft.map(copy);
      if (restored.length) edit([...data.draft, ...restored]);
      update((d) => ({
        ...d,
        routes: [...d.routes, ...routes],
        segments: [...d.segments, ...segments],
        projects: [...d.projects, ...projects],
      }));
      setNotice(
        "Copia añadida sin borrar ni reemplazar datos actuales. Los trazados recuperados están abiertos en el editor.",
      );
      if (restored.length) {
        switchWorkspace("edit");
        selectElement(restored[0].id);
        focusPoints(restored.flatMap((element) => element.points));
      }
      setTab("routes");
    } catch (e) {
      setNotice(`No se ha importado la copia: ${e.message}`);
    }
  }
  useEffect(() => {
    if (workspace !== "edit" || !data) return;
    if (!data.draft.some((e) => e.id === active)) {
      setActive(data.draft[0]?.id || null);
      setPointIndex(0);
    }
  }, [data, workspace, active]);
  if (fatal)
    return (
      <main className="startup">
        <h1>TudaGPX</h1>
        <p role="alert">{fatal}</p>
      </main>
    );
  if (!data) return <main className="startup">Abriendo TudaGPX…</main>;
  const activeElement = data.draft.find((e) => e.id === active);
  const catalog = {
    ...data,
    routes: data.routes.filter((r) => !r.deletedAt),
    segments: data.segments.filter((s) => !s.deletedAt),
  };

  const libraryItems = viewerLibrary(catalog);
  const cropRange =
    crop?.id === active
      ? crop
      : { start: 0, end: Math.max(0, (activeElement?.points.length || 1) - 1) };
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
    <div
      className={`local-app dock-interface ${workspace === "view" ? "viewer-library-fixed" : "editor-full-map panel-hidden"}`}
    >
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
        <nav
          className="workspace-tabs"
          role="tablist"
          aria-label="Espacio de trabajo"
        >
          {[
            ["view", "Ver rutas"],
            ["edit", "Editar"],
          ].map(([value, label]) => (
            <button
              key={value}
              role="tab"
              id={`workspace-tab-${value}`}
              aria-selected={workspace === value}
              aria-controls="workspace-panel"
              tabIndex={workspace === value ? 0 : -1}
              onClick={() => switchWorkspace(value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = value === "view" ? "edit" : "view";
                  switchWorkspace(next);
                  document.getElementById(`workspace-tab-${next}`).focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="local-status">
          <i />{" "}
          {cloudEnabled
            ? "Neon · privado"
            : routing && routingConsent
              ? "Datos locales · cálculo externo"
              : "Solo local · privado"}{" "}
          <span>{saved}</span>
        </div>
        {onLogout && (
          <button onClick={onLogout} title="Cerrar sesión privada">
            Salir
          </button>
        )}
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
      <div
        className="workbench"
        id="workspace-panel"
        role="tabpanel"
        aria-labelledby={`workspace-tab-${workspace}`}
      >
        {workspace === "view" && (
          <ViewerLibrary
            items={libraryItems}
            tab={tab}
            onTab={setTab}
            filters={routeFilters}
            onFilters={setRouteFilters}
            bounds={bounds}
            visible={visibleRoutes}
            onToggle={(id) => setVisibleRoutes((ids) => toggle(ids, id))}
            onSend={editRoute}
            onRename={(item) =>
              renameItem(item.kind === "segment" ? "segments" : "routes", item)
            }
            onDelete={(item) =>
              deleteItem(item.kind === "segment" ? "segments" : "routes", item)
            }
            onDownload={(item) =>
              item.kind === "segment"
                ? requestOutput(
                    "export",
                    [{ points: item.points, name: item.name }],
                    item.name,
                    () =>
                      download(
                        exportGPX(
                          [{ points: item.points, name: item.name }],
                          item.name,
                        ),
                        `${item.name}.gpx`,
                      ),
                  )
                : download(originalContent(item), item.filename)
            }
            onBackup={() =>
              download(
                JSON.stringify(data, null, 2),
                "TudaGPX-copia.json",
                "application/json",
              )
            }
            onRestore={() => backupInput.current.click()}
          />
        )}
        <main className="map-area">
          <WorkspaceMap
            data={catalog}
            onSendRoute={editRoute}
            viewing={workspace === "view"}
            visibleRoutes={visibleRoutes}
            onToggleRoute={(id) =>
              setVisibleRoutes((routes) => toggle(routes, id))
            }
            onDropFiles={(files) =>
              importRouteFiles(files, workspace === "edit")
            }
            importing={importing}
            onCenterSelection={() =>
              focusPoints(
                libraryItems
                  .filter((item) => visibleRoutes.includes(item.id))
                  .flatMap((item) => item.tracks.flat()),
              )
            }
            onBounds={setBounds}
            bounds={bounds}
            drawing={drawing}
            onDraw={(p) => {
              if (!activeElement) {
                const e = {
                  id: uid(),
                  name: `Trazado libre ${data.draft.length + 1}`,
                  points: [p],
                };
                edit([...data.draft, e]);
                selectElement(e.id);
                return;
              }
              if (routing && activeElement.points.length) {
                routeChange(active, activeElement.points.length, p, "append");
                return;
              }
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
            onSelect={selectElement}
            onMove={movePoint}
            editing={workspace === "edit" && issues === null}

            routingBusy={routingBusy}
            mode={editorMode}
            crop={cropRange}
            onInsert={insertPoint}
            onPointAction={pointAction}
            onSplit={splitElement}
            tools={{
              routing,
              onRouting: changeRouting,
              routingConsent,
              onConsent: () => setRoutingConsent(true),
              onRevokeConsent: () => {
                cancelRouting();
                setRoutingConsent(false);
              },

              routingBusy,
              onCancelRouting: cancelRouting,
              elements: data.draft,
              active,
              drawing,
              onOpen: () => {
                switchWorkspace("edit");
                const element = activeElement || data.draft[0];
                if (element) selectElement(element.id);

                setIssues(null);
                setTool("edit");
                focusPoints(element?.points || []);
              },
              onMode: setTool,
              mergeSelection: selectedEditorKeys(),
              onSelectFile: selectEditorFile,
              onMerge: mergeEditorRoutes,
              onCloseRoute: closeEditorRoute,
              onActive: (id) => {
                selectElement(id);
                setTool("edit");
                focusPoints(data.draft.find((e) => e.id === id)?.points || []);
              },
              onName: (name) =>
                changeElement((element) => ({ ...element, name })),
              onNew: startDraw,
              onClear: clearEditor,
              canClear: data.draft.length > 0,
              onFinish: () => setTool("view"),
              onExit: () => {
                switchWorkspace("view");
              },
              onUndo: undo,
              onRedo: redo,
              canUndo: !!past.length,
              canRedo: !!future.length,
              onRange: (range) => setCrop({ id: active, ...range }),
              onCrop: () => {
                changeElement((e) => ({
                  ...e,
                  points: e.points.slice(cropRange.start, cropRange.end + 1),
                }));
                setEditorMode("edit");
                setPointIndex(0);
              },
              onSaveSelection: () =>
                saveSegment(
                  activeElement.points.slice(
                    cropRange.start,
                    cropRange.end + 1,
                  ),
                  `${activeElement.name} · segmento`,
                ),
              onSaveSegment: () =>
                activeElement &&
                saveSegment(activeElement.points, activeElement.name),
              onSaveRoute: saveEditorRoute,
              onExport: () =>
                requestOutput(
                  "export",
                  clone(data.draft),
                  data.draftName,
                  exportDraft,
                  true,
                ),
              onReverse: () =>
                changeElement((e) => ({
                  ...e,
                  points: [...e.points].reverse(),
                })),
              onCenter: () => focusPoints(activeElement?.points || []),
            }}
            issues={issues}
          />
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
      {routeRequest && (
        <SegmentNameDialog
          kind="route"
          segments={[{ id: "new-route", name: routeRequest.name }]}
          onCancel={() => setRouteRequest(null)}
          onSave={(entries) => commitRoute(entries[0].name)}
        />
      )}
      {segmentRequest && (
        <SegmentNameDialog
          segments={segmentRequest.segments}
          onCancel={() => setSegmentRequest(null)}
          onSave={(segments) => {
            commitSegments(segments, segmentRequest.select);
            setSegmentRequest(null);
          }}
        />
      )}
      {issues !== null && (
        <div
          className="review-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Revisión GPX"
        >
          <div className="section-heading">
            <h2>
              Revisión antes de{" "}
              {outputRequest?.kind === "export" ? "exportar" : "guardar"}
            </h2>
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
              }}
            >
              Volver al editor
            </button>
            <button
              className="primary"
              disabled={
                issues.some((i) => i.blocking) || (issues.length > 0 && !accept)
              }
              onClick={() => {
                const execute = outputRequest?.execute;
                setIssues(null);
                setOutputRequest(null);
                execute?.();
              }}
            >
              {outputRequest?.kind === "route"
                ? "Guardar ruta revisada"
                : outputRequest?.kind === "segment"
                  ? "Guardar segmento revisado"
                  : "Descargar GPX"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
