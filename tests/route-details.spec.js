import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Synthetic local-only records: never authenticate or contact the owner's library.
const original = '<?xml version="1.0" encoding="UTF-8"?>\r\n<gpx version="1.1"><wpt lat="40.752" lon="-3.99"><name>Fuente sintética</name><desc>Agua de prueba</desc></wpt><trk><name>Original</name><trkseg><trkpt lat="40.752" lon="-3.99"><ele>900</ele></trkpt><trkpt lat="40.752" lon="-3.98"><ele>1000</ele></trkpt></trkseg></trk></gpx>';
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText("Guardado en este navegador");
  return page.evaluate(async () => (await import("/src/utils/localStore.js")).loadWorkspace());
}
async function seed(page) {
  await page.goto("/");
  await state(page);
  await page.evaluate(async (xml) => {
    const store = await import("/src/utils/localStore.js");
    const data = await store.loadWorkspace();
    const points = [{ lat: 40.752, lon: -3.99, ele: 900 }, { lat: 40.752, lon: -3.98, ele: 1000 }];
    const bytes = btoa(String.fromCharCode(...new TextEncoder().encode(xml)));
    const common = { original: xml, originalBase64: bytes, filename: "sintetica.gpx", waypoints: [{ id: "fixture-water", lat: 40.752, lon: -3.99, name: "Fuente sintética", description: "Agua de prueba" }] };
    data.routes = [{ ...common, id: "detail-route", name: "Ruta sintética", tracks: [points] }, { id: "other-route", name: "Otra ruta", tracks: [[{ lat: 40.76, lon: -3.99, ele: 910 }, { lat: 40.76, lon: -3.98, ele: 1020 }]] }];
    data.segments = [{ ...common, id: "detail-segment", name: "Segmento sintético", points }];
    data.draft = [{ id: "preserved-draft", name: "Trabajo previo", points, editorRouteId: "preserved-file", editorRouteName: "Trabajo previo" }];
    await store.saveWorkspace(data);
  }, original);
  await page.reload();
  return state(page);
}
async function category(page, kind) {
  await page.getByRole("navigation", { name: "Biblioteca", exact: true }).getByRole("button", { name: kind === "route" ? /^Rutas/ : /^Segmentos/ }).click();
}
const detail = (page) => page.getByRole("complementary", { name: "Detalle del recorrido", exact: true });
const card = (page, name) => page.locator("article.viewer-route-card").filter({ has: page.getByRole("link", { name, exact: true }) });
async function back(page) {
  await detail(page).getByRole("button", { name: "← Volver a la biblioteca", exact: true }).click();
  await expect(page.locator("#library-panel")).toBeVisible();
}
for (const width of [1440, 390]) {
  test(`detalle aislado conserva selección, color y borrador ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const before = await seed(page);
    for (const name of ["Ruta sintética", "Otra ruta"]) await card(page, name).getByRole("checkbox").check();
    await category(page, "segment");
    await card(page, "Segmento sintético").getByRole("checkbox").check();
    await expect(detail(page)).toHaveCount(0);
    await expect(page.locator("path.viewer-route-selected")).toHaveCount(3);
    for (const [kind, name] of [["route", "Ruta sintética"], ["segment", "Segmento sintético"]]) {
      await category(page, kind);
      const id = `detail-${kind}`;
      const color = await page.locator(`path[data-route-id="${id}"]`).getAttribute("stroke");
      // Both the noninteractive metrics area and the actual title link open details.
      await card(page, name).locator(kind === "route" ? ".metrics" : ".card-detail-link").click();
      await expect(detail(page).getByRole("heading", { name, exact: true })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`#recorrido/${id}$`));
      await expect(page.locator("#library-panel")).toHaveCount(0);
      await expect(page.locator("path[data-route-id]")).toHaveCount(1);
      await expect(page.locator(`path.viewer-route-selected[data-route-id="${id}"]`)).toHaveAttribute("stroke", color);
      await expect(page.locator(".elevation-route-metric")).toHaveCount(1);
      await expect(page.locator(`.elevation-route-metric[data-route-id="${id}"]`)).toHaveCount(1);
      await expect(page.locator(`.elevation-profile svg g[data-route-id="${id}"]`)).toHaveCount(1);
      const profileColor = await page.locator(`.elevation-profile svg g[data-route-id="${id}"]`).evaluate((node) => node.style.getPropertyValue("--profile-color"));
      expect(profileColor).toBe(color);
      await expect(detail(page).getByRole("region", { name: "Waypoints del recorrido" })).toContainText("Fuente sintética");
      await expect(page.locator("path.draft-line, .anchor-handle, .editor-tools")).toHaveCount(0);
      expect((await state(page)).draft).toEqual(before.draft);
      // Real tile requests only; this assertion does not mistake a mocked layer for a map.
      await expect.poll(() => page.locator("img.leaflet-tile").evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth > 0).length), { timeout: 20000 }).toBeGreaterThan(0);
      await page.screenshot({ path: info.outputPath(`detail-${kind}-${width}.png`), fullPage: true });
      await back(page);
      await expect(card(page, name).getByRole("checkbox")).toBeChecked();
      await expect(page.locator("path.viewer-route-selected")).toHaveCount(3);
    }
    expect((await state(page)).routes).toEqual(before.routes);
    expect((await state(page)).segments).toEqual(before.segments);
  });
}
for (const width of [1440, 390]) {
for (const kind of ["route", "segment"]) {
  test(`metadatos ${kind} ${width}: valores legacy, cancelar, Unicode literal, persistencia y copia`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const before = await seed(page);
    await category(page, kind);
    const name = kind === "route" ? "Ruta sintética" : "Segmento sintético";
    const collection = kind === "route" ? "routes" : "segments";
    await card(page, name).getByRole("link").click();
    await expect(detail(page)).toContainText("Pendiente de realizar");
    await expect(detail(page)).toContainText("Todavía no hay descripción.");
    await detail(page).getByRole("button", { name: "Editar datos", exact: true }).click();
    await expect(detail(page).getByLabel("Realizada", { exact: true })).not.toBeChecked();
    await expect(detail(page).getByLabel("Descripción", { exact: true })).toHaveValue("");
    await detail(page).getByLabel("Descripción", { exact: true }).fill("Cambio cancelado");
    await detail(page).getByLabel("Realizada", { exact: true }).check();
    await detail(page).getByRole("button", { name: "Cancelar cambios" }).click();
    expect((await state(page))[collection]).toEqual(before[collection]);
    const description = 'Primera línea: Peña, ñ, 🚲\nSegunda línea <img src=x onerror="window.__detailExecuted=true"> & <script>window.__detailExecuted=true</script>';
    await detail(page).getByRole("button", { name: "Editar datos", exact: true }).click();
    await expect(detail(page).getByLabel("Descripción", { exact: true })).toHaveValue("");
    await detail(page).getByLabel("Realizada", { exact: true }).check();
    await detail(page).getByLabel("Descripción", { exact: true }).fill(description);
    await detail(page).getByRole("button", { name: "Guardar datos", exact: true }).click();
    await expect(detail(page).locator(".route-description p")).toHaveText(description);
    expect(await page.evaluate(() => window.__detailExecuted)).toBeUndefined();
    const saved = await state(page);
    expect(saved[collection][0]).toEqual({ ...before[collection][0], completed: true, description });
    expect(saved[kind === "route" ? "segments" : "routes"]).toEqual(before[kind === "route" ? "segments" : "routes"]);
    expect(saved.draft).toEqual(before.draft);
    await page.reload();
    await state(page);
    await expect(detail(page).locator(".route-description p")).toHaveText(description);
    await back(page);
    await category(page, kind);
    await expect(card(page, name)).toContainText("✓ Realizada");
    await card(page, name).getByRole("link").click();
    await expect(detail(page).locator(".route-description p")).toHaveText(description);
    await back(page);
    await page.getByText("Copias de seguridad", { exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar copia completa", exact: true }).click();
    const downloaded = await downloadPromise;
    const backup = JSON.parse(await readFile(await downloaded.path(), "utf8"));
    expect(backup[collection]).toEqual(saved[collection]);
    expect(backup.draft).toEqual(saved.draft);
  });
}
}

test("historial atrás/adelante, enlace directo y recarga", async ({ page }) => {
  await seed(page);
  await card(page, "Ruta sintética").getByRole("link").click();
  await expect(detail(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator("#library-panel")).toBeVisible();
  await page.goForward();
  await expect(detail(page).getByRole("heading", { name: "Ruta sintética", exact: true })).toBeVisible();
  await page.goto("/#recorrido/detail-segment");
  await expect(detail(page).getByRole("heading", { name: "Segmento sintético", exact: true })).toBeVisible();
  await page.reload();
  await state(page);
  await expect(detail(page).getByRole("heading", { name: "Segmento sintético", exact: true })).toBeVisible();
});

test("checkbox y acciones de ficha no abren el detalle", async ({ page }) => {
  const before = await seed(page);
  const item = card(page, "Ruta sintética");
  await item.getByRole("checkbox").check();
  await expect(detail(page)).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await item.getByRole("button", { name: "Editar nombre de Ruta sintética", exact: true }).click();
  await expect(detail(page)).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await item.getByRole("button", { name: "Borrar Ruta sintética", exact: true }).click();
  await expect(detail(page)).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await item.getByRole("button", { name: "Descargar GPX", exact: true }).click();
  const downloaded = await downloading;
  expect(await readFile(await downloaded.path(), "utf8")).toBe(original);
  await expect(detail(page)).toHaveCount(0);
  expect((await state(page)).routes).toEqual(before.routes);
  await item.getByRole("button", { name: "Enviar al editor", exact: true }).click();
  await expect(detail(page)).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Editar", exact: true })).toHaveAttribute("aria-selected", "true");
});
