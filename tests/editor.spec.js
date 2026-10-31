import { test, expect } from "@playwright/test";
import { pinLibraries, sendLibraryItem } from "./helpers/library";
// Esta batería verifica la geometría libre; el cálculo real tiene su propia batería.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-workspace", "edit"),
  );
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-routing-mode-v3", "free"),
  );
});
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
async function saved(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
}
async function state(page) {
  await saved(page);
  return page.evaluate(async () => {
    const m = await import("/src/utils/localStore.js");
    return m.loadWorkspace();
  });
}
async function demo(page) {
  await page.goto("/");
  await pinLibraries(page);
  await sendLibraryItem(page, "segment", 0);
  await expect(
    page.getByRole("toolbar", { name: "Herramientas del mapa" }),
  ).toBeVisible();
}
async function drag(page, locator, dx, dy) {
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, {
    steps: 10,
  });
  await page.mouse.up();
}

test("edición de una copia GPX, inserción por arrastre y un solo paso de deshacer", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await pinLibraries(page);
  await page.locator("input[type=file]").first().setInputFiles(fixture);
  await sendLibraryItem(page, "route", -1);
  await expect(page.getByLabel("Índice del punto")).toHaveCount(0);
  await expect(page.locator(".anchor-handle")).toHaveCount(4);

  const before = await state(page),
    middle = page.getByTitle("Insertar punto entre 1 y 2", { exact: true });
  const b = await middle.boundingBox(),
    line = page.locator("path.draft-line").first();
  const path = await line.getAttribute("d");
  await page.mouse.move(b.x + 7, b.y + 7);
  await page.mouse.down();
  await page.mouse.move(b.x + 50, b.y + 30, { steps: 8 });
  await expect(line).not.toHaveAttribute("d", path);
  await page.mouse.up();
  let d = await state(page);
  expect(d.draft[0].points).toHaveLength(5);
  expect(d.routes.at(-1).tracks).toEqual(before.routes.at(-1).tracks);
  expect(d.routes.at(-1).originalBase64).toBe(
    before.routes.at(-1).originalBase64,
  );
  expect(d.draft[0].points[1].ele).toBe(null);
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  expect((await state(page)).draft[0].points).toEqual(before.draft[0].points);
  await page.getByRole("button", { name: "↷ Rehacer" }).click();
  expect((await state(page)).draft[0].points).toHaveLength(5);
  expect(errors).toEqual([]);
});

test("reabrir una copia importada tras recargar activa sus puntos blancos", async ({
  page,
}) => {
  await page.goto("/");
  await pinLibraries(page);
  await page.locator("input[type=file]").first().setInputFiles(fixture);
  await sendLibraryItem(page, "route", -1);
  const before = await state(page);
  await page.reload();
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await expect(page.locator(".anchor-handle")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Editar trazado", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 30, -20);
  const after = await state(page);
  expect(after.draft[0].points[1]).not.toEqual(before.draft[0].points[1]);
  expect(after.routes.at(-1)).toEqual(before.routes.at(-1));
});

test("puntos arrastrables y menú contextual sin añadir puntos accidentales", async ({
  page,
}) => {
  await demo(page);

  const original = (await state(page)).draft[0].points;
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 35, -15);
  let d = await state(page);
  expect(d.draft[0].points).toHaveLength(4);
  expect(d.draft[0].points[1].lat).not.toBe(original[1].lat);
  expect(d.segments[0].points).toEqual(original);
  await page
    .getByTitle("Editar punto 2", { exact: true })
    .click({ button: "right" });
  await page
    .getByRole("button", { name: "Eliminar punto", exact: true })
    .click();
  d = await state(page);
  expect(d.draft[0].points).toHaveLength(3);
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  expect((await state(page)).draft[0].points).toHaveLength(4);
});

test("recorte visual reversible y creación directa de segmento sin cambiar borrador", async ({
  page,
}) => {
  await demo(page);
  const original = (await state(page)).draft[0].points;
  await page
    .getByRole("button", { name: "Recortar trazado", exact: true })
    .click();
  await page.getByLabel("Inicio del recorte").focus();
  await page.getByLabel("Inicio del recorte").press("ArrowRight");
  await page.getByLabel("Final del recorte").focus();
  await page.getByLabel("Final del recorte").press("ArrowLeft");
  expect((await state(page)).draft[0].points).toEqual(original);
  await page
    .getByRole("button", { name: "Guardar selección como segmento" })
    .click();
  const saveDialog = page.getByRole("dialog", {
    name: "Guardar segmento",
    exact: true,
  });
  await saveDialog
    .getByLabel("Nombre del segmento", { exact: true })
    .fill("Mi subida seleccionada");
  await saveDialog
    .getByRole("button", { name: "Guardar segmento", exact: true })
    .click();
  let d = await state(page);
  expect(d.segments.at(-1).name).toBe("Mi subida seleccionada");
  expect(d.segments.at(-1).points).toEqual(original.slice(1, 3));
  expect(d.draft[0].points).toEqual(original);
  await page
    .getByRole("button", { name: "Aplicar recorte al borrador" })
    .click();
  expect((await state(page)).draft[0].points).toEqual(original.slice(1, 3));
  await page.keyboard.press("Control+z");
  expect((await state(page)).draft[0].points).toEqual(original);
  await page.keyboard.press("Control+Shift+z");
  expect((await state(page)).draft[0].points).toEqual(original.slice(1, 3));
  await page.reload();
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await pinLibraries(page);
  expect((await state(page)).draft[0].points).toEqual(original.slice(1, 3));
});

test("selección arrastrada sobre perfil, extremos válidos y cancelación", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await page
    .getByRole("button", { name: "Recortar trazado", exact: true })
    .click();
  const profile = page.getByRole("region", {
    name: "Perfil de altitud",
    exact: true,
  });
  const chart = profile.getByRole("img", {
      name: /Perfil para seleccionar el recorte/,
    }),
    box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByLabel("Inicio del recorte")).toHaveValue("2");
  await expect(page.getByLabel("Final del recorte")).toHaveValue("3");
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  expect(
    Number(await page.getByLabel("Inicio del recorte").inputValue()),
  ).toBeLessThan(
    Number(await page.getByLabel("Final del recorte").inputValue()),
  );
  await page.getByRole("button", { name: "Cancelar recorte" }).click();
  expect((await state(page)).draft[0].points).toHaveLength(4);
  expect(errors).toEqual([]);
});

test("tijeras dividen sobre la línea, deshacer conserva el trazado completo", async ({
  page,
}) => {
  await demo(page);
  const original = (await state(page)).draft[0].points;
  const marker = await page
    .getByTitle("Insertar punto entre 2 y 3", { exact: true })
    .boundingBox();
  await page
    .getByRole("button", { name: "Dividir trazado", exact: true })
    .click();

  await page.mouse.move(marker.x + 7, marker.y + 7);
  await expect(page.getByTitle("Dividir en este lugar")).toBeVisible();
  await page.getByTitle("Dividir en este lugar").click();
  let d = await state(page);
  expect(d.draft).toHaveLength(2);
  expect(d.draft[0].points.at(-1)).toEqual(d.draft[1].points[0]);
  expect(d.draft[0].points.length + d.draft[1].points.length).toBe(6);
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  d = await state(page);
  expect(d.draft).toHaveLength(1);
  expect(d.draft[0].points).toEqual(original);
});

test("edición táctil a pantalla completa sin perder panel ni selección", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-workspace", "edit"),
  );
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-routing-mode-v3", "free"),
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await demo(page);
    await expect(page.locator("#library-panel")).toHaveCount(0);

    await expect(page.locator(".workspace-map")).toHaveCSS("width", "390px");
    await page.getByTitle("Insertar punto entre 1 y 2", { exact: true }).tap();
    expect((await state(page)).draft[0].points).toHaveLength(5);
    await page.getByTitle("Editar punto 2", { exact: true }).tap();
    await page
      .getByRole("button", { name: "Eliminar punto", exact: true })
      .tap();
    expect((await state(page)).draft[0].points).toHaveLength(4);
    await page
      .getByRole("button", { name: "Recortar trazado", exact: true })
      .tap();
    await expect(page.getByLabel("Inicio del recorte")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar recorte" }).tap();
    await expect(page.locator("#library-panel")).toHaveCount(0);
    await expect(
      page
        .getByRole("tablist", { name: "Rutas cargadas en el editor" })
        .getByRole("tab"),
    ).toHaveCount(1);
    expect((await state(page)).draft[0].points).toHaveLength(4);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("terminar dibujo y mover mapa no añaden puntos al trazado", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();

  const map = page.locator(".workspace-map");
  await map.click({ position: { x: 800, y: 400 } });
  await map.click({ position: { x: 850, y: 450 } });

  await page.getByRole("button", { name: "Terminar dibujo" }).click();
  await expect(
    page.getByRole("button", { name: "Editar trazado", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await map.click({ position: { x: 800, y: 500 } });
  expect((await state(page)).draft.at(-1).points).toHaveLength(2);
  await page
    .getByRole("button", { name: "Editar trazado", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Editar trazado", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("muestreo de anclas no elimina GPS y división conserva los puntos", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const m = await import("/src/utils/editorGeometry.js");
    const points = Array.from({ length: 10000 }, (_, i) => ({
      lat: i / 10000,
      lon: i / 10000,
      ele: i,
    }));
    const before = JSON.stringify(points);
    const indices = m.anchorIndices(
      points,
      (p) => ({ x: p.lat * 200, y: p.lon * 200 }),
      { x: 500, y: 500 },
      5000,
    );
    const parts = m.splitTrace(points, 5000);
    const coarse = m.anchorIndices(
      points,
      (p) => ({ x: p.lat * 200, y: p.lon * 200 }),
      { x: 1000, y: 1000 },
    );
    const fine = m.anchorIndices(
      points,
      (p) => ({ x: p.lat * 800, y: p.lon * 800 }),
      { x: 1000, y: 1000 },
    );
    return {
      unchanged: JSON.stringify(points) === before,
      selected: indices.includes(5000),
      count: indices.length,
      coarse: coarse.length,
      fine: fine.length,
      merged: [...parts[0], ...parts[1].slice(1)].length,
      blocked: m.splitTrace(points, 0),
    };
  });
  expect(result.unchanged).toBe(true);
  expect(result.selected).toBe(true);
  expect(result.count).toBeLessThan(350);
  expect(result.fine).toBeGreaterThan(result.coarse);
  expect(result.merged).toBe(10000);
  expect(result.blocked).toBe(null);
});
