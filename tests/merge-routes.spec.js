import { test, expect } from "@playwright/test";

const files = (page) =>
  page.getByRole("tablist", { name: "Rutas cargadas en el editor" });
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function seed(page, gaps = false) {
  await page.addInitScript(() =>
    localStorage.setItem("tudagpx-workspace", "edit"),
  );
  await page.goto("/");
  await state(page);
  await page.evaluate(async (gaps) => {
    const store = await import("/src/utils/localStore.js");
    const d = await store.loadWorkspace();
    const p = (lat, lon) => ({ lat, lon, ele: null });
    const pts = gaps
      ? [
          [p(40.4168, -3.7038), p(40.417, -3.7035)],
          [p(40.4184, -3.7019), p(40.4186, -3.7017)],
          [p(40.42, -3.7), p(40.4202, -3.6998)],
        ]
      : [
          [p(40.75, -3.98), p(40.751, -3.979)],
          [p(40.751, -3.979), p(40.752, -3.978)],
          [p(40.752, -3.978), p(40.753, -3.977)],
        ];
    d.draft = pts.map((points, i) => ({
      id: `element-${i}`,
      editorRouteId: `file-${i}`,
      editorRouteName: `Ruta ${i + 1}`,
      name: `Ruta ${i + 1}`,
      points,
    }));
    await store.saveWorkspace(d);
  }, gaps);
  await page.reload();
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await expect(files(page).getByRole("tab")).toHaveCount(3);
  return state(page);
}
async function select(page, modifier = "Control") {
  await files(page).getByRole("tab", { name: "Ruta 1", exact: true }).click();
  await files(page)
    .getByRole("tab", { name: "Ruta 2", exact: true })
    .click({ modifiers: [modifier] });
  await files(page)
    .getByRole("tab", { name: "Ruta 3", exact: true })
    .click({ modifiers: [modifier] });
  await expect(files(page).getByRole("tab", { selected: true })).toHaveCount(3);
}
for (const modifier of ["Control", "Meta"]) {
  test(`unir tres trazados contiguos con ${modifier}, deshacer y recargar`, async ({
    page,
  }) => {
    const before = await seed(page);
    let requests = 0;
    await page.route("https://brouter.de/brouter**", (route) => {
      requests++;
      return route.abort();
    });
    await select(page, modifier);
    await page
      .getByRole("button", { name: "Unir trazados", exact: true })
      .click();
    await expect(files(page).getByRole("tab")).toHaveCount(1);
    const merged = await state(page);
    expect(merged.draft).toHaveLength(1);
    expect(merged.draft[0].points).toEqual([
      before.draft[0].points[0],
      ...before.draft.map((e) => e.points[1]),
    ]);
    expect(merged.routes).toEqual(before.routes);
    expect(requests).toBe(0);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(before.draft);
    await page.getByRole("button", { name: "↷ Rehacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(merged.draft);
    await page.reload();
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    expect((await state(page)).draft).toEqual(merged.draft);
    await expect(files(page).getByRole("tab")).toHaveCount(1);
  });
}

test("dos trazados, quitar de selección y conservar el tercero", async ({
  page,
}) => {
  const before = await seed(page);
  await select(page, "Meta");
  await files(page)
    .getByRole("tab", { name: "Ruta 3", exact: true })
    .click({ modifiers: ["Meta"] });
  await expect(files(page).getByRole("tab", { selected: true })).toHaveCount(2);
  await page
    .getByRole("button", { name: "Unir trazados", exact: true })
    .click();
  const merged = await state(page);
  expect(merged.draft).toHaveLength(2);
  expect(merged.draft[1]).toEqual(before.draft[2]);
  expect(merged.draft[0].points).toEqual([
    ...before.draft[0].points,
    before.draft[1].points[1],
  ]);
  const ordered = await page.evaluate(async () => {
    const { orderedMergeElements } = await import("/src/utils/mergeRoutes.js");
    return orderedMergeElements(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      ["c", "a", "b"],
    ).map((e) => e.id);
  });
  expect(ordered).toEqual(["c", "a", "b"]);
});

test("conexiones reales sin preferencia de firme, permiso inicial y conservación de geometría", async ({
  page,
}) => {
  test.setTimeout(120000);
  const before = await seed(page, true);
  const calls = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://brouter.de/brouter?"))
      calls.push(new URL(r.url()));
  });
  await select(page);
  await page
    .getByRole("button", { name: "Unir trazados", exact: true })
    .click();
  await expect(files(page).getByRole("tab")).toHaveCount(1, { timeout: 90000 });
  const merged = await state(page);
  expect(calls).toHaveLength(2);
  for (const call of calls)
    expect(call.searchParams.get("profile")).toMatch(/^custom_/);
  expect(merged.draft[0].points.length).toBeGreaterThan(6);
  let index = -1;
  for (const point of before.draft.flatMap((e) => e.points)) {
    index = merged.draft[0].points.findIndex(
      (p, i) => i > index && p.lat === point.lat && p.lon === point.lon,
    );
    expect(index).toBeGreaterThanOrEqual(0);
  }
  expect(merged.routes).toEqual(before.routes);
  const parsed = await page.evaluate(async () => {
    const { loadWorkspace } = await import("/src/utils/localStore.js");
    const { exportGPX, parseGPX } = await import("/src/utils/workspace.js");
    const d = await loadWorkspace();
    return parseGPX(exportGPX(d.draft, "Unida"));
  });
  expect(parsed.tracks).toHaveLength(1);
  expect(parsed.tracks[0].length).toBe(merged.draft[0].points.length);
});

test("fallo y cancelación no cambian ninguna de las copias", async ({
  page,
}) => {
  const before = await seed(page, true);
  await page.route("https://brouter.de/brouter**", (route) =>
    route.fulfill({ status: 503, body: "Fallo de prueba" }),
  );
  await select(page);
  await page
    .getByRole("button", { name: "Unir trazados", exact: true })
    .click();
  await expect(page.getByText(/No se ha unido ningún trazado/)).toBeVisible();
  expect((await state(page)).draft).toEqual(before.draft);
  await page.unroute("https://brouter.de/brouter**");
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("https://brouter.de/brouter**", async (route) => {
    await gate;
    await route.abort().catch(() => {});
  });
  await page
    .getByRole("button", { name: "Unir trazados", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar cálculo" }).click();
  release();
  expect((await state(page)).draft).toEqual(before.draft);
  await expect(files(page).getByRole("tab")).toHaveCount(3);
});
