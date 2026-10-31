import { sendLibraryItem } from "./helpers/library";
import { test, expect } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`panel fijo, fichas compactas y mapas reales en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    const panel = page.locator("#library-panel");
    await expect(panel).toBeVisible();
    const map = await page.locator(".workspace-map").boundingBox();
    const sidebar = await panel.boundingBox();
    if (width <= 650) {
      expect(map.width).toBe(width);
      expect(sidebar.y).toBeGreaterThan(map.y + map.height);
      expect(sidebar.width).toBe(width);
    } else {
      expect(map.width).toBeLessThan(width);
      expect(map.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 1);
    }
    for (const name of [
      "Mostrar panel de rutas",
      "Ocultar panel de rutas",
      "Fijar panel de rutas",
      "Desfijar panel de rutas",
    ])
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
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
    await expect(card.getByRole("button")).toHaveCount(1);
    await expect(
      card.getByRole("button", { name: "Enviar al editor", exact: true }),
    ).toBeVisible();
    await expect(card).toContainText("subida");
    await expect(card).toContainText("bajada");
    await card.getByRole("checkbox").check();
    const actions = card.locator(".catalog-actions");
    await expect(actions.getByRole("button")).toHaveCount(4);
    await expect(
      actions.getByRole("button", { name: /^Editar nombre de/ }),
    ).toBeVisible();
    await expect(
      actions.getByRole("button", { name: /^Borrar / }),
    ).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "Descargar GPX", exact: true }),
    ).toBeVisible();
    await expect(
      actions
        .getByRole("button", { name: "Descargar GPX", exact: true })
        .locator("svg"),
    ).toHaveCount(1);
    const boxes = await actions
      .getByRole("button")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().y),
      );
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThanOrEqual(1);
    await card.getByRole("checkbox").uncheck();
    await expect(card.locator(".card-actions")).toHaveCount(0);
    await expect(card.getByRole("button")).toHaveCount(1);
    await expect(
      card.getByRole("button", { name: "Enviar al editor", exact: true }),
    ).toBeVisible();
    await page.getByText(/Buscar y filtrar rutas/).click();
    await page.getByLabel("Buscar rutas por nombre").fill("no coincide");
    await expect(page.locator(".viewer-route-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator(".viewer-route-card")).toHaveCount(1);
    await sendLibraryItem(page, "segment", 0);
    await expect(panel).toHaveCount(0);
    expect((await page.locator(".workspace-map").boundingBox()).width).toBe(
      width,
    );
    await expect(page.locator("path.draft-line")).toHaveCount(1);
    await expect(
      page
        .getByRole("tablist", { name: "Rutas cargadas en el editor" })
        .getByRole("tab"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Guardar ruta", exact: true }),
    ).toBeEnabled();
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

test("biblioteca fija táctil conserva selección al tocar mapa y editor ocupa todo el ancho", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.locator("#library-panel")).toBeVisible();
    const check = page
      .locator(".viewer-route-card")
      .first()
      .getByRole("checkbox");
    await check.check();
    const map = await page.locator(".workspace-map").boundingBox();
    await page.mouse.click(map.x + map.width - 10, map.y + 100);
    await expect(page.locator("#library-panel")).toBeVisible();
    await expect(check).toBeChecked();
    await sendLibraryItem(page, "route", 0);
    await expect(page.locator("#library-panel")).toHaveCount(0);
    expect((await page.locator(".workspace-map").boundingBox()).width).toBe(
      390,
    );
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).tap();
    await expect(page.locator("#library-panel")).toBeVisible();
    await expect(check).toBeChecked();
  } finally {
    await context.close();
  }
});
