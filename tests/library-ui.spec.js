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
      .getByRole("button", { name: "Abrir segmento", exact: true })
      .first()
      .click();
    await expect(page.getByRole("navigation", { name: "Biblioteca", exact: true }).getByRole("button", { name: /^Segmentos/ })).toHaveClass("active");
    await page.getByLabel("Nombre del tramo", { exact: true }).fill("Copia editable del mirador");
    const before = await state(page);
    expect(before.draft[0].name).toBe("Copia editable del mirador");
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
    await expect(page.getByLabel("Nombre del tramo", { exact: true })).toHaveValue("Copia editable del mirador");
    expect(reloaded.segments.at(-1).name).toBe(
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
    for (const name of ["Segmentos", "Rutas"])
      await expect(
        nav.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    await expect(nav.getByRole("button")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Guardar versión", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Segmentos de la zona" })).toHaveCount(0);
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
    .getByRole("button", { name: "Abrir segmento", exact: true })
    .first()
    .click();
  const before = await state(page);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  const save = page.getByRole("button", {
    name: "Guardar ruta",
    exact: true,
  });
  const notice = page.locator(".notice");
  await save.click();
  await expect(notice).toContainText("Nueva ruta guardada en la biblioteca.");
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
  const after = await state(page);
  expect(after.routes).toHaveLength(before.routes.length + 4);
  expect(after.routes.slice(0, before.routes.length)).toEqual(before.routes);
  expect(after.draft).toEqual(before.draft);
});
