import { test, expect } from "@playwright/test";
import { pinLibraries, sendLibraryItem } from "./helpers/library";
async function appearance(page, selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        text: node.textContent,
        width: node.offsetWidth,
        height: node.offsetHeight,
        background: css.backgroundColor,
        color: css.color,
        border: css.border,
        radius: css.borderRadius,
        shadow: css.boxShadow,
        font: css.fontSize,
      };
    });
}
for (const width of [1440, 390]) {
  for (const source of ["ruta", "segmento"]) {
    test(`mismos extremos del visor al editar y recortar ${source} en ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/");
      await pinLibraries(page);
      await page
        .locator(".viewer-route-card")
        .first()
        .getByRole("checkbox")
        .check();
      const start = await appearance(page, ".trace-start");
      const end = await appearance(page, ".trace-end");
      await page.getByRole("tab", { name: "Editar", exact: true }).click();
      if (source === "ruta") {
        await sendLibraryItem(page, "route", 0);
      } else await sendLibraryItem(page, "segment", 0);
      expect(await appearance(page, ".trace-start")).toEqual(start);
      expect(await appearance(page, ".trace-end")).toEqual(end);
      await expect(page.locator(".endpoint-handle")).toHaveCount(2);
      const first = page.getByTitle("Editar punto 1", { exact: true });
      await first.click();
      expect(await appearance(page, ".trace-start")).toEqual(start);
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Recortar trazado", exact: true })
        .click();
      expect(await appearance(page, ".trace-start")).toEqual(start);
      expect(await appearance(page, ".trace-end")).toEqual(end);
      await expect(
        page
          .locator(".leaflet-tooltip")
          .filter({ hasText: /^(Inicio|Final)$/ }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Cancelar recorte", exact: true })
        .click();
      await expect(page.locator(".endpoint-handle")).toHaveCount(2);
      const close = page.getByRole("button", {
        name: "Cerrar aviso",
        exact: true,
      });
      if (await close.isVisible()) await close.click();
      await page.screenshot({
        path: testInfo.outputPath("shared-endpoints.png"),
      });
    });
  }
}
