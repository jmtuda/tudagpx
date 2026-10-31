import { test, expect } from "@playwright/test";

const points = [
  { lat: 40.75, lon: -3.98, ele: 100 },
  { lat: 40.751, lon: -3.98, ele: 120 },
  { lat: 40.755, lon: -3.98, ele: null },
  { lat: 40.758, lon: -3.98, ele: 150 },
  { lat: 40.759, lon: -3.98, ele: 160 },
  { lat: 40.76, lon: -3.98, ele: 130 },
];
async function mount(page) {
  await page.goto("/");
  await page.evaluate(async (points) => {
    const { default: React } =
      await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } =
      await import("/node_modules/.vite/deps/react-dom_client.js");
    const { WorkspaceMap } = await import("/src/components/WorkspaceMap.jsx");
    document.querySelector("#root").style.display = "none";
    const host = document.createElement("div");
    host.id = "profile-overlay-harness";
    host.style.cssText =
      "position:fixed;inset:0;display:flex;flex-direction:column;background:white;z-index:9999";
    document.body.append(host);
    const routes = [
      {
        id: "first",
        name: "Primera",
        tracks: [
          points,
          [
            { lat: 40.8, lon: -3.98, ele: 300 },
            { lat: 40.801, lon: -3.98, ele: 310 },
          ],
        ],
      },
      {
        id: "second",
        name: "Segunda",
        tracks: [
          [
            { lat: 40.75, lon: -3.97, ele: 80 },
            { lat: 40.755, lon: -3.97, ele: 90 },
          ],
        ],
      },
    ];
    const draft = [
      {
        id: "first-copy",
        editorRouteId: "first-file",
        name: "Primera copia",
        points: routes[0].tracks[1],
      },
      {
        id: "second-copy",
        editorRouteId: "second-file",
        name: "Segunda copia",
        points,
      },
      {
        id: "second-part",
        editorRouteId: "second-file",
        name: "Parte separada",
        points: routes[0].tracks[1],
      },
    ];
    const data = { routes, draft, segments: [] },
      noop = () => {};
    const focus = { points };
    window.overlayTest = { data, ranges: [], draws: [] };
    function Harness() {
      const [viewing, setViewing] = React.useState(true);
      const [mode, setMode] = React.useState("edit");
      const [crop, setCrop] = React.useState({
        start: 0,
        end: points.length - 1,
      });
      const [visible, setVisible] = React.useState(["second", "first"]);
      const [active, setActive] = React.useState("second-copy");
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "nav",
          null,
          React.createElement(
            "button",
            { onClick: () => setViewing(true) },
            "Visor prueba",
          ),
          React.createElement(
            "button",
            { onClick: () => setViewing(false) },
            "Editor prueba",
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                setViewing(false);
                setMode("crop");
              },
            },
            "Recorte prueba",
          ),
          React.createElement(
            "button",
            { onClick: () => setVisible(["second"]) },
            "Solo segunda",
          ),
        ),
        React.createElement(WorkspaceMap, {
          data,
          viewing,
          visibleRoutes: visible,
          onToggleRoute: noop,
          onDropFiles: noop,
          bounds: { south: 40, north: 41, west: -4, east: -3 },
          selected: [],
          hidden: [],
          onHover: noop,
          onBounds: noop,
          focus,
          active,
          mode,
          crop,
          pointIndex: 0,
          onSelect: setActive,
          editing: false,
          drawing: false,
          onDraw: (point) => window.overlayTest.draws.push(point),
          tools: {
            elements: draft,
            active,
            onSelectFile: setActive,
            mergeSelection: [],
            onCloseRoute: noop,
            onRange: (range) => {
              window.overlayTest.ranges.push(range);
              setCrop(range);
            },
          },
        }),
      );
    }
    ReactDOM.createRoot(host).render(React.createElement(Harness));
  }, points);
  await expect(
    page.locator("#profile-overlay-harness .elevation-route-metric"),
  ).toHaveCount(2);
}

async function assertColors(page, editor = false) {
  await expect(
    page
      .locator(
        `#profile-overlay-harness ${editor ? ".leaflet-overlay-pane path[fill=none]" : "path.viewer-route-selected"}`,
      )
      .first(),
  ).toBeAttached();
  const result = await page.evaluate((editor) => {
    const host = document.querySelector("#profile-overlay-harness");
    return [...host.querySelectorAll(".elevation-route-metric")].map(
      (metric) => {
        const group = [...host.querySelectorAll("svg g[data-route-id]")].find(
          (node) => node.dataset.routeId === metric.dataset.routeId,
        );
        const path = group.querySelector(".elevation-run path");
        const mapPaths = [
          ...host.querySelectorAll(
            editor
              ? ".leaflet-overlay-pane path[fill=none]"
              : "path.viewer-route-selected",
          ),
        ];
        return {
          metric: getComputedStyle(metric).color,
          chart: getComputedStyle(path).stroke,
          map: mapPaths.map((line) => getComputedStyle(line).stroke),
        };
      },
    );
  }, editor);
  for (const entry of result) {
    expect(entry.chart).toBe(entry.metric);
    expect(entry.map).toContain(entry.metric);
  }
}

test("visor: perfiles superpuestos, ejes comunes reales, huecos y colores exactos", async ({
  page,
}) => {
  await mount(page);
  await expect(page.locator("#profile-overlay-harness .map-shell")).toHaveClass(
    /has-elevation-profile/,
  );
  const metrics = page.locator(
    "#profile-overlay-harness .elevation-route-metric",
  );
  await expect(metrics.nth(0)).toContainText("Primera");
  await expect(metrics.nth(0)).toHaveAttribute("data-ascent", "40");
  await expect(metrics.nth(1)).toHaveAttribute("data-ascent", "10");
  await expect(
    page.locator("#profile-overlay-harness .elevation-run"),
  ).toHaveCount(4);
  await assertColors(page);
  const actual = await page.evaluate(async () => {
    const { distance } = await import("/src/utils/workspace.js");
    return window.overlayTest.data.routes.map((route) =>
      route.tracks.reduce(
        (sum, track) =>
          sum +
          track.slice(1).reduce((d, p, i) => d + distance(track[i], p), 0),
        0,
      ),
    );
  });
  expect(
    Number(await metrics.nth(0).getAttribute("data-distance")),
  ).toBeCloseTo(actual[0], 8);
  expect(
    Number(await metrics.nth(1).getAttribute("data-distance")),
  ).toBeCloseTo(actual[1], 8);
  const spans = await page
    .locator("#profile-overlay-harness svg g[data-route-id]")
    .evaluateAll((groups) =>
      groups.map((group) => {
        const paths = [...group.querySelectorAll("path")];
        const start = paths[0].getPointAtLength(0).x;
        const last = paths.at(-1);
        return last.getPointAtLength(last.getTotalLength()).x - start;
      }),
    );
  expect(spans[1] / spans[0]).toBeCloseTo(actual[1] / actual[0], 5);
  const slider = page.getByRole("slider", {
    name: "Explorar perfil de altitud",
  });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".elevation-map-marker")).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", /sin altitud/);
  const button = page.getByRole("button", {
    name: "Minimizar perfil de altitud",
  });
  expect(await button.innerText()).not.toMatch(/perfil|Minimizar/);
  await page.screenshot({ path: "test-results/profile-overlay/viewer.png" });
  await button.click();
  await expect(slider).toBeHidden();
  await page.getByRole("button", { name: "Mostrar perfil de altitud" }).click();
  await page.getByRole("button", { name: "Solo segunda" }).click();
  await expect(metrics).toHaveCount(1);
  await expect(metrics).toContainText("Segunda");
  await assertColors(page);
});

for (const width of [1440, 390]) {
  test(`editor y recorte abajo estables con métricas solo del slice ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mount(page);
    const original = await page.evaluate(() =>
      JSON.stringify(window.overlayTest.data),
    );
    await page.getByRole("button", { name: "Editor prueba" }).click();
    const metric = page.locator(
      "#profile-overlay-harness .elevation-route-metric",
    );
    await expect(metric).toHaveCount(1);
    await expect(metric).toHaveAttribute("data-ascent", "40");
    await assertColors(page, true);
    const tabs = page.locator("#profile-overlay-harness .editor-loaded-routes");
    expect(
      await tabs.evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    for (const tab of await tabs.getByRole("tab").all())
      expect(
        await tab.evaluate((node) => getComputedStyle(node).backgroundColor),
      ).toMatch(/^rgb\(/);
    await page.getByRole("button", { name: "Recorte prueba" }).click();
    // Cropping excludes even other tracks belonging to the same active file.
    await expect(metric).toHaveAttribute("data-ascent", "30");
    const start = page.getByRole("slider", {
      name: "Inicio del recorte",
      exact: true,
    });
    const end = page.getByRole("slider", {
      name: "Final del recorte",
      exact: true,
    });
    await expect(start).toHaveCount(1);
    await expect(end).toHaveCount(1);
    await end.fill("4");
    await start.fill("3");
    await expect(metric).toHaveAttribute("data-ascent", "10");
    await expect(
      page.locator("#profile-overlay-harness .elevation-run"),
    ).toHaveCount(1);
    const expected = await page.evaluate(
      async (points) =>
        (await import("/src/utils/workspace.js")).distance(
          points[3],
          points[4],
        ),
      points,
    );
    expect(Number(await metric.getAttribute("data-distance"))).toBeCloseTo(
      expected,
      8,
    );
    const strip = page.getByRole("img", {
      name: "Perfil para seleccionar el recorte; arrastra sobre él",
    });
    const box = await strip.boundingBox();
    const chart = await page
      .getByRole("slider", { name: "Explorar perfil de altitud" })
      .boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(chart.y + chart.height);
    // Original distance domain is 0..1.11km; 10% = point 1, 90% = point 4.
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(start).toHaveValue("1");
    await expect(end).toHaveValue("4");
    // Repeating with the exact same pixels must not shrink/shift the selection.
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(start).toHaveValue("1");
    await expect(end).toHaveValue("4");
    await assertColors(page, true);
    await page.screenshot({
      path: `test-results/profile-overlay/crop-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Minimizar perfil de altitud" })
      .click();
    await expect(start).toBeHidden();
    expect(
      await page.evaluate(() => JSON.stringify(window.overlayTest.data)),
    ).toBe(original);
    expect(await page.evaluate(() => window.overlayTest.draws)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
