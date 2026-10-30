import { test, expect } from "@playwright/test";
import { pinLibraries } from "./helpers/library";

for (const viewport of [
  { width: 1280, height: 577 },
  { width: 1440, height: 950 },
  { width: 390, height: 844 },
]) {
  test(`mapa ampliado y barras compactas en ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("#library-panel")).toBeHidden();
    await expect(page.locator(".map-toolbar")).toHaveCount(0);
    const header = await page.locator(".topbar").boundingBox();
    const footer = await page.locator(".bottom-bar").boundingBox();
    const map = await page.locator(".workspace-map").boundingBox();
    expect(header.height).toBeLessThanOrEqual(52);
    expect(footer.height).toBeLessThanOrEqual(48);
    expect(map.y).toBeCloseTo(header.height, 0);
    expect(map.y + map.height).toBeCloseTo(footer.y, 0);
    if (viewport.width > 650)
      expect(map.height).toBeGreaterThanOrEqual(viewport.height - 100);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "+ Importar GPX" }),
    ).toBeVisible();
    await pinLibraries(page);
    const nav = page.getByRole("navigation", { name: "Biblioteca", exact: true });
    await expect(nav.getByRole("button")).toHaveCount(2);
    for (const section of ["Rutas", "Segmentos"]) {
      await nav.getByRole("button", { name: new RegExp(`^${section}`) }).click();
      for (const action of ["Guardar ruta", "Guardar segmento", "Limpiar mapa"]) {
        await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
      }
    }
    await page.getByRole("button", { name: "Abrir segmento", exact: true }).first().click();
    await expect(page.getByRole("tablist", { name: "Rutas cargadas en el editor" }).getByRole("tab")).toHaveCount(1);
    await page.getByRole("button", { name: "Revisar y exportar →" }).click();
    await expect(
      page.getByRole("dialog", { name: "Revisión GPX" }),
    ).toBeVisible();
  });
}
