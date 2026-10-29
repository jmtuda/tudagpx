import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`ocultar y recuperar panel sin perder selección ni borrador en ${viewport.width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    const choice = page.getByRole("checkbox", { name: /Seleccionar Subida/ });
    await choice.check();
    await page
      .getByRole("button", { name: "Añadir 1 seleccionados al borrador" })
      .click();
    const map = page.locator(".workspace-map");
    const before = await map.boundingBox();
    const paths = await page.locator(".leaflet-overlay-pane path").count();
    await page.getByRole("button", { name: "Ocultar panel de rutas" }).click();
    const show = page.getByRole("button", { name: "Mostrar panel de rutas" });
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#library-panel")).toBeHidden();
    await expect
      .poll(async () => (await map.boundingBox()).width)
      .toBe(viewport.width);
    const expanded = await map.boundingBox();
    expect(expanded.x).toBe(0);
    if (viewport.width > 650)
      expect(expanded.width).toBeGreaterThan(before.width);
    else expect(expanded.height).toBeGreaterThan(before.height);
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(paths);
    await expect(page.getByLabel("Cartografía")).toBeVisible();
    await show.click();
    await expect(
      page.getByRole("heading", { name: "Tu borrador libre" }),
    ).toBeVisible();
    await expect(page.locator(".draft-card")).toHaveCount(1);
    await page.getByRole("button", { name: /^Segmentos/ }).click();
    await expect(choice).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Ocultar panel de rutas" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
