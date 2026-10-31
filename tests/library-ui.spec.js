import { test, expect } from "@playwright/test";
import {
  confirmRouteSave,
  pinLibraries,
  sendLibraryItem,
} from "./helpers/library";
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
for (const width of [1440, 390]) {
  test(`nombre de segmento, cancelar y persistir sin alterar copias en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await pinLibraries(page);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await sendLibraryItem(page, "segment", 0);
    await expect(
      page.getByRole("navigation", { name: "Biblioteca", exact: true }),
    ).toHaveCount(0);
    const before = await state(page);
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Guardar segmento",
      exact: true,
    });
    await expect(dialog.getByLabel("Nombre del segmento")).toBeFocused();
    await dialog
      .getByLabel("Nombre del segmento")
      .fill("Nombre que se cancela");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await state(page)).toEqual(before);
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    await dialog.getByLabel("Nombre del segmento").fill("   ");
    await dialog
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect((await state(page)).segments).toEqual(before.segments);
    await dialog
      .getByLabel("Nombre del segmento")
      .fill("  Mi subida al mirador 🏔  ");
    await dialog
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    const after = await state(page);
    expect(after.segments.at(-1).name).toBe("Mi subida al mirador 🏔");
    expect(after.segments.at(-1).points).toEqual(before.draft[0].points);
    expect(after.routes).toEqual(before.routes);
    expect(after.draft).toEqual(before.draft);
    await page.reload();
    const reloaded = await state(page);
    expect(reloaded.draft).toEqual(before.draft);
    expect(reloaded.segments.at(-1).name).toBe("Mi subida al mirador 🏔");
  });
  test(`cabecera compacta compartida y navegación conservada en ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await pinLibraries(page);
    const panel = page.locator("#library-panel");
    const filters = panel.locator(".dock-controls");
    const viewHeight = (await filters.boundingBox()).height;
    expect(viewHeight).toBeLessThanOrEqual(44);
    const firstCard = panel.locator(".library-card").first();
    expect(
      (await firstCard.boundingBox()).y - (await panel.boundingBox()).y,
    ).toBeLessThanOrEqual(110);
    await page.screenshot({ path: testInfo.outputPath("visor.png") });
    const nav = page.getByRole("navigation", {
      name: "Biblioteca",
      exact: true,
    });
    for (const name of ["Segmentos", "Rutas"])
      await expect(
        nav.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    await expect(nav.getByRole("button")).toHaveCount(2);
    await nav.getByRole("button", { name: /^Rutas/ }).click();
    await expect(firstCard.locator(".profile")).toHaveCount(0);
    await expect(firstCard).toContainText("bajada");
    await expect(page.getByLabel("Buscar rutas por nombre")).toBeHidden();
    expect((await filters.boundingBox()).height).toBe(viewHeight);
    expect(
      (await firstCard.boundingBox()).y - (await panel.boundingBox()).y,
    ).toBeLessThanOrEqual(110);
    await panel.getByText(/Buscar y filtrar rutas/).click();
    await page.getByLabel("Buscar rutas por nombre").fill("sin coincidencia");
    await expect(panel.locator(".library-card")).toHaveCount(0);
    await page.getByLabel("Buscar rutas por nombre").fill("");
    await panel.getByText(/Buscar y filtrar rutas/).click();
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(nav).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Guardar versión", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Segmentos de la zona" }),
    ).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("editor.png") });
  });
}
test("guardar tramos como segmentos permite nombrar o cancelar cada copia sin cambiar originales", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(new URL("./fixtures/ruta.gpx", import.meta.url).pathname);
  await sendLibraryItem(page, "route", -1);
  const before = await state(page);
  const dialog = page.getByRole("dialog", {
    name: "Guardar segmento",
    exact: true,
  });
  const save = page.getByRole("button", {
    name: "Guardar segmento",
    exact: true,
  });
  await save.click();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await state(page)).toEqual(before);
  for (const [i, name] of ["Primera subida", "Bajada del bosque"].entries()) {
    if (i) {
      const line = page.locator("path.draft-line").nth(i);
      await line.dispatchEvent("click");
    }
    await save.click();
    await dialog.getByLabel("Nombre del segmento", { exact: true }).fill(name);
    await dialog
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
  }
  const after = await state(page);
  expect(after.segments.slice(-2).map((e) => e.name)).toEqual([
    "Primera subida",
    "Bajada del bosque",
  ]);
  expect(after.segments.slice(-2).map((e) => e.points)).toEqual(
    before.routes.at(-1).tracks,
  );
  expect(after.routes).toEqual(before.routes);
  expect(after.draft).toEqual(before.draft);
});
test("avisos: cinco segundos, reinicio al repetir y cierre manual", async ({
  page,
}) => {
  await page.goto("/");
  await pinLibraries(page);
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await sendLibraryItem(page, "segment", 0);
  const before = await state(page);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  const save = page.getByRole("button", {
    name: "Guardar ruta",
    exact: true,
  });
  const notice = page.locator(".notice");
  await save.click();
  await confirmRouteSave(page);
  await expect(notice).toContainText(
    /Ruta «.+» guardada\. El original y las copias del editor se conservan\./,
  );
  await page.clock.runFor(4999);
  await expect(notice).toBeVisible();
  await page.clock.runFor(1);
  await expect(notice).toHaveCount(0);
  await save.click();
  await confirmRouteSave(page);
  await page.clock.runFor(3000);
  await save.click();
  await confirmRouteSave(page);
  await page.clock.runFor(2001);
  await expect(notice).toBeVisible();
  await page.clock.runFor(2999);
  await expect(notice).toHaveCount(0);
  await save.click();
  await confirmRouteSave(page);
  await page.getByRole("button", { name: "Cerrar aviso", exact: true }).click();
  await expect(notice).toHaveCount(0);
  const after = await state(page);
  expect(after.routes).toHaveLength(before.routes.length + 4);
  expect(after.routes.slice(0, before.routes.length)).toEqual(before.routes);
  expect(after.draft).toEqual(before.draft);
});
