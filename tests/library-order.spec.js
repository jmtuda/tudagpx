import { test, expect } from "@playwright/test";

const names = ["Ruta 10", "Álamo", "ruta 2", "alamo", "Ñandú", "Zeta", "ÁLAMO"];
const labels = { "added-asc": "Inclusión: antiguas primero", "added-desc": "Inclusión: recientes primero", "name-asc": "Nombre: A–Z", "name-desc": "Nombre: Z–A" };
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText("Guardado en este navegador");
  return page.evaluate(async () => (await import("/src/utils/localStore.js")).loadWorkspace());
}
async function seed(page) {
  await page.goto("/");
  await state(page);
  await page.evaluate(async (recordNames) => {
    const store = await import("/src/utils/localStore.js");
    const data = await store.loadWorkspace();
    const points = [{ lat: 40.752, lon: -3.99, ele: 900 }, { lat: 40.752, lon: -3.98, ele: 1000 }];
    const records = recordNames.map((name, index) => ({ id: `order-route-${index}`, name, tracks: [points.map((point) => ({ ...point, lat: point.lat + index * 0.001 }))], ...(index ? { importedAt: new Date(2030 - index, 0, 1).toISOString() } : {}) }));
    data.routes = records;
    data.segments = records.map(({ tracks, ...record }, index) => ({ ...record, id: `order-segment-${index}`, points: tracks[0] }));
    data.draft = [];
    localStorage.removeItem("tudagpx-library-order-v1");
    await store.saveWorkspace(data);
  }, names);
  await page.reload();
  return state(page);
}
async function category(page, kind) {
  await page.getByRole("navigation", { name: "Biblioteca", exact: true }).getByRole("button", { name: kind === "routes" ? /^Rutas/ : /^Segmentos/ }).click();
}
const sortButton = (page, kind) => page.getByRole("button", { name: kind === "routes" ? "Ordenar rutas" : "Ordenar segmentos", exact: true });
async function sort(page, kind, key) {
  await sortButton(page, kind).click();
  const group = page.getByRole("group", { name: kind === "routes" ? "Ordenar rutas" : "Ordenar segmentos", exact: true });
  await expect(group.getByRole("radio")).toHaveCount(4);
  const radio = group.getByRole("radio", { name: labels[key], exact: true });
  if (await radio.isChecked()) {
    await page.keyboard.press("Escape");
  } else {
    // The input unmounts on change; click its label instead of check(), whose
    // post-action checked-state verification races the intentional unmount.
    await group.getByText(labels[key], { exact: true }).click();
  }
  await expect(group).toHaveCount(0);
}
const listed = (page) => page.locator(".viewer-route-card h3");
const colors = (page) => page.locator("path.viewer-route-selected").evaluateAll((paths) => Object.fromEntries(paths.map((path) => [path.dataset.routeId, path.getAttribute("stroke")])));
function expected(key) {
  if (key === "added-asc") return names;
  if (key === "added-desc") return [...names].reverse();
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  return names.map((name, index) => ({ name, index })).sort((a, b) => (key === "name-desc" ? -1 : 1) * collator.compare(a.name, b.name) || a.index - b.index).map(({ name }) => name);
}
for (const width of [1440, 390]) {
  test(`cuatro órdenes estables e independientes, filtros y colores intactos ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const before = await seed(page);
    await expect(listed(page)).toHaveText(names);
    await page.getByRole("checkbox", { name: "Mostrar Ruta 10", exact: true }).check();
    await page.getByRole("checkbox", { name: "Mostrar ruta 2", exact: true }).check();
    const originalColors = await colors(page);
    for (const key of Object.keys(labels)) {
      await sort(page, "routes", key);
      await expect(listed(page)).toHaveText(expected(key));
      await expect(page.getByRole("checkbox", { name: "Mostrar Ruta 10", exact: true })).toBeChecked();
      expect(await colors(page)).toEqual(originalColors);
      const saved = await state(page);
      expect(saved.routes).toEqual(before.routes);
      expect(saved.segments).toEqual(before.segments);
    }
    await page.getByText(/^Buscar y filtrar rutas/).click();
    await page.getByRole("textbox", { name: "Buscar rutas por nombre", exact: true }).fill("ruta");
    await expect(listed(page)).toHaveText(["Ruta 10", "ruta 2"]);
    expect(await colors(page)).toEqual(originalColors);
    await sort(page, "routes", "name-asc");
    await expect(listed(page)).toHaveText(["ruta 2", "Ruta 10"]);
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
    await expect(listed(page)).toHaveText(expected("name-asc"));
    await category(page, "segments");
    await expect(listed(page)).toHaveText(names);
    for (const key of Object.keys(labels)) {
      await sort(page, "segments", key);
      await expect(listed(page)).toHaveText(expected(key));
      expect(await colors(page)).toEqual(originalColors);
    }
    await sort(page, "segments", "added-desc");
    await expect(listed(page)).toHaveText([...names].reverse());
    await category(page, "routes");
    await expect(listed(page)).toHaveText(expected("name-asc"));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tudagpx-library-order-v1")))).toEqual({ routes: "name-asc", segments: "added-desc" });
    await sortButton(page, "routes").click();
    await page.screenshot({ path: info.outputPath(`library-sort-${width}.png`), fullPage: true });
    // Keep every option operable even when expanded filters push the menu low
    // in the mobile library; normal scrolling must suffice (never force clicks).
    await page.getByRole("group", { name: "Ordenar rutas", exact: true }).getByText(labels["name-desc"], { exact: true }).click();
    await expect(listed(page)).toHaveText(expected("name-desc"));
    await sort(page, "routes", "name-asc");
    await page.reload();
    await state(page);
    await category(page, "routes");
    await expect(listed(page)).toHaveText(expected("name-asc"));
    await category(page, "segments");
    await expect(listed(page)).toHaveText([...names].reverse());
    const after = await state(page);
    expect(after.routes).toEqual(before.routes);
    expect(after.segments).toEqual(before.segments);
  });
}

test("ordenación accesible por teclado y cierre con Escape/clic exterior", async ({ page }) => {
  await seed(page);
  const button = sortButton(page, "routes");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  const group = page.getByRole("group", { name: "Ordenar rutas", exact: true });
  await expect(group).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(group.getByRole("radio", { name: labels["added-asc"], exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(listed(page)).toHaveText([...names].reverse());
  await expect(button).toBeFocused();
  await button.press("Space");
  await expect(group).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(group).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  await expect(group).toBeVisible();
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  await expect(group).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("nueva importación se añade al final sin usar fecha GPX ni reordenar IndexedDB", async ({ page }) => {
  const before = await seed(page);
  const gpx = '<?xml version="1.0"?><gpx version="1.1"><metadata><name>Importación antigua</name><time>1970-01-01T00:00:00Z</time><desc>Descripción GPX importada</desc></metadata><trk><name>Importación antigua</name><trkseg><trkpt lat="40.752" lon="-3.99"><ele>900</ele></trkpt><trkpt lat="40.752" lon="-3.98"><ele>1000</ele></trkpt></trkseg></trk></gpx>';
  await page.locator('input[type="file"][accept*="gpx"]').setInputFiles({ name: "antigua.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpx) });
  await expect(listed(page)).toHaveText([...names, "Importación antigua"]);
  const saved = await state(page);
  expect(saved.routes.slice(0, -1)).toEqual(before.routes);
  expect(saved.routes.at(-1).description).toBe("Descripción GPX importada");
  expect(saved.routes.at(-1).original).toBe(gpx);
  expect(saved.routes.at(-1).originalBase64).toBe(Buffer.from(gpx).toString("base64"));
  await sort(page, "routes", "added-desc");
  await expect(listed(page)).toHaveText(["Importación antigua", ...names.slice().reverse()]);
  expect((await state(page)).routes).toEqual(saved.routes);
});
