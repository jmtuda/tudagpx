import { test, expect } from "@playwright/test";

// Deliberately disconnected tracks and uneven point spacing exercise actual
// distances, missing elevations and the WorkspaceMap callback contract.
const tracks = [
  { id: "a", editorRouteId: "file", editorRouteName: "Archivo multitramos", name: "Parte A", points: [
    { lat: 40.75, lon: -3.98, ele: 100 },
    { lat: 40.751, lon: -3.98, ele: 120 },
    { lat: 40.759, lon: -3.98, ele: null },
    { lat: 40.76, lon: -3.98, ele: 140 },
  ] },
  { id: "b", editorRouteId: "file", name: "Parte B", points: [
    { lat: 40.78, lon: -3.98, ele: 200 },
    { lat: 40.782, lon: -3.98, ele: 210 },
  ] },
  { id: "c", editorRouteId: "other", name: "Sin altitud", points: [
    { lat: 40.75, lon: -3.97, ele: null },
    { lat: 40.76, lon: -3.97, ele: null },
  ] },
];

async function mountWorkspace(page) {
  await page.goto("/");
  await page.evaluate(async (elements) => {
    const { default: React } = await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { createRoot } = ReactDOM;
    const { WorkspaceMap } = await import("/src/components/WorkspaceMap.jsx");
    document.querySelector("#root").style.display = "none";
    const host = document.createElement("div");
    host.id = "elevation-test-workspace";
    host.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;background:white;z-index:9999";
    document.body.append(host);
    const noop = () => {};
    const route = { id: "original", name: "Original protegido", tracks: [elements[0].points], original: "GPX original sin cambios" };
    window.elevationTest = { transfers: [], draws: [], toggles: [], original: JSON.stringify(route), elements };
    function Harness() {
      const [viewing, setViewing] = React.useState(false);
      const [active, setActive] = React.useState("a");
      const [visible, setVisible] = React.useState([]);
      const [draft, setDraft] = React.useState(elements);
      return React.createElement(React.Fragment, null,
        React.createElement("nav", null,
          React.createElement("button", { onClick: () => setViewing(true) }, "Visor de prueba"),
          React.createElement("button", { onClick: () => setViewing(false) }, "Editor de prueba")),
        React.createElement(WorkspaceMap, {
          data: { routes: [route], draft, segments: [] }, viewing, visibleRoutes: visible,
          onToggleRoute: (id) => { window.elevationTest.toggles.push(id); setVisible((ids) => ids.includes(id) ? [] : [id]); },
          onSendRoute: (original) => { window.elevationTest.transfers.push(structuredClone(original)); setViewing(false); },
          onDropFiles: noop, bounds: { south: 40, north: 41, west: -4, east: -3 }, selected: [], hidden: [], onHover: noop,
          onBounds: noop, drawing: false, onDraw: (point) => window.elevationTest.draws.push(point),
          focus: { points: elements[0].points }, active, pointIndex: 0, onSelect: setActive,
          editing: false, mode: "edit", tools: { elements: draft, active, onSelectFile: setActive,
            onCloseRoute: (id) => setDraft((old) => old.filter((e) => (e.editorRouteId || e.id) !== id)) },
        }));
    }
    createRoot(host).render(React.createElement(Harness));
  }, tracks);
  await expect(page.locator("#elevation-test-workspace .elevation-profile")).toBeVisible();
}

test("distancias geodésicas sin saltos y elevación ausente sin interpolar", async ({ page }) => {
  await mountWorkspace(page);
  const expected = await page.evaluate(async (elements) => {
    const { distance } = await import("/src/utils/workspace.js");
    const meters = elements.slice(0, 2).reduce((total, track) => total + track.points.slice(1).reduce((sum, p, i) => sum + distance(track.points[i], p), 0), 0);
    return (meters / 1000).toLocaleString("es", { maximumFractionDigits: 2 }) + " km";
  }, tracks);
  await expect(page.locator("#elevation-test-workspace .elevation-reading")).toHaveText(expected);
  const runs = page.locator("#elevation-test-workspace .elevation-run");
  await expect(runs).toHaveCount(3);
  await expect(runs.nth(1).locator("circle")).toHaveCount(1);
  const ranges = await runs.locator("path").evaluateAll((paths) => paths.map((path) => {
    const start = path.getPointAtLength(0);
    const end = path.getPointAtLength(path.getTotalLength());
    return [start.x, end.x];
  }));
  // First leg is one tenth of track A, not one third of its point indices.
  expect((ranges[0][1] - ranges[0][0]) / (ranges[1][0] - ranges[0][0])).toBeCloseTo(0.1, 5);
  // The next track starts at the same cumulative distance, with its own path.
  expect(ranges[2][0]).toBeCloseTo(ranges[1][0], 5);
  const slider = page.getByRole("slider", { name: "Explorar perfil de altitud" });
  await slider.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", /sin altitud/);
});

for (const width of [1440, 390]) {
  test(`perfil accesible, minimización persistente y pestañas opacas sobre contenedor transparente ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await mountWorkspace(page);
    const profile = page.getByRole("region", { name: "Perfil de altitud" });
    const slider = page.getByRole("slider", { name: "Explorar perfil de altitud" });
    await expect(profile.locator(".elevation-run")).toHaveCount(3);
    await expect(profile).toContainText("Altitud parcial");
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuetext", /100 metros/);
    await expect(page.locator("#elevation-test-workspace .elevation-map-marker")).toHaveCount(1);
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", /120 metros/);
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", /sin altitud/);
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuetext", /210 metros/);
    const box = await slider.boundingBox();
    // Pointer/touch follows the same read-only inspection path.
    await slider.dispatchEvent("pointerdown", { pointerType: "touch", clientX: box.x + box.width - 23, clientY: box.y + 40 });
    await expect(profile.locator("output")).toContainText("210 m");
    const tabs = page.locator("#elevation-test-workspace .editor-loaded-routes");
    expect(await tabs.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    for (const button of await tabs.getByRole("button").or(tabs.getByRole("tab")).all()) {
      const background = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(background).toMatch(/^rgb\(/);
    }
    const profileBox = await profile.boundingBox();
    const attribution = await page.locator(".leaflet-control-attribution").last().boundingBox();
    expect(attribution.y + attribution.height).toBeLessThanOrEqual(profileBox.y + 1);
    const tabsBox = await tabs.boundingBox();
    expect(tabsBox.y + tabsBox.height).toBeLessThanOrEqual(attribution.y + 1);
    await page.getByRole("button", { name: "Minimizar perfil de altitud" }).click();
    await expect(slider).toBeHidden();
    await page.getByRole("button", { name: "Visor de prueba" }).click();
    await page.getByRole("button", { name: "Editor de prueba" }).click();
    await expect(page.getByRole("button", { name: "Mostrar perfil de altitud" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Mostrar perfil de altitud" }).click();
    await page.getByRole("tab", { name: "Sin altitud", exact: true }).click();
    await expect(profile).toContainText("Sin datos de altitud");
    await expect(profile.locator(".elevation-run")).toHaveCount(0);
    expect(await page.evaluate(() => window.elevationTest.elements)).toEqual(tracks);
    expect(await page.evaluate(() => window.elevationTest.draws)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`) });
  });
}

test("clic izquierdo conserva toggle, abre popup y envía solo explícitamente una copia", async ({ page }) => {
  await mountWorkspace(page);
  await page.getByRole("button", { name: "Visor de prueba" }).click();
  async function clickRoute() {
    const point = await page.locator("#elevation-test-workspace path.viewer-route-reference, #elevation-test-workspace path.viewer-route").first().evaluate((path) => {
      const point = path.getPointAtLength(path.getTotalLength() * 0.4);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
  }
  await expect(page.locator("#elevation-test-workspace path.viewer-route-reference")).toHaveCount(1);
  await expect(page.locator("#elevation-test-workspace path.viewer-route-selected")).toHaveCount(0);
  await clickRoute();
  const popup = page.locator(".viewer-route-popup");
  await expect(popup).toContainText("Original protegido");
  expect(await page.evaluate(() => window.elevationTest.transfers)).toEqual([]);
  expect(await page.evaluate(() => window.elevationTest.toggles)).toEqual(["original"]);
  await page.getByRole("button", { name: "Editor de prueba" }).click();
  await expect(popup).toHaveCount(0);
  await page.getByRole("button", { name: "Visor de prueba" }).click();
  await expect(popup).toHaveCount(0);
  await clickRoute();
  await popup.getByRole("button", { name: "Enviar al editor", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(page.locator("#elevation-test-workspace .elevation-profile")).toBeVisible();
  const sent = await page.evaluate(() => window.elevationTest);
  expect(sent.transfers).toHaveLength(1);
  expect(JSON.stringify(sent.transfers[0])).toBe(sent.original);
  expect(sent.elements).toEqual(tracks);
});

test("integración real: popup desde referencia abre copia sin cambiar biblioteca", async ({ page }, testInfo) => {
  await page.goto("/");
  async function saved() {
    await expect(page.locator(".local-status > span")).toHaveText("Guardado en este navegador");
    return page.evaluate(async () => (await import("/src/utils/localStore.js")).loadWorkspace());
  }
  const before = await saved();
  const reference = page.locator("path.viewer-route-reference").first();
  const point = await reference.evaluate((path) => {
    const point = path.getPointAtLength(path.getTotalLength() * 0.4);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(point.x, point.y);
  const popup = page.locator(".viewer-route-popup");
  await expect(popup).toBeVisible();
  const routeName = await popup.locator("strong").textContent();
  const original = before.routes.find((route) => route.name === routeName);
  expect((await saved()).draft).toEqual(before.draft);
  await popup.getByRole("button", { name: "Enviar al editor", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Editar", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(popup).toHaveCount(0);
  const after = await saved();
  expect(after.routes).toEqual(before.routes);
  const copies = after.draft.slice(before.draft.length);
  expect(copies.map((element) => element.points)).toEqual(original.tracks);
  expect(new Set(copies.map((element) => element.editorRouteId)).size).toBe(1);
  await expect(page.locator(".elevation-profile")).toContainText(original.name);
  await page.screenshot({ path: testInfo.outputPath("real-integration.png") });
});
