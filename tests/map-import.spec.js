import { sendViewerRoute } from "./helpers/library";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const fixture = new URL("./fixtures/ruta.gpx", import.meta.url);
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function drop(page, files) {
  const transfer = await page.evaluateHandle((entries) => {
    const result = new DataTransfer();
    for (const entry of entries)
      result.items.add(
        new File(
          [Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0))],
          entry.name,
          { type: "application/gpx+xml" },
        ),
      );
    return result;
  }, files);
  const map = page.locator(".workspace-map");
  await map.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(
    page.getByText("Suelta uno o varios archivos GPX para importarlos"),
  ).toBeVisible();
  await map.dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator(".map-drop-hint")).toHaveCount(0);
  await transfer.dispose();
}
test("arrastrar uno o varios GPX al visor y editor conserva originales e independencia", async ({
  page,
}) => {
  await page.goto("/");
  const before = await state(page);
  const bytes = await readFile(fixture);
  const base64 = bytes.toString("base64");
  await drop(page, [{ name: "primera.gpx", base64 }]);
  let saved = await state(page);
  expect(saved.routes.length).toBe(before.routes.length + 1);
  expect(saved.routes.at(-1).originalBase64).toBe(base64);
  expect(saved.draft).toEqual(before.draft);
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await drop(page, [
    { name: "segunda.gpx", base64 },
    { name: "tercera.gpx", base64 },
  ]);
  saved = await state(page);
  expect(saved.routes.length).toBe(before.routes.length + 3);
  expect(saved.draft).toEqual(before.draft);
  await expect(
    page.getByRole("tab", { name: "Ver rutas", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(3);
  await sendViewerRoute(page, -2);
  await sendViewerRoute(page, -1);
  saved = await state(page);
  expect(saved.draft).toHaveLength(4);
  expect(new Set(saved.draft.map((e) => e.editorRouteId)).size).toBe(2);
  expect(saved.routes.slice(-2).every((r) => r.originalBase64 === base64)).toBe(
    true,
  );
  await expect(
    page
      .getByRole("tablist", { name: "Rutas cargadas en el editor" })
      .getByRole("tab"),
  ).toHaveCount(2);
  await expect(
    page.locator("path.viewer-route-reference, path.viewer-route-selected"),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(3);
  await page.reload();
  expect((await state(page)).draft).toEqual(saved.draft);
});
test("archivo inválido arrastrado no altera datos y no navega fuera de la aplicación", async ({
  page,
}) => {
  await page.goto("/");
  const before = await state(page);
  await drop(page, [
    {
      name: "invalido.gpx",
      base64: Buffer.from("no es XML").toString("base64"),
    },
  ]);
  expect(await state(page)).toEqual(before);
  await expect(page.getByText(/0 GPX importados/)).toBeVisible();
  await expect(page).toHaveURL(/127\.0\.0\.1:5173/);
});
test("rutas de la vista atenuadas, selección en el mapa y editor independiente", async ({
  page,
}) => {
  await page.goto("/");
  await state(page);
  await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    const d = await store.loadWorkspace();
    const route = (id, lat, left, right) => ({
      id,
      name: id,
      tracks: [
        [
          { lat, lon: left, ele: null },
          { lat, lon: right, ele: null },
        ],
      ],
    });
    d.routes = [
      route("Local", 40.752, -3.988, -3.98),
      route("Cruza la vista", 40.762, -5, -3),
      route("Lejana", 0, 0, 1),
    ];
    d.draft = [];
    d.segments = [];
    await store.saveWorkspace(d);
  });
  await page.reload();
  await state(page);
  await expect(page.locator("path.viewer-route-reference")).toHaveCount(2);
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(0);
  await expect(
    page.locator("path.viewer-route-reference").first(),
  ).toHaveAttribute("stroke-opacity", "0.5");
  const clickLine = async (locator) => {
    const point = await locator.evaluate((path) => {
      const middle = path.getPointAtLength(path.getTotalLength() / 2);
      const screen = new DOMPoint(middle.x, middle.y).matrixTransform(
        path.getScreenCTM(),
      );
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
  };
  await clickLine(page.locator("path.viewer-route-reference").first());
  await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
  await expect(page.locator("path.viewer-route-selected")).toHaveAttribute(
    "stroke-opacity",
    "0.95",
  );
  await expect(page.locator(".trace-start")).toHaveText("▶");
  await expect(page.locator(".trace-end")).toHaveText("■");
  await expect(page.locator(".trace-endpoint-label")).toHaveCount(0);
  await clickLine(page.locator("path.viewer-route-selected"));
  await expect(page.locator("path.viewer-route-reference")).toHaveCount(2);
  await expect(page.locator(".trace-endpoint")).toHaveCount(0);
  // El clic en el visor ahora alterna la selección y abre acciones de ruta.
  await page.locator(".leaflet-popup-close-button").click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(0);
  const box = await page.locator(".workspace-map").boundingBox();
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.85, {
      steps: 12,
    });
    await page.mouse.up();
  }
  await expect(page.locator("path.viewer-route-reference")).toHaveCount(0);
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
});
