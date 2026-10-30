import { test, expect } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`panel dock, fichas compactas y mapas reales en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    const panel = page.locator("#library-panel");
    const edge = page.getByRole("button", {
      name: "Mostrar panel de rutas",
      exact: true,
    });
    await expect(panel).toBeHidden();
    expect((await page.locator(".workspace-map").boundingBox()).width).toBe(
      width,
    );
    await expect(page.getByLabel("Cartografía")).toHaveCount(0);
    await expect
      .poll(
        () =>
          page
            .locator(".leaflet-tile-loaded")
            .evaluateAll(
              (imgs) =>
                imgs.filter(
                  (i) => i.src.includes("pnoa-ma") && i.naturalWidth > 0,
                ).length,
            ),
        { timeout: 30000 },
      )
      .toBeGreaterThan(0);
    await edge.hover();
    await expect(panel).toBeVisible();
    await page.mouse.move(width - 30, 450);
    await expect(panel).toBeHidden();
    await edge.hover();
    await page
      .getByRole("button", { name: "Fijar panel de rutas", exact: true })
      .click();
    await page.mouse.move(width - 30, 450);
    await expect(panel).toBeVisible();
    await expect(
      page.getByText("EXPLORAR Y COMPARAR RUTAS", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Biblioteca de rutas" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Buscar rutas por nombre")).toBeHidden();
    const card = page.locator(".viewer-route-card").first();
    await expect(card.locator(".profile")).toHaveCount(0);
    await expect(card.locator(".tags")).toHaveCount(0);
    await expect(card.locator(".card-actions")).toHaveCount(0);
    await expect(card).toContainText("subida");
    await expect(card).toContainText("bajada");
    await card.getByRole("checkbox").check();
    await expect(
      card.getByRole("button", { name: "Enviar al editor" }),
    ).toBeVisible();
    await card.getByRole("checkbox").uncheck();
    await expect(card.locator(".card-actions")).toHaveCount(0);
    await page.getByText(/Buscar y filtrar rutas/).click();
    await page.getByLabel("Buscar rutas por nombre").fill("no coincide");
    await expect(page.locator(".viewer-route-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator(".viewer-route-card")).toHaveCount(1);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(panel).toBeHidden();
    await edge.click();
    await page
      .getByRole("button", { name: "Fijar panel de rutas", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir segmento", exact: true })
      .first()
      .click();
    await expect(page.locator("path.draft-line")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Desfijar panel de rutas", exact: true })
      .click();
    await page.mouse.move(width - 30, 450);
    await expect(panel).toBeHidden();
    await expect(page.locator("path.draft-line")).toHaveCount(1);
    await edge.click();
    await expect(page.getByRole("tablist", { name: "Rutas cargadas en el editor" }).getByRole("tab")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Guardar ruta", exact: true })).toBeEnabled();
    await page
      .getByRole("button", { name: "Ocultar panel de rutas", exact: true })
      .click();
    for (const value of ["ign_base", "mtn", "osm", "pnoa_orto"]) {
      await page
        .getByRole("button", { name: "Seleccionar mapa", exact: true })
        .click();
      await expect(page.getByLabel("Cartografía")).toHaveValue(
        value === "ign_base"
          ? "pnoa_orto"
          : value === "mtn"
            ? "ign_base"
            : value === "osm"
              ? "mtn"
              : "osm",
      );
      await page.getByLabel("Cartografía").selectOption(value);
      await expect(page.getByLabel("Cartografía")).toHaveCount(0);
      const source = {
        ign_base: "ign-base",
        mtn: "mapa-raster",
        osm: "tile.openstreetmap.org",
        pnoa_orto: "pnoa-ma",
      }[value];
      await expect
        .poll(
          () =>
            page
              .locator(".leaflet-tile-loaded")
              .evaluateAll(
                (imgs, source) =>
                  imgs.filter(
                    (i) => i.src.includes(source) && i.naturalWidth > 0,
                  ).length,
                source,
              ),
          { timeout: 30000 },
        )
        .toBeGreaterThan(0);
      await expect(page.locator("path.draft-line")).toHaveCount(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("abrir el borde mediante pantalla táctil y cerrar tocando el mapa", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Mostrar panel de rutas", exact: true })
    .tap();
  await expect(page.locator("#library-panel")).toBeVisible();
  await page.locator(".workspace-map").tap({ position: { x: 380, y: 300 } });
  await expect(page.locator("#library-panel")).toBeHidden();
  await context.close();
});
