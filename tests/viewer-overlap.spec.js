import { test, expect } from "@playwright/test";

async function persisted(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function category(page, kind) {
  await page
    .getByRole("navigation", { name: "Biblioteca", exact: true })
    .getByRole("button", { name: kind === "route" ? /^Rutas/ : /^Segmentos/ })
    .click();
}
async function pixels(page) {
  return page.locator("path.viewer-route-selected").evaluate(async (path) => {
    const svg = path.ownerSVGElement;
    const copy = svg.cloneNode(true);
    copy.style.transform = "";
    const source = new XMLSerializer().serializeToString(copy);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = svg.width.baseVal.value;
    canvas.height = svg.height.baseVal.value;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const view = svg.viewBox.baseVal;
    const sample = (fraction) => {
      const point = path.getPointAtLength(path.getTotalLength() * fraction);
      return Array.from(
        context.getImageData(
          Math.round(point.x - view.x),
          Math.round(point.y - view.y),
          1,
          1,
        ).data,
      );
    };
    const overlap = sample(0.25);
    const alone = sample(0.75);
    context.fillStyle = path.getAttribute("stroke");
    context.fillRect(0, 0, 1, 1);
    const expected = Array.from(context.getImageData(0, 0, 1, 1).data);
    const paths = Array.from(svg.querySelectorAll("path"));
    const selected = paths.indexOf(path);
    const referencesBelow = paths
      .filter((node) => node.classList.contains("viewer-route-reference"))
      .every((node) => paths.indexOf(node) < selected);
    return { overlap, alone, expected, referencesBelow };
  });
}
for (const width of [1440, 390]) {
  for (const kind of ["route", "segment"]) {
    test(`color sólido de ${kind} sobre referencias coincidentes ${width}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/");
      await persisted(page);
      await page.evaluate(async (activeKind) => {
        const store = await import("/src/utils/localStore.js");
        const data = await store.loadWorkspace();
        const points = [
          { lat: 40.752, lon: -3.997, ele: 900 },
          { lat: 40.752, lon: -3.984, ele: 950 },
          { lat: 40.752, lon: -3.971, ele: 960 },
        ];
        const reference = [
          points[0],
          points[1],
          { lat: 40.76, lon: -3.984, ele: 970 },
        ];
        const routePoints = activeKind === "route" ? points : reference;
        const segmentPoints = activeKind === "segment" ? points : reference;
        data.routes = [
          {
            id: "route",
            name: activeKind === "route" ? "Activa" : "Referencia",
            tracks: [routePoints],
          },
        ];
        data.segments = [
          {
            id: "segment",
            name: activeKind === "segment" ? "Activa" : "Referencia",
            points: segmentPoints,
          },
        ];
        data.draft = [];
        data.projects = [];
        await store.saveWorkspace(data);
      }, kind);
      await page.reload();
      const original = await persisted(page);
      const otherKind = kind === "route" ? "segment" : "route";
      await category(page, kind);
      await page
        .getByRole("checkbox", { name: "Mostrar Activa", exact: true })
        .check();
      await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
      await expect(page.locator("path.viewer-route-selected")).toHaveAttribute(
        "stroke-opacity",
        "1",
      );
      await page.locator("path.viewer-route-selected").evaluate((node) => {
        window.originalSelectedPath = node;
      });
      for (let step = 0; step < 3; step++) {
        const rendered = await pixels(page);
        expect(rendered.referencesBelow).toBe(true);
        expect(rendered.overlap).toEqual(rendered.expected);
        expect(rendered.alone).toEqual(rendered.expected);
        await category(page, otherKind);
        const check = page.getByRole("checkbox", {
          name: "Mostrar Referencia",
          exact: true,
        });
        await check.check();
        await check.uncheck();
      }
      await expect(page.locator("path.viewer-route-selected")).toHaveCount(1);
      await expect(page.locator("path.viewer-route-selected")).toHaveAttribute(
        "data-route-id",
        kind,
      );
      expect(
        await page
          .locator("path.viewer-route-selected")
          .evaluate((node) => node === window.originalSelectedPath),
      ).toBe(true);
      const final = await pixels(page);
      expect(final.overlap).toEqual(final.expected);
      expect(final.alone).toEqual(final.expected);
      expect(await persisted(page)).toEqual(original);
      await page.screenshot({ path: info.outputPath("solid-overlap.png") });
      const point = await page
        .locator("path.viewer-route-selected")
        .evaluate((path) => {
          const point = path.getPointAtLength(path.getTotalLength() / 4);
          const screen = new DOMPoint(point.x, point.y).matrixTransform(
            path.getScreenCTM(),
          );
          return { x: screen.x, y: screen.y };
        });
      await page.mouse.click(point.x, point.y);
      await expect(page.locator(".viewer-route-popup strong")).toHaveText(
        "Activa",
      );
      await expect(
        page
          .locator(".viewer-route-popup")
          .getByRole("button", { name: "Enviar al editor", exact: true }),
      ).toBeVisible();
    });
  }
}
