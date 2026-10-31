import { test, expect } from "@playwright/test";
import { sendLibraryItem } from "./helpers/library";

const references = 'img.leaflet-tile[src*="layer=IGNBaseOrto"]';
const photos = 'img.leaflet-tile[src*="pnoa-ma"]';
async function loaded(page, selector) {
  await expect
    .poll(
      () =>
        page
          .locator(selector)
          .evaluateAll(
            (images) =>
              images.filter((image) => image.complete && image.naturalWidth > 0)
                .length,
          ),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
}
async function openSelector(page) {
  const button = page.getByRole("button", {
    name: "Seleccionar mapa",
    exact: true,
  });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
}
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}

for (const width of [1440, 390]) {
  test(`PNOA conserva foto real y etiquetas opcionales sin alterar trabajo ${width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-routing-mode-v3", "free"),
    );
    await page.goto("/");
    await loaded(page, photos);
    await loaded(page, references);
    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "Nombres y referencias:",
    );
    const initial = await state(page);
    await openSelector(page);
    const toggle = page.getByRole("checkbox", {
      name: "Mostrar nombres y referencias",
      exact: true,
    });
    await expect(toggle).toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath("pnoa-con-referencias.png"),
    });
    const photoSources = await page
      .locator(photos)
      .evaluateAll((images) => images.map((i) => i.src).sort());
    await toggle.uncheck();
    await expect(page.locator(references)).toHaveCount(0);
    expect(
      await page
        .locator(photos)
        .evaluateAll((images) => images.map((i) => i.src).sort()),
    ).toEqual(photoSources);
    expect(await state(page)).toEqual(initial);
    await page.reload();
    await openSelector(page);
    await expect(toggle).not.toBeChecked();
    await expect(page.locator(references)).toHaveCount(0);
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await loaded(page, references);
    await page.getByLabel("Cartografía").selectOption("ign_base");
    await expect(page.locator(references)).toHaveCount(0);
    await openSelector(page);
    await expect(toggle).toHaveCount(0);
    await page.getByLabel("Cartografía").selectOption("pnoa_orto");
    await loaded(page, references);
    await sendLibraryItem(page, "segment", 0);
    await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();
    const before = await state(page);
    await openSelector(page);
    await toggle.uncheck();
    await toggle.check();
    await page.keyboard.press("Escape");
    expect((await state(page)).draft).toEqual(before.draft);
    expect((await state(page)).routes).toEqual(initial.routes);
    expect((await state(page)).segments).toEqual(initial.segments);
    await page.reload();
    await loaded(page, references);
    await openSelector(page);
    await expect(toggle).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
