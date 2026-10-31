import { test, expect } from "@playwright/test";
import { pinLibraries } from "./helpers/library";

for (const viewport of [
  { width: 1440, height: 950 },
  { width: 1280, height: 577 },
  { width: 390, height: 844 },
]) {
  test(`barra única con iconos y cuadros mínimos ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("tudagpx-workspace", "edit");
      localStorage.setItem("tudagpx-routing-mode-v3", "free");
    });
    await page.goto("/");
    await pinLibraries(page);
    await page
      .getByRole("button", { name: "Abrir segmento", exact: true })
      .first()
      .click();
    const toolbar = page.getByRole("toolbar", {
      name: "Herramientas del mapa",
    });
    const options = page.getByRole("region", { name: "Opciones del editor" });
    await expect(options.locator("select")).toHaveCount(0);
    await expect(options.locator("input")).toHaveCount(2);
    await expect(
      options.getByLabel("Nombre del tramo", { exact: true }),
    ).toBeVisible();
    await expect(
      options.getByLabel("Seguir caminos", { exact: true }),
    ).toBeVisible();
    for (const name of [
      "Guardar ruta",
      "Guardar segmento",
      "Exportar a GPX",
      "Limpiar mapa",
      "Invertir trazado",
    ]) {
      const button = toolbar.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      await expect(button.locator("svg")).toHaveCount(1);
      expect(await button.evaluate((node) => node.innerText.trim())).toBe("");
    }
    await toolbar
      .getByRole("button", { name: "Recortar trazado", exact: true })
      .click();
    await expect(options.locator("select, svg, input[type=range]")).toHaveCount(
      0,
    );
    await expect(
      options.getByLabel("Nombre del nuevo segmento", { exact: true }),
    ).toBeVisible();
    await expect(options.locator(".crop-metrics")).toHaveCount(0);
    const profile = page.getByRole("region", {
      name: "Perfil de altitud",
      exact: true,
    });
    await expect(
      profile.getByLabel("Inicio del recorte", { exact: true }),
    ).toBeVisible();
    await expect(
      profile.getByLabel("Final del recorte", { exact: true }),
    ).toBeVisible();
    const before = await page.evaluate(async () =>
      (await import("/src/utils/localStore.js")).loadWorkspace(),
    );
    await toolbar
      .getByRole("button", { name: "Cancelar recorte", exact: true })
      .click();
    await expect(
      profile.getByLabel("Inicio del recorte", { exact: true }),
    ).toHaveCount(0);
    const after = await page.evaluate(async () =>
      (await import("/src/utils/localStore.js")).loadWorkspace(),
    );
    expect(after.draft).toEqual(before.draft);
    expect(after.routes).toEqual(before.routes);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("toolbar.png") });
  });
}
