import { test, expect } from "@playwright/test";
import {
  pinLibraries,
  sendViewerRoute,
  sendLibraryItem,
} from "./helpers/library";
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}

for (const viewport of [
  { width: 1440, height: 950 },
  { width: 390, height: 844 },
]) {
  test(`dos espacios independientes, filtros y superposición en ${viewport.width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(viewport);
    await page.goto("/");
    await pinLibraries(page);
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Editar copia", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Exportar a GPX", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Editar rutas", exact: false }),
    ).toHaveCount(0);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await page.getByRole("checkbox", { name: /Mostrar Vuelta/ }).check();
    await expect(page.locator("path.viewer-route-selected")).toHaveCount(2);
    const before = await state(page);
    await expect(
      page.getByLabel("Distancia mínima (km)", { exact: true }),
    ).toBeHidden();
    await page.getByText(/Buscar y filtrar rutas/).click();
    for (const label of [
      "Distancia mínima (km)",
      "Distancia máxima (km)",
      "Desnivel mínimo (m)",
      "Desnivel máximo (m)",
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator(".all-route-filters details")).toHaveCount(0);
    await expect(page.locator(".all-route-filters select")).toHaveCount(0);
    await expect(page.getByText(/que cruzan el mapa visible/)).toHaveCount(0);
    await expect(page.getByText(/El desnivel es el acumulado/)).toHaveCount(0);
    await page.getByLabel("Buscar rutas por nombre").fill("ruta DE PRUEBA");
    await expect(page.locator(".library-card")).toHaveCount(1);
    await page.getByLabel("Buscar rutas por nombre").fill("inexistente");
    await expect(page.locator(".library-card")).toHaveCount(0);
    await expect(page.locator("path.viewer-route-selected")).toHaveCount(2);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();

    for (const label of ["Distancia mínima (km)", "Desnivel mínimo (m)"]) {
      await page.getByLabel(label, { exact: true }).fill("1000000");
      await expect(page.locator(".library-card")).toHaveCount(0);
      await page.getByLabel(label, { exact: true }).fill("");
    }
    await page.getByLabel("Distancia máxima (km)", { exact: true }).fill("0");
    await expect(page.locator(".library-card")).toHaveCount(0);
    await page.getByLabel("Distancia máxima (km)", { exact: true }).fill("");
    await page.getByLabel("Desnivel máximo (m)", { exact: true }).fill("0");
    await expect(page.locator(".library-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    expect((await state(page)).draft).toEqual(before.draft);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("path.viewer-route")).toHaveCount(0);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(
      page.getByText(
        "Usa «Enviar al editor» desde «Ver rutas» o arrastra aquí un GPX.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await sendViewerRoute(page, -1);
    expect((await state(page)).draft).toHaveLength(2);
    await expect(
      page
        .getByRole("tablist", { name: "Rutas cargadas en el editor" })
        .getByRole("tab"),
    ).toHaveCount(1);
    const draft = (await state(page)).draft;
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(page.locator(".anchor-handle")).toHaveCount(0);
    await expect(page.locator("path.viewer-route-selected")).toHaveCount(2);
    await expect(page.locator("#library-panel")).toBeVisible();
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("path.draft-line")).toHaveCount(2);
    // Con el perfil también en el visor, el encuadre móvil inicial tiene menos
    // escala. Acercar separa las cuatro anclas (>38 px) sin simplificar el GPX.
    if (viewport.width <= 650)
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.locator(".anchor-handle")).toHaveCount(4);
    await expect(page.locator("#library-panel")).toHaveCount(0);
    expect((await state(page)).draft).toEqual(draft);

    await sendLibraryItem(page, "segment", 0);
    expect((await state(page)).draft).toHaveLength(3);
    await expect(
      page
        .getByRole("tablist", { name: "Rutas cargadas en el editor" })
        .getByRole("tab"),
    ).toHaveCount(2);
    const final = (await state(page)).draft;
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect((await state(page)).draft).toEqual(final);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("filtros geográficos por cruce, límites numéricos y selección fuera del filtro", async ({
  page,
}) => {
  await page.goto("/");
  await pinLibraries(page);
  const result = await page.evaluate(async () => {
    const { filterRoutes, emptyRouteFilters } =
      await import("/src/utils/routeFilters.js");
    const { stats } = await import("/src/utils/workspace.js");
    const crossing = {
      id: "cruce",
      name: "Cruce",
      sport: "MTB",
      tracks: [
        [
          { lat: 0, lon: -2, ele: 10 },
          { lat: 0, lon: 2, ele: 30 },
        ],
      ],
    };
    const outside = {
      id: "fuera",
      name: "Fuera",
      sport: "Gravel",
      tracks: [
        [
          { lat: 40, lon: 0, ele: 0 },
          { lat: 41, lon: 0, ele: 10 },
        ],
      ],
    };
    const bounds = { south: -1, north: 1, west: -1, east: 1 };
    const km = stats(crossing.tracks).km;
    const run = (f) =>
      filterRoutes(
        [crossing, outside],
        { ...emptyRouteFilters, ...f },
        bounds,
      ).map((r) => r.id);
    return {
      geo: run({ inView: true }),
      name: run({ name: " crUCE " }),
      sport: run({ sport: "Gravel" }),
      minimum: run({ minKm: String(km), inView: true }),
      maximum: run({ maxKm: String(km), inView: true }),
      ascent: run({ minAscent: "20", maxAscent: "20" }),
      invalid: run({ minKm: "-1" }),
      inverted: run({ minKm: "10", maxKm: "1" }),
    };
  });
  expect(result).toEqual({
    geo: ["cruce"],
    name: ["cruce"],
    sport: ["fuera"],
    minimum: ["cruce"],
    maximum: ["cruce"],
    ascent: ["cruce"],
    invalid: [],
    inverted: [],
  });
  await page.getByRole("checkbox", { name: /Mostrar Vuelta/ }).check();
  await page.getByText(/Buscar y filtrar rutas/).click();
  await page.getByLabel("Buscar rutas por nombre").fill("inexistente");
  await page
    .getByRole("button", { name: "Seleccionar mapa", exact: true })
    .click();
  await page.getByLabel("Cartografía").selectOption("osm");
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Mostrar Vuelta/ }),
  ).toBeChecked();
});
