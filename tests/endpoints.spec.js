import { test, expect } from "@playwright/test";
import { pinLibraries } from "./helpers/library";
for (const width of [1440, 390]) {
  test(`inicio y final visibles, inversión y ruta circular en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-workspace", "edit"),
    );
    await page.goto("/");
    await expect(page.locator(".local-status > span")).toHaveText(
      "Guardado en este navegador",
    );
    await page.evaluate(async () => {
      const store = await import("/src/utils/localStore.js");
      const d = await store.loadWorkspace();
      const a = { lat: 40.75, lon: -3.98, ele: 100 },
        b = { lat: 40.751, lon: -3.979, ele: 110 },
        c = { lat: 40.752, lon: -3.978, ele: 120 };
      d.draft = [
        { id: "line", name: "Abierta", points: [a, b, c] },
        { id: "loop", name: "Circular", points: [a, b, c, a] },
      ];
      await store.saveWorkspace(d);
    });
    await page.reload();
    await pinLibraries(page);
    const tabs = page.getByRole("tablist", {
      name: "Rutas cargadas en el editor",
    });
    await tabs.getByRole("tab", { name: "Abierta", exact: true }).click();
    await page.getByRole("button", { name: "Minimizar herramientas" }).click();
    await page.getByRole("button", { name: "Ocultar panel de rutas" }).click();
    await expect(page.locator(".trace-start")).toHaveText("▶");
    await expect(page.locator(".trace-end")).toHaveText("■");
    await expect(page.locator(".trace-endpoint-label")).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: "Inicio de Abierta", exact: true }),
    ).toHaveCount(1);
    const start = await page.locator(".trace-start").getAttribute("style");
    const end = await page.locator(".trace-end").getAttribute("style");
    await page.getByRole("button", { name: "Mover mapa", exact: true }).click();
    await expect(page.locator(".anchor-handle")).toHaveCount(0);
    await expect(page.locator(".trace-start")).toBeVisible();
    await expect(page.locator(".trace-end")).toBeVisible();
    await page
      .getByRole("button", { name: "Editar trazado", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Invertir trazado", exact: true })
      .click();
    const position = (s) => s.match(/translate3d\([^)]+\)/)?.[0];
    expect(
      position(await page.locator(".trace-start").getAttribute("style")),
    ).toEqual(position(end));
    expect(
      position(await page.locator(".trace-end").getAttribute("style")),
    ).toEqual(position(start));
    await tabs.getByRole("tab", { name: "Circular", exact: true }).click();
    await expect(
      page.getByRole("img", { name: "Inicio de Circular", exact: true }),
    ).toHaveCount(1);
    const left = await page.locator(".trace-start").boundingBox();
    const right = await page.locator(".trace-end").boundingBox();
    expect(left.x + left.width).toBeLessThan(right.x);
    await tabs
      .getByRole("button", { name: "Cerrar Circular", exact: true })
      .click();
    await tabs
      .getByRole("button", { name: "Cerrar Abierta", exact: true })
      .click();
    await expect(
      page.locator(".trace-endpoint, .trace-endpoint-label"),
    ).toHaveCount(0);
  });
}
