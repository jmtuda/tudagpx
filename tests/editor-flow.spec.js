import { test, expect } from "@playwright/test";
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function clickTrace(page, selector) {
  const position = await page
    .locator(selector)
    .first()
    .evaluate((path) => {
      const point = path.getPointAtLength(path.getTotalLength() / 2);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(
        path.getScreenCTM(),
      );
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(position.x, position.y);
}
for (const width of [1440, 390]) {
  test(`editor vacío, BRouter inicial y barra superior en ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() => {
      localStorage.setItem("tudagpx-routing-mode", "free");
      localStorage.setItem("tudagpx-routing-mode-v2", "free");
    });
    await page.goto("/");
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    const toolbar = page.getByRole("toolbar", {
      name: "Herramientas del mapa",
    });
    await expect(toolbar).toBeVisible();
    const map = await page.locator(".workspace-map").boundingBox();
    const bar = await toolbar.boundingBox();
    expect(bar.y - map.y).toBeLessThanOrEqual(12);
    expect(bar.width).toBeGreaterThan(bar.height);
    await expect(
      page.getByLabel("Seguir caminos", { exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel("Actividad para seguir caminos")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", {
        name: "Permitir cálculo con BRouter",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Retirar permiso", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mover mapa", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    for (const name of ["Guardar ruta", "Guardar segmento", "Limpiar mapa"])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
    await page
      .getByRole("button", { name: "Abrir rutas y segmentos", exact: true })
      .click();
    await expect(
      page.getByRole("navigation", { name: "Biblioteca", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/Ciclismo de/)).toHaveCount(0);
    const library = page.getByRole("navigation", {
      name: "Biblioteca",
      exact: true,
    });
    await expect(library.getByRole("button")).toHaveCount(2);
    for (const name of ["Segmentos", "Rutas"])
      await expect(
        library.getByRole("button", { name: new RegExp("^" + name) }),
      ).toBeVisible();
    for (const name of ["Borrador", "Proyectos"])
      await expect(
        library.getByRole("button", { name: new RegExp("^" + name) }),
      ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Segmentos de la zona" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Mueve el mapa para explorar.", { exact: false }),
    ).toHaveCount(0);
    await page.getByText("Buscar y filtrar", { exact: true }).click();
    await expect(page.getByLabel("Filtrar ciclismo")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("editor-inicial.png") });
  });
  test(`abrir segmento con clic, guardar y limpiar sin borrar originales en ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await page
      .getByRole("button", { name: "Abrir rutas y segmentos", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Biblioteca", exact: true })
      .getByRole("button", { name: /^Segmentos/ })
      .click();
    const before = await state(page);
    await page.getByRole("checkbox", { name: /Seleccionar Subida/ }).check();
    await page
      .getByRole("button", { name: "Editar trazado", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Minimizar herramientas", exact: true })
      .click();
    await expect(page.locator("path.editor-segment-reference")).toHaveCount(1);
    await page.getByRole("button", { name: "Ocultar panel de rutas", exact: true }).click();
    await page.getByRole("button", { name: "Minimizar perfil de altitud", exact: true }).click();
    await clickTrace(page, "path.editor-segment-reference");
    await expect(page.locator("path.draft-line")).toHaveCount(1);
    await expect(page.locator("path.editor-segment-reference")).toHaveCount(0);
    const opened = await state(page);
    expect(opened.draft[0].points).toEqual(before.segments[0].points);
    expect(opened.segments).toEqual(before.segments);
    await page
      .getByRole("button", { name: "Editar trazado", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Minimizar herramientas", exact: true })
      .click();
    await clickTrace(page, "path.draft-line");
    await expect(page.locator("path.draft-line")).toHaveCount(1);
    expect((await state(page)).draft).toEqual(opened.draft);
    await page
      .getByRole("button", { name: "Guardar ruta", exact: true })
      .click();
    await expect(page.locator(".notice")).toContainText(
      "Nueva ruta guardada en la biblioteca.",
    );
    const savedRoute = await state(page);
    expect(savedRoute.routes).toHaveLength(before.routes.length + 1);
    expect(savedRoute.routes.slice(0, -1)).toEqual(before.routes);
    expect(savedRoute.routes.at(-1).tracks).toEqual([opened.draft[0].points]);
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Guardar segmento",
      exact: true,
    });
    await dialog.getByLabel("Nombre del segmento").fill("Mi segmento guardado");
    await dialog
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    const saved = await state(page);
    expect(saved.segments.at(-1).name).toBe("Mi segmento guardado");
    expect(saved.segments.slice(0, -1)).toEqual(before.segments);
    await page.screenshot({ path: testInfo.outputPath("editor-abierto.png") });
    await page
      .getByRole("button", { name: "Limpiar mapa", exact: true })
      .click();
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    await expect(page.locator(".trace-endpoint")).toHaveCount(0);
    const cleared = await state(page);
    expect(cleared.draft).toEqual([]);
    expect(cleared.routes).toEqual(saved.routes);
    expect(cleared.segments).toEqual(saved.segments);
    expect(cleared.projects).toEqual(saved.projects);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(saved.draft);
    await expect(page.locator("path.draft-line")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Limpiar mapa", exact: true })
      .click();
    await state(page);
    await page.reload();
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    expect((await state(page)).routes).toEqual(saved.routes);
  });
}
