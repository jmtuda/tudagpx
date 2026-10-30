import { test, expect } from "@playwright/test";
import { pinLibraries } from "./helpers/library";
import { readFile } from "node:fs/promises";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-workspace", "edit"),
  );
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-routing-mode", "free"),
  );
});
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
const ready = async (page) => {
  await page.goto("/");
  await pinLibraries(page);
  await expect(
    page.getByRole("heading", { name: "Segmentos de la zona" }),
  ).toBeVisible();
};
const persisted = async (page) => {
  await expect(
    page.getByText("Guardado en este navegador", { exact: true }),
  ).toBeVisible();
};
async function state(page) {
  return page.evaluate(async () => {
    const { loadWorkspace } = await import("/src/utils/localStore.js");
    return loadWorkspace();
  });
}

test("arranque, cartografías reales y selección conservada", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole("checkbox", { name: /Seleccionar Subida/ }).check();
  await page.getByRole("checkbox", { name: /Seleccionar Camino/ }).check();
  for (const value of ["ign_base", "mtn", "pnoa_orto", "osm"]) {
    await page
      .getByRole("button", { name: "Seleccionar mapa", exact: true })
      .click();
    const select = page.getByLabel("Cartografía");
    if ((await select.inputValue()) !== value) await select.selectOption(value);
    await expect
      .poll(
        () =>
          page
            .locator("img.leaflet-tile-loaded")
            .evaluateAll(
              (images) => images.filter((i) => i.naturalWidth === 256).length,
            ),
        { timeout: 20000 },
      )
      .toBeGreaterThan(0);
    await expect(
      page.getByRole("checkbox", { name: /Seleccionar Subida/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Seleccionar Camino/ }),
    ).toBeChecked();
  }
  const map = page.locator(".workspace-map");
  const box = await map.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height * 0.5, { steps: 15 });
  await page.mouse.up();
  await expect(
    page.getByRole("checkbox", { name: /Seleccionar Subida/ }),
  ).toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath("pantalla.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("importa varios tramos, superpone, conserva original y recarga", async ({
  page,
}) => {
  await ready(page);
  await page.locator("input[type=file]").first().setInputFiles(fixture);
  await expect(
    page.getByRole("heading", { name: "Ruta de prueba & original" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  await page.getByRole("checkbox", { name: /Mostrar Vuelta/ }).check();
  await page
    .getByRole("checkbox", {
      name: "Mostrar Ruta de prueba & original",
      exact: true,
    })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "Mostrar Ruta de prueba & original" }),
  ).toBeChecked();
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(2);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Original GPX ↓" }).click();
  const dl = await downloadPromise;
  expect(await readFile(await dl.path(), "utf8")).toBe(
    await readFile(fixture, "utf8"),
  );
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear segmentos", exact: true })
    .last()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar segmentos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ruta de prueba & original · tramo 1/ }),
  ).toBeVisible();
  await persisted(page);
  await page.reload();
  await pinLibraries(page);
  await page.getByRole("button", { name: /^Rutas/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ruta de prueba & original" }),
  ).toBeVisible();
  const d = await state(page);
  expect(d.routes.at(-1).tracks).toHaveLength(2);
  expect(d.routes.at(-1).original).toBe(await readFile(fixture, "utf8"));
});

test("editor: copias, arrastre, invertir, dividir, deshacer, versión y GPX", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole("checkbox", { name: /Seleccionar Subida/ }).check();
  await page
    .getByRole("button", { name: "Añadir 1 seleccionados al borrador" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu borrador libre" }),
  ).toBeVisible();
  const handle = page.getByTitle("Editar punto 1", { exact: true });
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 9, box.y + 9);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 25, { steps: 12 });
  await page.mouse.up();
  await persisted(page);
  let d = await state(page);
  expect(d.segments[0].points[0].ele).toBe(1160);
  expect(d.draft[0].points[0].ele).toBe(null);
  expect(d.draft[0].points[0].lat).not.toBe(d.segments[0].points[0].lat);
  await page.getByRole("button", { name: "Invertir", exact: true }).click();
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  await page.getByRole("button", { name: "↷ Rehacer" }).click();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  await page.getByTitle("Editar punto 2", { exact: true }).click();
  await page.getByRole("button", { name: "Dividir aquí" }).click();
  await expect(page.locator(".draft-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Guardar versión", exact: true })
    .click();
  await page.getByRole("button", { name: "Revisar y exportar →" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("checkbox", { name: /Acepto las advertencias/ }).check();
  const promise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar GPX", exact: true })
    .click();
  const download = await promise;
  const xml = await readFile(await download.path(), "utf8");
  const parsed = await page.evaluate(async (xml) => {
    const m = await import("/src/utils/workspace.js");
    return m.parseGPX(xml);
  }, xml);
  expect(parsed.tracks).toHaveLength(2);
  expect(xml).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
  await persisted(page);
  d = await state(page);
  expect(d.projects).toHaveLength(1);
  expect(d.segments[0].points[0].ele).toBe(1160);
  await page.reload();
  await pinLibraries(page);
  await page.getByRole("button", { name: /^Borrador/ }).click();
  await expect(page.locator(".draft-card")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("dibujo libre, recorte, eliminación, nuevo segmento y copia recuperable", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: /^Borrador/ }).click();
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  const map = page.locator(".workspace-map");
  await map.click({ position: { x: 250, y: 200 } });
  await map.click({ position: { x: 300, y: 220 } });
  await map.click({ position: { x: 350, y: 240 } });
  await map.click({ position: { x: 400, y: 260 } });
  await page.getByRole("button", { name: "Mostrar herramientas" }).click();
  await page.getByRole("button", { name: "Terminar dibujo" }).click();
  await persisted(page);
  expect((await state(page)).draft[0].points).toHaveLength(4);
  await page
    .getByRole("button", { name: "Recortar trazado", exact: true })
    .click();
  await page.getByLabel("Inicio del recorte").focus();
  await page.getByLabel("Inicio del recorte").press("ArrowRight");
  await page
    .getByRole("button", { name: "Aplicar recorte al borrador" })
    .click();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  await page.getByTitle("Editar punto 1", { exact: true }).click();
  await page
    .getByRole("button", { name: "Eliminar punto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar como nuevo segmento", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar segmento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar versión", exact: true })
    .click();
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia completa" }).click();
  const download = await promise;
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles(await download.path());
  await expect(page.getByText(/Copia añadida sin borrar/)).toBeVisible();
  await persisted(page);
  const d = await state(page);
  expect(d.draft[0].points).toHaveLength(2);
  expect(d.segments).toHaveLength(8);
  expect(d.projects).toHaveLength(3);
  await page.reload();
  await pinLibraries(page);
  await page.getByRole("button", { name: /^Borrador/ }).click();
  await expect(page.locator(".draft-card")).toHaveCount(1);
});

test("modelo: cruces geográficos, GPX inválido, namespaces, huecos y duplicados", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const m = await import("/src/utils/workspace.js");
    const crossing = m.inBounds(
      [
        { lat: 0, lon: -3 },
        { lat: 0, lon: 3 },
      ],
      { south: -1, north: 1, west: -1, east: 1 },
    );
    const outside = m.inBounds(
      [
        { lat: 2, lon: -3 },
        { lat: 2, lon: 3 },
      ],
      { south: -1, north: 1, west: -1, east: 1 },
    );
    const bad = [
      "not xml",
      '<gpx><trk><trkseg><trkpt lat="91" lon="0"/></trkseg></trk></gpx>',
      '<gpx><trk><trkseg><trkpt lon="0"/></trkseg></trk></gpx>',
      '<gpx><wpt lat="0" lon="0"/></gpx>',
    ].map((xml) => {
      try {
        m.parseGPX(xml);
        return false;
      } catch {
        return true;
      }
    });
    const prefixed = m.parseGPX(
      '<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1"><g:rte><g:rtept lat="0" lon="0"/><g:rtept lat="1" lon="1"/></g:rte></g:gpx>',
    );
    const elements = [
      {
        name: "a",
        points: [
          { lat: 0, lon: 0, ele: 1 },
          { lat: 0, lon: 1, ele: 2 },
        ],
      },
      {
        name: "b",
        points: [
          { lat: 0, lon: 0, ele: null },
          { lat: 0, lon: 1, ele: null },
        ],
      },
    ];
    const issues = m.review(elements);
    const empty = m.initialWorkspace();
    empty.draft = [{ id: "empty", name: "Incompleto", points: [] }];
    return {
      crossing,
      outside,
      bad,
      prefixed: prefixed.tracks.length,
      messages: issues.map((i) => i.message),
      empty: m.validateWorkspace(empty).draft.length,
      escape: m.exportGPX([elements[0]], '<test & "nombre">'),
    };
  });
  expect(result.crossing).toBe(true);
  expect(result.outside).toBe(false);
  expect(result.bad).toEqual([true, true, true, true]);
  expect(result.prefixed).toBe(1);
  expect(result.messages.some((s) => s.includes("Hueco"))).toBe(true);
  expect(result.messages.some((s) => s.includes("duplicadas"))).toBe(true);
  expect(result.messages.some((s) => s.includes("sin elevación"))).toBe(true);
  expect(result.empty).toBe(1);
  expect(result.escape).toContain("&lt;test &amp; &quot;nombre&quot;&gt;");
});

test("un GPX inválido se rechaza sin modificar la biblioteca", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "incorrecto.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(
        '<gpx><trk><trkseg><trkpt lat="NaN" lon="3"/></trkseg></trk></gpx>',
      ),
    });
  await expect(page.getByText(/coordenadas inválidas/)).toBeVisible();
  await persisted(page);
  expect((await state(page)).routes).toHaveLength(1);
});

test("importación directa de segmentos y cambio geográfico conserva selección", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("checkbox", { name: /Seleccionar Subida/ }).check();
  await page.getByText("Buscar y filtrar", { exact: true }).click();
  await page.getByLabel("Destino del GPX").selectOption("segments");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "otra-zona.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(
        '<gpx><trk><name>Zona lejana</name><trkseg><trkpt lat="36.5" lon="-6.2"/><trkpt lat="36.51" lon="-6.19"/></trkseg></trk></gpx>',
      ),
    });
  await expect(
    page.getByRole("heading", { name: "Zona lejana", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Seleccionar Subida/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("heading", { name: /Camino de la ladera/ }),
  ).toHaveCount(0);
  await expect(page.getByText("1 en el mapa", { exact: true })).toBeVisible();
  await persisted(page);
  const d = await state(page);
  expect(d.routes).toHaveLength(2);
  expect(d.segments).toHaveLength(4);
  expect(d.routes.at(-1).original).toContain("Zona lejana");
});

test("borrador vacío recuperable y exportación incompleta bloqueada", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: /^Borrador/ }).click();
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();
  await page.getByRole("button", { name: "Terminar dibujo" }).click();
  await page
    .getByRole("button", { name: "Guardar versión", exact: true })
    .click();
  await persisted(page);
  expect((await state(page)).projects).toHaveLength(1);
  await page.reload();
  await pinLibraries(page);
  await page.getByRole("button", { name: /^Borrador/ }).click();
  await expect(page.locator(".draft-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Revisar y exportar →" }).click();
  await expect(page.getByText(/necesita al menos dos puntos/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar GPX", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cerrar revisión" }).click();
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  await page.getByRole("button", { name: "Abrir esta versión" }).click();
  await persisted(page);
  expect((await state(page)).projects).toHaveLength(2);
});

test("originales UTF-8 con BOM y UTF-16 conservan exactamente sus bytes", async ({
  page,
}) => {
  await ready(page);
  const xml =
    '<gpx><trk><name>Original con codificación</name><trkseg><trkpt lat="40" lon="-4"/><trkpt lat="41" lon="-4"/></trkseg></trk></gpx>';
  const files = [
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml)]),
    Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('<?xml version="1.0" encoding="UTF-16"?>' + xml, "utf16le"),
    ]),
  ];
  for (const [i, bytes] of files.entries()) {
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: `original-${i}.gpx`,
        mimeType: "application/gpx+xml",
        buffer: bytes,
      });
    await expect(
      page.getByRole("heading", { name: "Original con codificación" }),
    ).toHaveCount(i + 1);
    const promise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Original GPX ↓" }).last().click();
    const dl = await promise;
    expect(await readFile(await dl.path())).toEqual(bytes);
  }
  await persisted(page);
  const d = await state(page);
  expect(
    Buffer.from(
      JSON.parse(JSON.stringify(d)).routes.at(-1).originalBase64,
      "base64",
    ),
  ).toEqual(files[1]);
});

test("móvil: mapa y controles accesibles sin desbordamiento", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Seleccionar mapa", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Importar GPX" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
