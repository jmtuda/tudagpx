import { test, expect } from "@playwright/test";
import { sendLibraryItem, showLibrary } from "./helpers/library";

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
    await expect(page.locator(".bottom-bar")).toHaveCount(0);
    const viewerProfile = await page
      .getByRole("region", { name: "Perfil de altitud", exact: true })
      .boundingBox();
    const viewerMap = await page.locator(".workspace-map").boundingBox();
    expect(viewerMap.y + viewerMap.height).toBeCloseTo(viewerProfile.y, 0);
    const viewerPanel = await page.locator("#library-panel").boundingBox();
    if (viewport.width <= 650) {
      expect(viewerPanel.y).toBeCloseTo(
        viewerProfile.y + viewerProfile.height,
        0,
      );
      expect(viewerPanel.y + viewerPanel.height).toBeCloseTo(
        viewport.height,
        0,
      );
      expect(viewerPanel.width).toBe(viewport.width);
    } else {
      expect(viewerProfile.y + viewerProfile.height).toBeCloseTo(
        viewport.height,
        0,
      );
      expect(viewerMap.x).toBeCloseTo(viewerPanel.x + viewerPanel.width, 0);
    }
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("#library-panel")).toBeHidden();
    await expect(page.locator(".map-toolbar")).toHaveCount(0);
    const header = await page.locator(".topbar").boundingBox();
    await expect(page.locator(".bottom-bar")).toHaveCount(0);
    const profile = await page
      .getByRole("region", { name: "Perfil de altitud", exact: true })
      .boundingBox();
    const map = await page.locator(".workspace-map").boundingBox();
    expect(header.height).toBeLessThanOrEqual(52);
    expect(map.y).toBeCloseTo(header.height, 0);
    expect(map.y + map.height).toBeCloseTo(profile.y, 0);
    expect(profile.y + profile.height).toBeCloseTo(viewport.height, 0);
    await page
      .getByRole("button", { name: "Minimizar perfil de altitud", exact: true })
      .click();
    const expandedMap = await page.locator(".workspace-map").boundingBox();
    const output = page
      .getByRole("toolbar", { name: "Herramientas del mapa" })
      .getByRole("group", { name: "Guardar y exportar", exact: true });
    await expect(
      output.getByRole("button", { name: "Exportar a GPX", exact: true }),
    ).toBeVisible();
    expect((await output.boundingBox()).y).toBeLessThan(
      expandedMap.y + expandedMap.height / 2,
    );
    if (viewport.width > 650)
      expect(expandedMap.height).toBeGreaterThanOrEqual(viewport.height - 100);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "+ Importar GPX" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Biblioteca", exact: true }),
    ).toHaveCount(0);
    expect((await page.locator(".workspace-map").boundingBox()).width).toBe(
      viewport.width,
    );
    await showLibrary(page, "route");
    const nav = page.getByRole("navigation", {
      name: "Biblioteca",
      exact: true,
    });
    await expect(nav.getByRole("button")).toHaveCount(2);
    for (const section of ["Rutas", "Segmentos"]) {
      await nav
        .getByRole("button", { name: new RegExp(`^${section}`) })
        .click();
      await expect(page.locator("#library-panel")).toBeVisible();
      await expect(
        page.getByRole("toolbar", { name: "Herramientas del mapa" }),
      ).toHaveCount(0);
    }
    await sendLibraryItem(page, "segment", 0);
    await expect(
      page
        .getByRole("tablist", { name: "Rutas cargadas en el editor" })
        .getByRole("tab"),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Exportar a GPX", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Revisión GPX" }),
    ).toBeVisible();
  });
}
