import { test, expect } from "@playwright/test";
import { pinLibraries, sendViewerRoute } from "./helpers/library";
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
      localStorage.setItem("tudagpx-routing-mode-v3", "free"),
    );
    await page.goto("/");
    await pinLibraries(page);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await page.getByRole("checkbox", { name: /Mostrar Vuelta/ }).check();
    const before = await savedState(page);
    expect(before.draft).toHaveLength(0);
    await expect(page.locator("path.viewer-route")).toHaveCount(2);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("path.viewer-route")).toHaveCount(0);
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(
      page.getByText(
        "Usa «Enviar al editor» desde «Ver rutas» o arrastra aquí un GPX.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Biblioteca", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /Mostrar / })).toHaveCount(
      0,
    );
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await sendViewerRoute(page, -1);
    const files = page.getByRole("tablist", {
      name: "Rutas cargadas en el editor",
    });
    await expect(files.getByRole("tab")).toHaveCount(1);
    await expect(
      files.getByRole("tab", { name: /Ruta de prueba & original/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("path.draft-line")).toHaveCount(2);
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await sendViewerRoute(page, 0);
    await expect(files.getByRole("tab")).toHaveCount(2);
    await expect(
      files.getByRole("tab", { name: /Vuelta por la sierra/ }),
    ).toHaveAttribute("aria-selected", "true");
    const loaded = await savedState(page);
    expect(loaded.draft).toHaveLength(3);
    const palette = await page.evaluate(
      async () => (await import("/src/utils/workspace.js")).colors,
    );
    const strokes = await page
      .locator("path.draft-line")
      .evaluateAll((paths) => paths.map((p) => p.getAttribute("stroke")));
    expect(strokes).toEqual([palette[0], palette[0], palette[1]]);
    const dots = await files
      .locator(".loaded-route-color")
      .evaluateAll((nodes) =>
        nodes.map((n) => getComputedStyle(n).backgroundColor),
      );
    expect(new Set(dots).size).toBe(2);

    await expect(page.locator("#library-panel")).toHaveCount(0);
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
    await expect(page.locator("#library-panel")).toBeVisible();
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
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("path.draft-line, .anchor-handle")).toHaveCount(
      0,
    );
    expect((await savedState(page)).draft).toEqual(moved.draft);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(files.getByRole("tab")).toHaveCount(2);
    // Cerrar todos los tramos de una copia conserva el original y admite deshacer.
    await files
      .getByRole("button", {
        name: "Cerrar Ruta de prueba & original",
        exact: true,
      })
      .click();
    await expect(files.getByRole("tab")).toHaveCount(1);
    expect((await savedState(page)).draft).toEqual([moved.draft[2]]);
    expect((await savedState(page)).routes).toEqual(before.routes);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    await expect(files.getByRole("tab")).toHaveCount(2);
    expect((await savedState(page)).draft).toEqual(moved.draft);
    await files
      .getByRole("button", {
        name: "Cerrar Vuelta por la sierra · DEMO",
        exact: true,
      })
      .click();
    await expect(
      files.getByRole("tab", { name: /Ruta de prueba/ }),
    ).toHaveAttribute("aria-selected", "true");
    await files
      .getByRole("button", {
        name: "Cerrar Ruta de prueba & original",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "Usa «Enviar al editor» desde «Ver rutas» o arrastra aquí un GPX.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.locator("path.draft-line")).toHaveCount(0);
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    await expect(page.locator(".anchor-handle, .insert-handle")).toHaveCount(0);
    await page.reload();
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    expect((await savedState(page)).draft).toEqual([]);
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    expect((await savedState(page)).routes).toEqual(before.routes);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("Importar GPX de cabecera desde editor selecciona biblioteca sin cargar copias hasta envío explícito", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  const before = await savedState(page);
  await page.locator("input[type=file]").first().setInputFiles(fixture);
  await expect(
    page.getByRole("tab", { name: "Ver rutas", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("checkbox", {
      name: "Mostrar Ruta de prueba & original",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
  await expect(page.locator("path.draft-line")).toHaveCount(0);
  expect((await savedState(page)).draft).toEqual(before.draft);
  await sendViewerRoute(page, -1);
  const after = await savedState(page);
  expect(after.draft.map((e) => e.points)).toEqual(after.routes.at(-1).tracks);
  await expect(page.locator("path.viewer-route")).toHaveCount(0);
});
