import { test, expect } from "@playwright/test";
import { pinLibraries } from "./helpers/library";
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
    await page
      .getByRole("button", { name: "+ Borrador", exact: true })
      .first()
      .click();
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
    expect((await state(page)).segments.at(-1).name).toBe(
      "Mi subida al mirador 🏔",
    );
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
    ).toBeLessThanOrEqual(55);
    await page.screenshot({ path: testInfo.outputPath("visor.png") });
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    const nav = page.getByRole("navigation", {
      name: "Biblioteca",
      exact: true,
    });
    for (const name of ["Segmentos", "Rutas", "Borrador", "Proyectos"])
      await expect(
        nav.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    await nav.getByRole("button", { name: /^Rutas/ }).click();
    await expect(firstCard.locator(".profile")).toHaveCount(0);
    await expect(firstCard).toContainText("bajada");
    await expect(page.getByLabel("Buscar en la biblioteca")).toBeHidden();
    expect((await filters.boundingBox()).height).toBe(viewHeight);
    expect(
      (await firstCard.boundingBox()).y - (await panel.boundingBox()).y,
    ).toBeLessThanOrEqual(100);
    await panel.getByText("Buscar y filtrar", { exact: true }).click();
    await page.getByLabel("Buscar en la biblioteca").fill("sin coincidencia");
    await expect(panel.locator(".library-card")).toHaveCount(0);
    await page.getByLabel("Buscar en la biblioteca").fill("");
    await panel.getByText("Buscar y filtrar", { exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("editor.png") });
  });
}
test("crear varios segmentos permite nombrarlos antes de guardar o cancelar", async ({
  page,
}) => {
  await page.goto("/");
  await pinLibraries(page);
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(new URL("./fixtures/ruta.gpx", import.meta.url).pathname);
  const before = await state(page);
  const create = page
    .getByRole("button", { name: "Crear segmentos", exact: true })
    .last();
  await create.click();
  const dialog = page.getByRole("dialog", {
    name: "Guardar segmentos",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await state(page)).toEqual(before);
  await create.click();
  await dialog
    .getByLabel("Nombre del segmento 1", { exact: true })
    .fill("Primera subida");
  await dialog
    .getByLabel("Nombre del segmento 2", { exact: true })
    .fill("Bajada del bosque");
  await dialog
    .getByRole("button", { name: "Guardar segmentos", exact: true })
    .click();
  const after = await state(page);
  expect(after.segments.slice(-2).map((segment) => segment.name)).toEqual([
    "Primera subida",
    "Bajada del bosque",
  ]);
  expect(after.segments.slice(-2).map((segment) => segment.points)).toEqual(
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
  await page
    .getByRole("button", { name: "+ Borrador", exact: true })
    .first()
    .click();
  await state(page);
  await page
    .getByRole("navigation", { name: "Biblioteca", exact: true })
    .getByRole("button", { name: /^Borrador/ })
    .click();
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  const save = page.getByRole("button", {
    name: "Guardar versión",
    exact: true,
  });
  const notice = page.locator(".notice");
  await save.click();
  await expect(notice).toContainText("Versión del proyecto guardada");
  await page.clock.runFor(4999);
  await expect(notice).toBeVisible();
  await page.clock.runFor(1);
  await expect(notice).toHaveCount(0);
  await save.click();
  await page.clock.runFor(3000);
  await save.click();
  await page.clock.runFor(2001);
  await expect(notice).toBeVisible();
  await page.clock.runFor(2999);
  await expect(notice).toHaveCount(0);
  await save.click();
  await page.getByRole("button", { name: "Cerrar aviso", exact: true }).click();
  await expect(notice).toHaveCount(0);
});
