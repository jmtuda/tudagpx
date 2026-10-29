import { test, expect } from "@playwright/test";

const gpx =
  '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Prueba pública Madrid</name><trkseg><trkpt lat="40.4168" lon="-3.7038"/><trkpt lat="40.4184" lon="-3.7019"/><trkpt lat="40.4200" lon="-3.7000"/></trkseg></trk></gpx>';
async function imported(page) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "prueba-publica.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx),
    });
  await page
    .getByRole("button", { name: "Editar copia", exact: true })
    .last()
    .click();
}
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function drag(page, locator, dx, dy) {
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, {
    steps: 8,
  });
  await page.mouse.up();
}

test("BRouter real desde navegador: carretera, gravel y MTB; GPX exportable", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { followRoads, routingProfiles } =
      await import("/src/utils/routing.js");
    const { exportGPX, parseGPX } = await import("/src/utils/workspace.js");
    const counts = [];
    for (const profile of Object.keys(routingProfiles)) {
      const points = await followRoads(
        [
          { lat: 40.4168, lon: -3.7038 },
          { lat: 40.42, lon: -3.7 },
        ],
        profile,
      );
      const xml = exportGPX([{ points }], "Cálculo real");
      const parsed = parseGPX(xml, "prueba.gpx");
      counts.push({
        profile,
        count: points.length,
        exported: parsed.tracks[0].length,
      });
    }
    return counts;
  });
  for (const r of result) {
    expect(r.count).toBeGreaterThan(2);
    expect(r.exported).toBe(r.count);
  }
});

test("editar GPX por caminos real, deshacer y conservar original", async ({
  page,
}) => {
  test.setTimeout(90000);
  await imported(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const before = await state(page);
  await expect(
    page.getByLabel("Seguir caminos", { exact: true }),
  ).toBeChecked();
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().startsWith("https://brouter.de/brouter?")) calls++;
  });
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  expect(calls).toBe(0);
  expect((await state(page)).draft).toEqual(before.draft);
  await page.getByRole("button", { name: "Mostrar herramientas" }).click();
  await page
    .getByRole("button", { name: "Permitir cálculo con BRouter", exact: true })
    .click();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toHaveCount(0, { timeout: 65000 });
  const after = await state(page);
  expect(after.draft[0].points.length).toBeGreaterThan(3);
  expect(after.routes.at(-1)).toEqual(before.routes.at(-1));
  expect(calls).toBe(2);
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  expect((await state(page)).draft).toEqual(before.draft);
  await page.getByRole("button", { name: "↷ Rehacer" }).click();
  expect((await state(page)).draft[0].points).toEqual(after.draft[0].points);
  await drag(page, page.locator(".insert-handle").first(), 25, -12);
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toHaveCount(0, { timeout: 65000 });
  expect(calls).toBe(4);
  const inserted = await state(page);
  expect(inserted.draft[0].points).not.toEqual(after.draft[0].points);
  expect(inserted.routes.at(-1)).toEqual(before.routes.at(-1));
  await page.getByRole("button", { name: "↶ Deshacer" }).click();
  expect((await state(page)).draft[0].points).toEqual(after.draft[0].points);
  expect(errors).toEqual([]);
});

test("crear un track por caminos con clics reales y recuperarlo al recargar", async ({
  page,
}) => {
  test.setTimeout(90000);
  await imported(page);
  await page
    .getByRole("button", { name: "Permitir cálculo con BRouter", exact: true })
    .click();
  const a = await page
    .getByTitle("Editar punto 1", { exact: true })
    .boundingBox();
  const b = await page
    .getByTitle("Editar punto 3", { exact: true })
    .boundingBox();
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  await page.mouse.click(a.x + 24, a.y + 8);
  await page.mouse.click(b.x + 24, b.y + 8);
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar cálculo" }),
  ).toHaveCount(0, { timeout: 35000 });
  const data = await state(page);
  expect(data.draft.at(-1).points.length).toBeGreaterThan(2);
  await page.reload();
  expect((await state(page)).draft).toEqual(data.draft);
});

test("fallo y cancelación conservan geometría; modo libre no llama al servicio", async ({
  page,
}) => {
  await imported(page);
  await page
    .getByRole("button", { name: "Permitir cálculo con BRouter", exact: true })
    .click();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  const before = await state(page);
  await page.route("https://brouter.de/brouter?**", (r) =>
    r.fulfill({ status: 503, body: "No disponible" }),
  );
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  await expect(page.getByText(/El trazado anterior se conserva/)).toBeVisible();
  expect((await state(page)).draft).toEqual(before.draft);
  await page.unroute("https://brouter.de/brouter?**");
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("https://brouter.de/brouter?**", async (r) => {
    await held;
    await r.abort().catch(() => {});
  });
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  await page.getByRole("button", { name: "Cancelar cálculo" }).click();
  release();
  expect((await state(page)).draft).toEqual(before.draft);
  await page.getByRole("button", { name: "Mostrar herramientas" }).click();
  await page.getByLabel("Seguir caminos", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Minimizar herramientas" }).click();
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  expect((await state(page)).draft[0].points).toHaveLength(3);
  expect((await state(page)).draft[0].points[1]).not.toEqual(
    before.draft[0].points[1],
  );
});
