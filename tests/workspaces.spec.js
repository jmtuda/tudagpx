import { test, expect } from "@playwright/test";
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
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Editar copia", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Revisar y exportar →" }),
    ).toHaveCount(0);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Editar rutas", exact: false }),
    ).toHaveCount(0);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await page.getByRole("checkbox", { name: /Mostrar Vuelta/ }).check();
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(2);
    const before = await state(page);
    await page.getByLabel("Buscar rutas por nombre").fill("ruta DE PRUEBA");
    await expect(page.locator(".library-card")).toHaveCount(1);
    await page
      .getByLabel("Tipo de ciclismo", { exact: true })
      .selectOption("Gravel");
    await expect(page.locator(".library-card")).toHaveCount(0);
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(2);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page
      .getByText("Más filtros: distancia, desnivel y zona", { exact: true })
      .click();
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
    await page
      .getByRole("button", { name: "Editar copia", exact: true })
      .last()
      .click();
    await expect(page.locator(".draft-card")).toHaveCount(2);
    const draft = (await state(page)).draft;
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(page.locator(".anchor-handle")).toHaveCount(0);
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(2);
    await page.getByRole("button", { name: "Ocultar panel de rutas" }).click();
    await expect
      .poll(
        async () => (await page.locator(".workspace-map").boundingBox()).width,
      )
      .toBe(viewport.width);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("path.draft-line")).toHaveCount(2);
    await expect(page.locator(".anchor-handle")).toHaveCount(4);
    await page.getByRole("button", { name: "Mostrar panel de rutas" }).click();
    expect((await state(page)).draft).toEqual(draft);
    await page.getByRole("button", { name: /^Segmentos/ }).click();
    await page
      .getByRole("button", { name: "+ Borrador", exact: true })
      .first()
      .click();
    await expect(page.locator(".draft-card")).toHaveCount(3);
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
  await page
    .getByText("Más filtros: distancia, desnivel y zona", { exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Solo rutas que cruzan el mapa visible" })
    .check();
  await page.getByLabel("Cartografía").selectOption("osm");
  await expect(
    page.getByRole("checkbox", { name: /Mostrar Vuelta/ }),
  ).toBeChecked();
});
