import { test, expect } from "@playwright/test";
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
async function savedState(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
for (const viewport of [
  { width: 1440, height: 950 },
  { width: 390, height: 844 },
]) {
  test(`carga manual y selector de archivos independiente del visor en ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-routing-mode", "free"),
    );
    await page.goto("/");
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await page.getByRole("checkbox", { name: /Mostrar Vuelta/ }).check();
    const before = await savedState(page);
    expect(before.draft).toHaveLength(0);
    await expect(page.locator("path.viewer-route")).toHaveCount(2);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("path.viewer-route")).toHaveCount(0);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(page.getByText(/Ninguna ruta cargada/)).toBeVisible();
    await page.getByRole("button", { name: /^Rutas/ }).click();
    await expect(page.getByRole("checkbox", { name: /Mostrar / })).toHaveCount(
      0,
    );
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await page
      .getByRole("button", { name: "Enviar al editor", exact: true })
      .last()
      .click();
    const files = page.getByRole("tablist", {
      name: "Rutas cargadas en el editor",
    });
    await expect(files.getByRole("tab")).toHaveCount(1);
    await expect(
      files.getByRole("tab", { name: /Ruta de prueba & original/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("path.draft-line")).toHaveCount(2);
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await page
      .getByRole("button", { name: "Enviar al editor", exact: true })
      .first()
      .click();
    await expect(files.getByRole("tab")).toHaveCount(2);
    await expect(
      files.getByRole("tab", { name: /Vuelta por la sierra/ }),
    ).toHaveAttribute("aria-selected", "true");
    const loaded = await savedState(page);
    expect(loaded.draft).toHaveLength(3);
    await page.getByRole("button", { name: "Minimizar herramientas" }).click();
    await page.getByRole("button", { name: "Ocultar panel de rutas" }).click();
    await files.getByRole("tab", { name: /Ruta de prueba & original/ }).click();
    await expect(
      files.getByRole("tab", { name: /Ruta de prueba & original/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".anchor-handle")).toHaveCount(4);
    // Cambiar archivo no inserta puntos ni conecta las rutas.
    expect((await savedState(page)).draft).toEqual(loaded.draft);
    const marker = page.getByTitle("Editar punto 2", { exact: true });
    const box = await marker.boundingBox();
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 35, box.y + 18, { steps: 8 });
    await page.mouse.up();
    const moved = await savedState(page);
    expect(moved.draft[0].points).not.toEqual(loaded.draft[0].points);
    expect(moved.draft[1]).toEqual(loaded.draft[1]);
    expect(moved.draft[2]).toEqual(loaded.draft[2]);
    expect(moved.routes).toEqual(before.routes);
    await files.getByRole("tab", { name: /Ruta de prueba & original/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      files.getByRole("tab", { name: /Vuelta por la sierra/ }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await expect(page.locator("path.viewer-route")).toHaveCount(2);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await page.getByRole("button", { name: "Mostrar panel de rutas" }).click();
    await expect(
      page.getByRole("checkbox", { name: /Mostrar Vuelta/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", {
        name: "Mostrar Ruta de prueba & original",
        exact: true,
      }),
    ).toBeChecked();
    await page.reload();
    expect((await savedState(page)).draft).toEqual(moved.draft);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(files.getByRole("tab")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("importar en editor no activa superposiciones en el visor", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await page.locator("input[type=file]").first().setInputFiles(fixture);
  await expect(page.locator("path.viewer-route")).toHaveCount(0);
  await expect(page.locator("path.draft-line")).toHaveCount(0);
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Mostrar Ruta de prueba & original",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(page.locator("path.viewer-route")).toHaveCount(0);
});
