import { test, expect } from "@playwright/test";
import { pinLibraries, sendLibraryItem } from "./helpers/library";
import { readFile } from "node:fs/promises";
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
for (const width of [1440, 390]) {
  test(`visor envío permanente y tres acciones en línea al seleccionar ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await pinLibraries(page);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    const card = page.locator(".viewer-route-card").last();
    const check = card.getByRole("checkbox");
    await check.uncheck();
    await expect(card.getByRole("button")).toHaveCount(1);
    await expect(
      card.getByRole("button", { name: "Enviar al editor", exact: true }),
    ).toBeVisible();
    await check.check();
    expect(await card.getByRole("button").allTextContents()).toEqual([
      "Enviar al editor",
      "Editar nombre",
      "Borrar",
      "",
    ]);
    const boxes = await card
      .getByRole("button")
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
    expect(new Set(boxes).size).toBe(1);
    const before = await state(page);
    const downloading = page.waitForEvent("download");
    await card
      .getByRole("button", { name: "Descargar GPX", exact: true })
      .click();
    expect(await readFile(await (await downloading).path())).toEqual(
      await readFile(fixture),
    );
    expect((await state(page)).routes).toEqual(before.routes);
  });
}
for (const kind of ["ruta", "segmento"]) {
  test(`guardar ${kind}: valida automáticamente antes de nombre, cancela sin cambios y guarda identidad nueva`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-workspace", "edit"),
    );
    await page.goto("/");
    await pinLibraries(page);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await sendLibraryItem(page, "route", -1);
    const before = await state(page);
    const action = page
      .getByRole("toolbar")
      .getByRole("button", { name: `Guardar ${kind}`, exact: true });
    await action.click();
    const dialog = page.getByRole("dialog", {
      name: `Guardar ${kind}`,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Revisión GPX" }),
    ).toHaveCount(0);
    expect(await state(page)).toEqual(before);
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(await state(page)).toEqual(before);
    await action.click();
    await dialog.getByRole("textbox").fill(`Nueva ${kind} probada`);
    await dialog
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const after = await state(page);
    expect(after.draft).toEqual(before.draft);
    expect(after.routes.slice(0, before.routes.length)).toEqual(before.routes);
    expect(after.segments.slice(0, before.segments.length)).toEqual(
      before.segments,
    );
    const entry = kind === "ruta" ? after.routes.at(-1) : after.segments.at(-1);
    expect(entry.name).toBe(`Nueva ${kind} probada`);
    expect(before.routes.some((r) => r.id === entry.id)).toBe(false);
    if (kind === "ruta")
      expect(entry.tracks).toEqual(before.draft.map((e) => e.points));
    else expect(entry.points).toEqual(before.draft[0].points);
  });
}
for (const width of [1440, 390]) {
  test(`orden iconos, sliders en cuadro y trazados sólidos ${width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-workspace", "edit"),
    );
    await page.goto("/");
    await pinLibraries(page);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await sendLibraryItem(page, "route", -1);
    const toolbar = page.getByRole("toolbar", {
      name: "Herramientas del mapa",
    });
    await expect(toolbar.getByRole("button").first()).toHaveAttribute(
      "aria-label",
      "+ Dibujar",
    );
    for (const name of [
      "Abrir rutas y segmentos",
      "Salir del editor",
      "Información de cálculo",
    ])
      await expect(page.getByLabel(name, { exact: true })).toHaveCount(0);
    const save = toolbar.getByRole("button", {
      name: "Guardar ruta",
      exact: true,
    });
    expect(
      await save.evaluate((node) =>
        node.previousElementSibling.classList.contains("tool-divider"),
      ),
    ).toBe(true);
    const options = page.getByRole("region", { name: "Opciones del editor" });
    await expect(options.locator("input")).toHaveCount(1);
    await expect(
      options.getByRole("checkbox", { name: "Seguir caminos", exact: true }),
    ).toBeVisible();
    for (const path of await page.locator("path.draft-line").all())
      expect(
        await path.evaluate((node) => getComputedStyle(node).strokeDasharray),
      ).toBe("none");
    await expect(page.locator(".trace-start")).not.toHaveCount(0);
    expect(
      await page
        .locator(".trace-start")
        .first()
        .evaluate((node) => getComputedStyle(node).borderRadius),
    ).toBe("4px");
    await toolbar
      .getByRole("button", { name: "Recortar trazado", exact: true })
      .click();
    await expect(options.locator("input[type=range]")).toHaveCount(2);
    await expect(options.locator("input:not([type=range])")).toHaveCount(0);
    const profile = page.getByRole("region", {
      name: "Perfil de altitud",
      exact: true,
    });
    await expect(profile.locator("input[type=range]")).toHaveCount(0);
    const before = await state(page);
    await options.getByLabel("Final del recorte", { exact: true }).fill("2");
    const meters = await page.evaluate(
      async (points) =>
        (await import("/src/utils/workspace.js")).stats([points.slice(0, 3)])
          .km * 1000,
      before.draft[0].points,
    );
    expect(
      Number(
        await profile
          .locator(".elevation-route-metric")
          .getAttribute("data-distance"),
      ),
    ).toBeCloseTo(meters, 6);
    expect((await state(page)).draft).toEqual(before.draft);
    const notice = page.getByRole("button", {
      name: "Cerrar aviso",
      exact: true,
    });
    if (await notice.isVisible()) await notice.click();
    await page.screenshot({ path: testInfo.outputPath("crop-layout.png") });
  });
}
