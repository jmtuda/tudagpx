import { test, expect } from "@playwright/test";

async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function category(page, kind) {
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Biblioteca", exact: true })
    .getByRole("button", { name: kind === "route" ? /^Rutas/ : /^Segmentos/ })
    .click();
}
async function seed(page) {
  await page.goto("/");
  await state(page);
  await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    const data = await store.loadWorkspace();
    data.routes = [
      {
        id: "test-route",
        name: "Ruta sintética de prueba",
        tracks: [
          [
            { lat: 40.752, lon: -3.99, ele: 900 },
            { lat: 40.752, lon: -3.98, ele: 1000 },
          ],
        ],
        filename: "prueba.gpx",
      },
    ];
    data.segments = [
      {
        id: "test-segment",
        name: "Segmento sintético de prueba",
        points: [
          { lat: 40.76, lon: -3.99, ele: 910 },
          { lat: 40.76, lon: -3.98, ele: 1050 },
        ],
      },
    ];
    data.draft = [];
    localStorage.setItem("tudagpx-workspace", "view");
    await store.saveWorkspace(data);
  });
  await page.reload();
  return state(page);
}
for (const width of [1440, 390]) {
  test(`biblioteca fija, categorías, acciones alineadas y centrar selección mixta ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const before = await seed(page);
    const sidebar = page.locator("#library-panel");
    await expect(sidebar).toBeVisible();
    await expect(page.locator(".sidebar-edge")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /^(Centrar superpuestas|Quitar selección|Fijar panel de rutas|Ocultar panel de rutas)$/,
      }),
    ).toHaveCount(0);
    const center = page.getByRole("button", {
      name: "Centrar vista en la selección",
      exact: true,
    });
    await expect(center).toBeDisabled();
    for (const kind of ["route", "segment"]) {
      await category(page, kind);
      const card = page.locator(`.viewer-route-card[data-kind="${kind}"]`);
      await expect(card.getByRole("button")).toHaveCount(1);
      await expect(
        card.getByRole("button", { name: "Enviar al editor", exact: true }),
      ).toBeVisible();
      await card.getByRole("checkbox").check();
      await expect(card.getByRole("button")).toHaveCount(4);
      await expect(
        card
          .getByRole("button", { name: "Descargar GPX", exact: true })
          .locator("svg"),
      ).toBeVisible();
      const boxes = await card.getByRole("button").evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { x: r.x, right: r.right, y: r.y + r.height / 2 };
        }),
      );
      expect(
        Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y)),
      ).toBeLessThan(2);
      const cardBox = await card.boundingBox();
      expect(boxes.at(-1).right).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
    await expect(page.locator("path.viewer-route-selected")).toHaveCount(2);
    await expect(page.locator(".elevation-route-metric")).toHaveCount(2);
    // The map button fits both categories, not only the currently listed one.
    const map = page.locator(".workspace-map");
    const rect = await map.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height * 0.9, {
      steps: 10,
    });
    await page.mouse.up();
    await center.click();
    for (const path of await page.locator("path.viewer-route-selected").all()) {
      const box = await path.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(rect.x);
      expect(box.y).toBeGreaterThanOrEqual(rect.y);
      expect(box.x + box.width).toBeLessThanOrEqual(rect.x + rect.width);
      expect(box.y + box.height).toBeLessThanOrEqual(rect.y + rect.height);
    }
    await page.mouse.move(width - 1, 5);
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).focus();
    await expect(sidebar).toBeVisible();
    expect((await state(page)).draft).toEqual(before.draft);
    await page.screenshot({ path: info.outputPath("viewer-library.png") });
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(sidebar).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Biblioteca", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    const editorBox = await map.boundingBox();
    expect(editorBox.x).toBe(0);
    expect(editorBox.width).toBe(width);
    await page.screenshot({ path: info.outputPath("editor-no-sidebar.png") });
  });

  test(`enviar rutas y segmentos solo desde visor crea copias independientes ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const before = await seed(page);
    for (const kind of ["route", "segment"]) {
      await category(page, kind);
      const card = page.locator(`.viewer-route-card[data-kind="${kind}"]`);
      await card
        .getByRole("button", { name: "Enviar al editor", exact: true })
        .click();
      await expect(
        page.getByRole("tab", { name: "Editar", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      const saved = await state(page);
      const copy = saved.draft.at(-1);
      expect(copy.points).toEqual(
        kind === "route"
          ? before.routes[0].tracks[0]
          : before.segments[0].points,
      );
      expect(copy.id).not.toBe(
        kind === "route" ? before.routes[0].id : before.segments[0].id,
      );
      expect(saved.routes).toEqual(before.routes);
      expect(saved.segments).toEqual(before.segments);
      await expect(page.locator("#library-panel")).toHaveCount(0);
    }
    const copies = (await state(page)).draft;
    expect(copies).toHaveLength(2);
    await category(page, "segment");
    await page
      .locator('.viewer-route-card[data-kind="segment"]')
      .getByRole("button", { name: "Enviar al editor", exact: true })
      .click();
    const repeated = (await state(page)).draft;
    expect(repeated).toHaveLength(3);
    expect(repeated[2].id).not.toBe(copies[1].id);
    expect(repeated[2].editorRouteId).not.toBe(copies[1].editorRouteId);
    await page.reload();
    expect((await state(page)).draft).toEqual(repeated);
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("path.draft-line, .anchor-handle")).toHaveCount(
      0,
    );
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(page.locator("#library-panel")).toHaveCount(0);
  });
}
for (const kind of ["route", "segment"]) {
  test(`clic en línea ${kind} ofrece envío sin cargar hasta pulsar`, async ({
    page,
  }) => {
    const before = await seed(page);
    const index = kind === "route" ? 0 : 1;
    const path = page.locator("path.viewer-route-reference").nth(index);
    const point = await path.evaluate((path) => {
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const screen = new DOMPoint(p.x, p.y).matrixTransform(
        path.getScreenCTM(),
      );
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
    const popup = page.locator(".viewer-route-popup");
    await expect(popup).toContainText(
      kind === "route" ? before.routes[0].name : before.segments[0].name,
    );
    expect((await state(page)).draft).toEqual([]);
    await popup
      .getByRole("button", { name: "Enviar al editor", exact: true })
      .click();
    const saved = await state(page);
    expect(saved.draft).toHaveLength(1);
    expect(saved.draft[0].points).toEqual(
      kind === "route" ? before.routes[0].tracks[0] : before.segments[0].points,
    );
  });
}
for (const method of ["input", "drop"]) {
  test(`importación ${method} desde editor ${method === "input" ? "pasa a biblioteca sin cargar trazados" : "abre solo copias de trabajo"}`, async ({
    page,
  }) => {
    await seed(page);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    const before = await state(page);
    if (method === "input")
      await page
        .locator('input[type="file"][accept*="gpx"]')
        .setInputFiles(
          new URL("./fixtures/ruta.gpx", import.meta.url).pathname,
        );
    else {
      const transfer = await page.evaluateHandle(() => {
        const data = new DataTransfer();
        data.items.add(
          new File(
            [
              '<?xml version="1.0"?><gpx version="1.1"><trk><name>Importación sintética</name><trkseg><trkpt lat="40.75" lon="-3.98"/><trkpt lat="40.76" lon="-3.97"/></trkseg></trk></gpx>',
            ],
            "prueba.gpx",
            { type: "application/gpx+xml" },
          ),
        );
        return data;
      });
      await page
        .locator(".workspace-map")
        .dispatchEvent("drop", { dataTransfer: transfer });
      await transfer.dispose();
    }
    await expect(
      page.getByRole("tab", {
        name: method === "input" ? "Ver rutas" : "Editar",
        exact: true,
      }),
    ).toHaveAttribute("aria-selected", "true");
    const after = await state(page);
    expect(after.segments).toEqual(before.segments);
    if (method === "input") {
      expect(after.draft).toEqual(before.draft);
      expect(after.routes).toHaveLength(before.routes.length + 1);
      await expect(page.locator("#library-panel")).toBeVisible();
      await page.getByRole("tab", { name: "Editar", exact: true }).click();
      await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
    } else {
      expect(after.routes).toEqual(before.routes);
      expect(after.draft).toHaveLength(before.draft.length + 1);
      expect(after.draft.at(-1).points).toEqual([
        { lat: 40.75, lon: -3.98, ele: null },
        { lat: 40.76, lon: -3.97, ele: null },
      ]);
      expect(after.draft.at(-1).sourceRouteId).toBeFalsy();
      await expect(page.locator("#library-panel")).toHaveCount(0);
      await expect(page.locator("path.draft-line")).toHaveCount(1);
    }
  });
}
