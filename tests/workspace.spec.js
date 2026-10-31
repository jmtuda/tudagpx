import { test, expect } from "@playwright/test";
import { pinLibraries, sendLibraryItem, showLibrary } from "./helpers/library";
import { readFile } from "node:fs/promises";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-workspace", "edit"),
  );
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-routing-mode-v3", "free"),
  );
});
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
const ready = async (page) => {
  await page.goto("/");
  await pinLibraries(page);
  await expect(
    page.getByRole("tab", { name: "Editar", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
};
const persisted = async (page) => {
  await expect(
    page.getByText("Guardado en este navegador", { exact: true }),
  ).toBeVisible();
};
async function state(page) {
  await persisted(page);
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
  await showLibrary(page, "segment");
  await page.getByRole("checkbox", { name: /Mostrar Subida/ }).check();
  await page.getByRole("checkbox", { name: /Mostrar Camino/ }).check();
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
      page.getByRole("checkbox", { name: /Mostrar Subida/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Mostrar Camino/ }),
    ).toBeChecked();
  }
  const map = page.locator(".workspace-map");
  const box = await map.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height * 0.5, { steps: 15 });
  await page.mouse.up();
  await expect(
    page.getByRole("checkbox", { name: /Mostrar Subida/ }),
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
  await pinLibraries(page);
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
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(2);
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".viewer-route-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Ruta de prueba & original",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Descargar GPX", exact: true })
    .click();
  const dl = await downloadPromise;
  expect(await readFile(await dl.path(), "utf8")).toBe(
    await readFile(fixture, "utf8"),
  );
  await sendLibraryItem(page, "route", -1);
  const imported = await state(page);
  for (const [i, track] of imported.routes.at(-1).tracks.entries()) {
    if (i) await page.locator("path.draft-line").nth(i).dispatchEvent("click");
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Guardar segmento",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    expect((await state(page)).segments.at(-1).points).toEqual(track);
  }
  await showLibrary(page, "segment");
  await expect(
    page.getByRole("heading", { name: /Ruta de prueba & original · tramo 1/ }),
  ).toBeVisible();
  await persisted(page);
  await page.reload();
  await pinLibraries(page);
  await showLibrary(page, "route");
  await expect(
    page.getByRole("heading", { name: "Ruta de prueba & original" }),
  ).toBeVisible();
  const d = await state(page);
  expect(d.routes.at(-1).tracks).toHaveLength(2);
  expect(d.routes.at(-1).original).toBe(await readFile(fixture, "utf8"));
});

test("editor: copias, arrastre, invertir, dividir, historial, borrador automático y GPX", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await showLibrary(page, "segment");
  await page.getByRole("checkbox", { name: /Mostrar Subida/ }).check();
  await sendLibraryItem(page, "segment", 0);
  expect((await state(page)).draft).toHaveLength(1);

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
  const moved = structuredClone(d.draft);

  await page
    .getByRole("button", { name: "Invertir trazado", exact: true })
    .click();
  expect((await state(page)).draft[0].points).toEqual(
    [...moved[0].points].reverse(),
  );
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  expect((await state(page)).draft).toEqual(moved);
  await page.getByRole("button", { name: "↷ Rehacer" }).click();
  expect((await state(page)).draft[0].points).toEqual(
    [...moved[0].points].reverse(),
  );

  await page.getByTitle("Editar punto 2", { exact: true }).click();
  await page.getByRole("button", { name: "Dividir aquí" }).click();
  expect((await state(page)).draft).toHaveLength(2);
  await page
    .getByRole("button", { name: "Exportar a GPX", exact: true })
    .click();
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
  expect(d.projects).toHaveLength(0);
  expect(d.segments[0].points[0].ele).toBe(1160);
  expect(parsed.tracks).toEqual(d.draft.map((element) => element.points));
  await page.reload();
  await pinLibraries(page);
  expect((await state(page)).draft).toEqual(d.draft);
  expect((await state(page)).draft).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("dibujo libre, recorte, eliminación, nuevo segmento y copia recuperable", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();

  const map = page.locator(".workspace-map");
  await map.click({ position: { x: 500, y: 300 } });
  await map.click({ position: { x: 550, y: 320 } });
  await map.click({ position: { x: 600, y: 340 } });
  await map.click({ position: { x: 650, y: 360 } });

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

  await page.getByTitle("Editar punto 1", { exact: true }).click();
  await page
    .getByRole("button", { name: "Eliminar punto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar segmento", exact: true })
    .click();
  const unsaved = await state(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar segmento", exact: true })
    .click();
  const before = await state(page);
  expect(before.segments).toHaveLength(unsaved.segments.length + 1);
  expect(before.segments.at(-1).points).toEqual(before.draft[0].points);
  await showLibrary(page, "route");
  await page
    .locator(".sidebar-footer summary", { hasText: "Copias de seguridad" })
    .click();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia completa" }).click();
  const download = await promise;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(backup).toEqual(before);
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles(await download.path());
  await expect(page.getByText(/Copia añadida sin borrar/)).toBeVisible();
  await persisted(page);
  const d = await state(page);
  expect(d.draft).toHaveLength(before.draft.length + backup.draft.length);
  expect(d.draft.slice(0, before.draft.length)).toEqual(before.draft);
  expect(d.draft.at(-1).points).toEqual(backup.draft[0].points);
  expect(d.draft.at(-1).id).not.toBe(backup.draft[0].id);
  expect(d.routes.slice(0, before.routes.length)).toEqual(before.routes);
  expect(d.routes).toHaveLength(before.routes.length + backup.routes.length);
  expect(d.segments.slice(0, before.segments.length)).toEqual(before.segments);
  expect(d.segments).toHaveLength(
    before.segments.length + backup.segments.length,
  );
  expect(d.projects).toHaveLength(
    before.projects.length + backup.projects.length + 1,
  );
  expect(d.projects.at(-1).elements[0].points).toEqual(backup.draft[0].points);
  await page.reload();
  await pinLibraries(page);
  expect((await state(page)).draft).toEqual(d.draft);
  expect((await state(page)).draft).toHaveLength(2);
});

test("snapshots anteriores intactos al editar, limpiar, recargar y añadir copia JSON", async ({
  page,
}) => {
  await ready(page);
  await page.locator("input[type=file]").first().setInputFiles(fixture);
  await sendLibraryItem(page, "route", -1);
  await persisted(page);
  // Simula datos de la versión anterior en IndexedDB, no una biblioteca vacía.
  const legacy = await page.evaluate(async () => {
    const { loadWorkspace, saveWorkspace } =
      await import("/src/utils/localStore.js");
    const data = await loadWorkspace();
    data.projects = [
      {
        id: "snapshot-antiguo",
        name: "Versión multitramos",
        createdAt: "2025-01-01T10:00:00.000Z",
        elements: structuredClone(data.draft),
      },
      {
        id: "snapshot-incompleto",
        name: "Versión sin terminar",
        createdAt: "2025-01-02T10:00:00.000Z",
        elements: [{ id: "tramo-incompleto", name: "Pendiente", points: [] }],
      },
    ];
    await saveWorkspace(data);
    return data;
  });
  await page.reload();
  await pinLibraries(page);
  expect(await state(page)).toEqual(legacy);
  await expect(
    page.getByRole("navigation", { name: "Biblioteca" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guardar versión", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Invertir trazado", exact: true })
    .click();
  const edited = await state(page);
  expect(edited.projects).toEqual(legacy.projects);
  expect(edited.routes).toEqual(legacy.routes);
  await page.getByRole("button", { name: "Limpiar mapa", exact: true }).click();
  expect((await state(page)).draft).toEqual([]);
  expect((await state(page)).projects).toEqual(legacy.projects);
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  expect((await state(page)).draft).toEqual(edited.draft);
  await page.reload();
  await pinLibraries(page);
  expect((await state(page)).projects).toEqual(legacy.projects);
  await showLibrary(page, "route");
  await page
    .locator(".sidebar-footer summary", { hasText: "Copias de seguridad" })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia completa" }).click();
  const download = await pending;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(backup.projects).toEqual(legacy.projects);
  expect(backup.draft).toEqual(edited.draft);
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles(await download.path());
  await expect(page.getByText(/Copia añadida sin borrar/)).toBeVisible();
  const restored = await state(page);
  expect(restored.projects.slice(0, legacy.projects.length)).toEqual(
    legacy.projects,
  );
  expect(restored.projects).toHaveLength(
    legacy.projects.length + backup.projects.length + 1,
  );
  expect(restored.routes.slice(0, backup.routes.length)).toEqual(backup.routes);
  expect(restored.segments.slice(0, backup.segments.length)).toEqual(
    backup.segments,
  );
  expect(restored.routes).toHaveLength(backup.routes.length * 2);
  expect(restored.segments).toHaveLength(backup.segments.length * 2);
  expect(restored.draft.slice(0, backup.draft.length)).toEqual(backup.draft);
  expect(restored.draft).toHaveLength(backup.draft.length * 2);
  const importedRoute = restored.routes.at(-1);
  expect(importedRoute.id).not.toBe(backup.routes.at(-1).id);
  expect(importedRoute.originalBase64).toBe(
    backup.routes.at(-1).originalBase64,
  );
  expect(importedRoute.tracks).toEqual(backup.routes.at(-1).tracks);
  const copies = restored.draft.slice(backup.draft.length);
  expect(copies.map((e) => e.points)).toEqual(
    backup.draft.map((e) => e.points),
  );
  expect(copies.every((e) => e.sourceRouteId === importedRoute.id)).toBe(true);
  expect(new Set(copies.map((e) => e.editorRouteId)).size).toBe(1);
  expect(copies[0].editorRouteId).not.toBe(backup.draft[0].editorRouteId);
  const addedProjects = restored.projects.slice(legacy.projects.length);
  for (const [i, project] of addedProjects.entries()) {
    const source =
      i < backup.projects.length ? backup.projects[i].elements : backup.draft;
    expect(project.elements.map((e) => e.points)).toEqual(
      source.map((e) => e.points),
    );
    expect(project.elements.map((e) => e.name)).toEqual(
      source.map((e) => e.name),
    );
    for (const [j, element] of project.elements.entries()) {
      expect(element.id).not.toBe(source[j].id);
      if (source[j].sourceRouteId)
        expect(element.sourceRouteId).toBe(importedRoute.id);
    }
  }
  for (const collection of [
    restored.routes,
    restored.segments,
    restored.projects,
    restored.draft,
  ]) {
    expect(new Set(collection.map((e) => e.id)).size).toBe(collection.length);
  }
  // Las copias recuperadas se abren y se pueden editar; los snapshots no cambian.
  await expect(
    page
      .getByRole("tablist", { name: "Rutas cargadas en el editor" })
      .getByRole("tab", { selected: true }),
  ).toContainText(copies[0].name.replace(/ · tramo \d+$/, ""));
  await page
    .getByRole("button", { name: "Invertir trazado", exact: true })
    .click();
  const final = await state(page);
  expect(final.draft.find((e) => e.id === copies[0].id).points).toEqual(
    [...copies[0].points].reverse(),
  );
  expect(final.projects).toEqual(restored.projects);
  await page.reload();
  await pinLibraries(page);
  expect(await state(page)).toEqual(final);
  await showLibrary(page, "route");
  await page
    .locator(".sidebar-footer summary", { hasText: "Copias de seguridad" })
    .click();
  const roundtrip = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia completa" }).click();
  expect(
    JSON.parse(await readFile(await (await roundtrip).path(), "utf8")),
  ).toEqual(final);
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

test("importar ruta y guardar segmento conserva selección fuera del filtro geográfico", async ({
  page,
}) => {
  await ready(page);
  await showLibrary(page, "segment");
  await page.getByRole("checkbox", { name: /Mostrar Subida/ }).check();
  const beforeImport = await state(page);
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
  expect((await state(page)).draft).toEqual(beforeImport.draft);
  await showLibrary(page, "segment");
  await expect(
    page.getByRole("checkbox", { name: /Mostrar Subida/ }),
  ).toBeChecked();
  await page.getByText(/Buscar y filtrar segmentos/).click();
  await page
    .getByText("Más filtros: distancia, desnivel y zona", { exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Solo segmentos que cruzan el mapa visible",
    })
    .check();
  await expect(
    page.getByRole("heading", { name: /Camino de la ladera/ }),
  ).toHaveCount(0);
  await sendLibraryItem(page, "route", -1);
  await page
    .getByRole("button", { name: "Guardar segmento", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Guardar segmento",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Guardar segmento", exact: true })
    .click();
  await persisted(page);
  const d = await state(page);
  expect(d.routes).toHaveLength(2);
  expect(d.segments).toHaveLength(4);
  expect(d.routes.at(-1).original).toContain("Zona lejana");
  expect(d.segments.at(-1).points).toEqual(d.routes.at(-1).tracks[0]);
});

test("borrador vacío recuperable y exportación incompleta bloqueada", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();
  await page.getByRole("button", { name: "Terminar dibujo" }).click();
  await persisted(page);
  const before = await state(page);
  expect(before.draft).toHaveLength(1);
  expect(before.draft[0].points).toEqual([]);
  await page.reload();
  await pinLibraries(page);
  expect((await state(page)).draft).toEqual(before.draft);
  expect((await state(page)).draft).toHaveLength(1);
  await page
    .getByRole("button", { name: "Exportar a GPX", exact: true })
    .click();
  await expect(page.getByText(/necesita al menos dos puntos/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar GPX", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cerrar revisión" }).click();
  expect((await state(page)).draft).toEqual(before.draft);
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
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await pinLibraries(page);
    const card = page
      .locator(".viewer-route-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Original con codificación",
          exact: true,
        }),
      })
      .last();
    await card.getByRole("checkbox").check();
    const promise = page.waitForEvent("download");
    await card
      .getByRole("button", { name: "Descargar GPX", exact: true })
      .click();
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
