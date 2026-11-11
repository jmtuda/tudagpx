import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { sendLibraryItem, confirmRouteSave, showLibrary } from "./helpers/library.js";

async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText("Guardado en este navegador");
  return page.evaluate(async () => (await import("/src/utils/localStore.js")).loadWorkspace());
}
async function seed(page, multitrack = false) {
  await page.goto("/");
  await state(page);
  await page.evaluate(async (multi) => {
    const { readGPXFile } = await import("/src/utils/gpxFiles.js");
    const store = await import("/src/utils/localStore.js");
    const data = await store.loadWorkspace();
    const xml = `<gpx version="1.1" creator="synthetic test" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="40.752" lon="-3.985"><name>Fuente</name><desc>Agua &amp; sombra</desc></wpt><trk><name>Ruta con waypoints</name><desc>Descripción original ⛰️</desc><trkseg><trkpt lat="40.752" lon="-3.99"><ele>900</ele></trkpt><trkpt lat="40.752" lon="-3.985"><ele>920</ele></trkpt><trkpt lat="40.752" lon="-3.98"><ele>950</ele></trkpt></trkseg>${multi ? '<trkseg><trkpt lat="40.752" lon="-3.98"><ele>950</ele></trkpt><trkpt lat="40.755" lon="-3.975"><ele>970</ele></trkpt></trkseg>' : ""}</trk></gpx>`;
    data.routes = [await readGPXFile(new File([xml], "anotada.gpx"))];
    data.segments = [];
    data.draft = [];
    localStorage.setItem("tudagpx-routing-mode-v3", "free");
    await store.saveWorkspace(data);
  }, multitrack);
  await page.reload();
  return state(page);
}
async function openWaypoint(page, name) {
  const close = page.locator(".leaflet-popup-close-button");
  if (await close.count()) await close.click();
  await page.locator(`.waypoint-marker[title="${name}"]`).click();
}
async function addWaypoint(page, name, description) {
  const button = page.getByRole("button", { name: "Añadir waypoint", exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await page.locator(".workspace-map").click({ position: { x: 130, y: 145 } });
  const dialog = page.getByRole("dialog", { name: "Añadir waypoint", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nombre (opcional)").fill(name);
  await dialog.getByLabel("Descripción", { exact: true }).fill(description);
  await dialog.getByRole("button", { name: "Guardar waypoint" }).click();
  await expect(dialog).toHaveCount(0);
  return state(page);
}
for (const width of [1440, 390]) {
  test(`añadir, editar, deshacer y borrar waypoints con descripción sin alterar originales ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const initial = await seed(page);
    await sendLibraryItem(page, "route");
    const copied = await state(page);
    expect(copied.draft[0].waypoints[0].id).not.toBe(initial.routes[0].waypoints[0].id);
    const beforePoints = copied.draft[0].points;
    const added = await addWaypoint(page, "Mirador ⛰️", "Vistas <sin HTML> & descanso\nSegunda línea");
    expect(added.draft[0].points).toEqual(beforePoints);
    expect(added.routes).toEqual(initial.routes);
    expect(added.draft[0].waypoints).toHaveLength(2);
    const created = added.draft[0].waypoints[1];
    expect(created.ele).toBeNull();
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    expect((await state(page)).draft[0].waypoints).toHaveLength(1);
    await page.getByRole("button", { name: "↷ Rehacer", exact: true }).click();
    expect((await state(page)).draft[0].waypoints[1]).toEqual(created);
    await openWaypoint(page, "Mirador ⛰️");
    await expect(page.locator(".waypoint-popup p")).toHaveText(created.description);
    await page.getByRole("button", { name: "Editar waypoint", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Editar waypoint", exact: true });

    await dialog.getByLabel("Descripción", { exact: true }).fill("Descripción editada");
    await dialog.getByRole("button", { name: "Guardar waypoint" }).click();
    const edited = await state(page);
    expect(edited.draft[0].waypoints[1]).toEqual({ ...created, description: "Descripción editada" });
    await page.screenshot({ path: info.outputPath("editor-waypoints.png") });
    await openWaypoint(page, "Mirador ⛰️");
    await page.getByRole("button", { name: "Editar waypoint", exact: true }).click();
    page.once("dialog", (confirmation) => confirmation.dismiss());
    await dialog.getByRole("button", { name: "Borrar waypoint" }).click();
    await expect(dialog).toBeVisible();
    expect((await state(page)).draft[0].waypoints).toHaveLength(2);
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "Borrar waypoint" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await state(page)).draft[0].waypoints).toHaveLength(1);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    const final = await state(page);
    expect(final.routes).toEqual(initial.routes);
    expect(final.draft[0].points).toEqual(beforePoints);
    expect(final.draft[0].waypoints).toEqual(edited.draft[0].waypoints);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Ver rutas", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    expect((await state(page)).draft).toEqual(final.draft);
    await expect(page.locator(".waypoint-marker")).toHaveCount(2);
  });
}
test("cancelar y exigir descripción; colocar en la línea no inserta puntos ni llama a BRouter", async ({ page }) => {
  await seed(page);
  await sendLibraryItem(page, "route");
  const before = await state(page);
  let routingCalls = 0;
  page.on("request", (request) => { if (request.url().includes("brouter")) routingCalls++; });
  await page.getByRole("button", { name: "Añadir waypoint", exact: true }).click();
  const path = page.locator("path.draft-line").first();
  const box = await path.boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  const dialog = page.getByRole("dialog", { name: "Añadir waypoint", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar waypoint" }).click();
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel("Descripción", { exact: true }).evaluate((node) => node.validity.valueMissing)).toBe(true);
  await dialog.getByLabel("Descripción", { exact: true }).fill("   ");
  await dialog.getByRole("button", { name: "Guardar waypoint" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Escribe una descripción");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect((await state(page)).draft).toEqual(before.draft);
  expect(routingCalls).toBe(0);
  await expect(page.locator(".waypoint-marker")).toHaveCount(1);
});
test("waypoints de archivo multitramos se guardan una vez en ruta y segmento desde tramo no canónico", async ({ page }) => {
  const original = await seed(page, true);
  await sendLibraryItem(page, "route");
  const copied = await state(page);
  expect(copied.draft).toHaveLength(2);
  // Select the second trace without changing file identity.
  await page.locator("path.draft-line").nth(1).click({ force: true });
  await addWaypoint(page, "Refugio", "Entrada al refugio");
  const withWaypoint = await state(page);
  expect(withWaypoint.draft.flatMap((element) => element.waypoints || [])).toHaveLength(2);
  await page.getByRole("button", { name: "Guardar ruta", exact: true }).click();
  await confirmRouteSave(page);
  const saved = await state(page);
  expect(saved.routes).toHaveLength(2);
  expect(saved.routes[1].tracks).toEqual(original.routes[0].tracks);
  expect(saved.routes[1].waypoints).toHaveLength(2);
  expect(saved.routes[1].description).toBe(original.routes[0].description);
  expect(saved.routes[1].completed).toBe(false);
  await page.getByRole("button", { name: "Guardar segmento", exact: true }).click();
  const segmentDialog = page.getByRole("dialog", { name: "Guardar segmento", exact: true });
  await segmentDialog.getByRole("button", { name: "Guardar segmento", exact: true }).click();
  const withSegment = await state(page);
  expect(withSegment.segments[0].points).toEqual(original.routes[0].tracks[1]);
  expect(withSegment.segments[0].waypoints).toHaveLength(2);
  await showLibrary(page, "route");
  await page.getByRole("link", { name: saved.routes[1].name, exact: true }).last().click();
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
  await expect(page.locator(".waypoint-marker")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Waypoints del recorrido" })).toContainText("Entrada al refugio");
  await page.locator('.waypoint-marker[title="Fuente"]').click();
  await expect(page.getByRole("button", { name: "Editar waypoint", exact: true })).toHaveCount(0);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar GPX", exact: true }).click();
  const downloaded = await pending;
  const xml = await readFile(await downloaded.path(), "utf8");
  const parsed = await page.evaluate(async (text) => (await import("/src/utils/workspace.js")).parseGPX(text), xml);
  expect(parsed.tracks).toEqual(original.routes[0].tracks);
  expect(parsed.waypoints).toHaveLength(2);
  expect(parsed.waypoints.map((point) => point.description)).toEqual(["Agua & sombra", "Entrada al refugio"]);
  expect((await state(page)).routes[0]).toEqual(original.routes[0]);
});

test("exportación conserva IDs coincidentes de archivos independientes y deduplica sólo dentro del archivo", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { exportGPX, parseGPX } = await import("/src/utils/workspace.js");
    const { collectWaypoints } = await import("/src/utils/waypoints.js");
    const points = [{ lat: 40, lon: -3, ele: null }, { lat: 41, lon: -3, ele: null }];
    const a = { id: "same-wpt-id", lat: 40, lon: -3, name: "A", description: "Uno" };
    const b = { ...a, name: "B", description: "Otro archivo" };
    const elements = [{ id: "a1", editorRouteId: "file-a", points, waypoints: [a] }, { id: "a2", editorRouteId: "file-a", points, waypoints: [a] }, { id: "b1", editorRouteId: "file-b", points, waypoints: [b] }];
    return { count: collectWaypoints(elements).length, parsed: parseGPX(exportGPX(elements, "Prueba")) };
  });
  expect(result.count).toBe(2);
  expect(result.parsed.waypoints.map((point) => point.name)).toEqual(["A", "B"]);
});

test("recortar, dividir, unir y restaurar JSON conserva anotaciones y remapea copias", async ({ page }) => {
  const initial = await seed(page);
  await sendLibraryItem(page, "route");
  const before = await state(page);
  await page.getByRole("button", { name: "Recortar trazado", exact: true }).click();
  const start = page.getByRole("slider", { name: "Inicio del recorte", exact: true });
  await start.focus();
  await start.press("Home");
  await start.press("ArrowRight");
  await page.getByRole("button", { name: "Aplicar recorte al borrador", exact: true }).click();
  const cropped = await state(page);
  expect(cropped.draft[0].points).toEqual(before.draft[0].points.slice(1));
  expect(cropped.draft[0].waypoints).toEqual(before.draft[0].waypoints);
  await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
  await state(page);
  await page.getByRole("button", { name: "Dividir trazado", exact: true }).click();
  const line = await page.locator("path.draft-line").boundingBox();
  // Avoid the source waypoint at the midpoint: clicking it intentionally opens its popup.
  await page.mouse.click(line.x + line.width * 0.7, line.y + line.height / 2);
  const split = await state(page);
  expect(split.draft).toHaveLength(2);
  expect(split.draft[0].waypoints[0]).toEqual(before.draft[0].waypoints[0]);
  expect(split.draft[1].waypoints[0]).toEqual({ ...before.draft[0].waypoints[0], id: split.draft[1].waypoints[0].id });
  expect(split.draft[1].waypoints[0].id).not.toBe(before.draft[0].waypoints[0].id);
  const tabs = page.getByRole("tablist", { name: "Rutas cargadas en el editor", exact: true }).getByRole("tab");
  await tabs.nth(0).click();
  await tabs.nth(1).click({ modifiers: ["Meta"] });
  await page.getByRole("button", { name: "Unir trazados", exact: true }).click();
  await expect(tabs).toHaveCount(1);
  const merged = await state(page);
  expect(merged.draft).toHaveLength(1);
  expect(merged.draft[0].waypoints).toHaveLength(2);
  expect(merged.draft[0].description).toBe(initial.routes[0].description);
  expect(merged.routes).toEqual(initial.routes);
  await showLibrary(page, "route");
  await page.getByText("Copias de seguridad", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia completa", exact: true }).click();
  const downloaded = await downloadPromise;
  const bytes = await readFile(await downloaded.path());
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: "anotaciones.json", mimeType: "application/json", buffer: bytes });
  const restored = await state(page);
  expect(restored.draft).toHaveLength(2);
  expect(restored.draft[0]).toEqual(merged.draft[0]);
  expect(restored.draft[1].points).toEqual(merged.draft[0].points);
  expect(restored.draft[1].description).toBe(merged.draft[0].description);
  const ids = restored.draft.flatMap((element) => element.waypoints.map((waypoint) => waypoint.id));
  expect(new Set(ids).size).toBe(4);
  expect(restored.routes[0]).toEqual(initial.routes[0]);
});

test("originales antiguos recuperan waypoints y descripción sólo para ver y copiar, sin migrar bytes", async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    const data = await store.loadWorkspace();
    delete data.routes[0].waypoints;
    delete data.routes[0].description;
    delete data.routes[0].completed;
    await store.saveWorkspace(data);
  });
  await page.reload();
  const legacy = await state(page);
  await page.getByRole("link", { name: "Ruta con waypoints", exact: true }).click();
  await expect(page.locator(".route-description p")).toHaveText("Descripción original ⛰️");
  await expect(page.locator(".waypoint-marker")).toHaveCount(1);
  expect((await state(page)).routes).toEqual(legacy.routes);
  await page.getByRole("button", { name: "Enviar al editor", exact: true }).click();
  const copied = await state(page);
  expect(copied.draft[0].description).toBe("Descripción original ⛰️");
  expect(copied.draft[0].waypoints[0].description).toBe("Agua & sombra");
  expect(copied.routes).toEqual(legacy.routes);
});
