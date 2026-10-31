import { test, expect } from "@playwright/test";
import { confirmRouteSave } from "./helpers/library";
import { pinLibraries, sendViewerRoute } from "./helpers/library";
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
  test(`un clic separa una ruta guardable y cerrable en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-routing-mode-v3", "free"),
    );
    await page.goto("/");
    await pinLibraries(page);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await expect(
      page.getByRole("checkbox", {
        name: "Mostrar Ruta de prueba & original",
        exact: true,
      }),
    ).toBeVisible();
    await sendViewerRoute(page, -1);
    const before = await state(page);
    const files = page.getByRole("tablist", {
      name: "Rutas cargadas en el editor",
    });
    await expect(files.getByRole("tab")).toHaveCount(1);

    await expect(page.locator("#library-panel")).toHaveCount(0);
    const box = await page
      .getByTitle("Editar punto 2", { exact: true })
      .boundingBox();
    await page
      .getByRole("button", { name: "Dividir trazado", exact: true })
      .click();
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    await expect(files.getByRole("tab")).toHaveCount(2);
    const split = await state(page);
    expect(split.draft).toHaveLength(3);
    expect(split.draft[0].points).toEqual(before.draft[0].points.slice(0, 2));
    expect(split.draft[1].points).toEqual(before.draft[0].points.slice(1));
    expect(split.draft[2]).toEqual(before.draft[1]);
    expect(split.draft[0].editorRouteId).not.toBe(split.draft[1].editorRouteId);
    expect(split.routes).toEqual(before.routes);
    await expect(files.getByRole("tab", { name: /parte 2/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page
      .getByRole("button", { name: "Guardar ruta", exact: true })
      .click();
    await confirmRouteSave(page);
    await expect(
      page.getByText(
        /Ruta «.+» guardada\. El original y las copias del editor se conservan\./,
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    const saved = await state(page);
    expect(saved.routes).toHaveLength(before.routes.length + 1);
    expect(saved.routes.slice(0, -1)).toEqual(before.routes);
    expect(saved.routes.at(-1).tracks).toEqual([split.draft[1].points]);
    expect(saved.routes.at(-1).originalBase64).toBeTruthy();
    expect(saved.segments.at(-1).points).toEqual(split.draft[1].points);
    expect(saved.draft).toEqual(split.draft);
    await files.getByRole("button", { name: /^Cerrar .*parte 2/ }).click();
    const closed = await state(page);
    expect(closed.draft).toEqual([split.draft[0], split.draft[2]]);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(split.draft);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(before.draft);
    await page.getByRole("button", { name: "↷ Rehacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(split.draft);
    await page.reload();
    expect((await state(page)).draft).toEqual(split.draft);
    await expect(files.getByRole("tab")).toHaveCount(2);
  });
}
