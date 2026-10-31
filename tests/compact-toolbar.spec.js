import { test, expect } from "@playwright/test";
import { pinLibraries, sendLibraryItem } from "./helpers/library";

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
    await sendLibraryItem(page, "segment", 0);
    const toolbar = page.getByRole("toolbar", {
      name: "Herramientas del mapa",
    });
    const options = page.getByRole("region", { name: "Opciones del editor" });
    await expect(toolbar.getByRole("button").first()).toHaveAccessibleName(
      "+ Dibujar",
    );
    for (const name of [
      "Abrir rutas y segmentos",
      "Información de cálculo",
      "Salir del editor",
    ])
      await expect(
        toolbar.getByRole("button", { name, exact: true }),
      ).toHaveCount(0);
    expect(
      await toolbar.evaluate((node) => {
        const clear = node.querySelector('[aria-label="Limpiar mapa"]');
        const group = clear.nextElementSibling;
        return (
          group.classList.contains("editor-save-actions") &&
          group.firstElementChild.classList.contains("tool-divider") &&
          group.querySelector("button").getAttribute("aria-label") ===
            "Guardar ruta"
        );
      }),
    ).toBe(true);
    await expect(options.locator("select")).toHaveCount(0);
    await expect(options.locator("input")).toHaveCount(1);
    await expect(options.locator('input[type="text"]')).toHaveCount(0);
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
    await expect(options.locator("select, svg, input[type=text]")).toHaveCount(
      0,
    );
    await expect(options.locator("input[type=range]")).toHaveCount(2);
    await expect(options.locator(".crop-metrics")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Perfil de altitud", exact: true }),
    ).toBeVisible();
    await expect(
      options.getByLabel("Inicio del recorte", { exact: true }),
    ).toBeVisible();
    await expect(
      options.getByLabel("Final del recorte", { exact: true }),
    ).toBeVisible();
    const before = await page.evaluate(async () =>
      (await import("/src/utils/localStore.js")).loadWorkspace(),
    );
    await toolbar
      .getByRole("button", { name: "Cancelar recorte", exact: true })
      .click();
    await expect(
      options.getByLabel("Inicio del recorte", { exact: true }),
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
