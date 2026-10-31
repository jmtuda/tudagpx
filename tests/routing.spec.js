import { test, expect } from "@playwright/test";
import { pinLibraries, sendLibraryItem } from "./helpers/library";

const gpx =
  '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Prueba pública Madrid</name><trkseg><trkpt lat="40.4168" lon="-3.7038"/><trkpt lat="40.4184" lon="-3.7019"/><trkpt lat="40.4200" lon="-3.7000"/></trkseg></trk></gpx>';
async function imported(page) {
  await page.goto("/");
  await pinLibraries(page);
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "prueba-publica.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx),
    });
  await sendLibraryItem(page, "route", -1);
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

test("BRouter real: asfalto, pistas y senderos sin penalizar firme; GPX exportable", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  const responses = [];
  page.on("response", (response) => {
    if (response.url().startsWith("https://brouter.de/brouter?"))
      responses.push(response.json());
  });
  const result = await page.evaluate(async () => {
    const { followRoads } = await import("/src/utils/routing.js");
    const { exportGPX, parseGPX } = await import("/src/utils/workspace.js");
    const counts = [];
    const cases = [
      [
        "asfalto",
        [
          { lat: 40.4168, lon: -3.7038 },
          { lat: 40.42, lon: -3.7 },
        ],
      ],
      [
        "pista",
        [
          { lat: 40.523073, lon: -3.760037 },
          { lat: 40.534873, lon: -3.772258 },
        ],
      ],
      [
        "sendero",
        [
          { lat: 40.751, lon: -3.994 },
          { lat: 40.759, lon: -3.989 },
        ],
      ],
    ];
    for (const [name, anchors] of cases) {
      const points = await followRoads(anchors);
      const xml = exportGPX([{ points }], "Cálculo real");
      const parsed = parseGPX(xml, "prueba.gpx");
      counts.push({
        name,
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
  const actual = await Promise.all(responses);
  expect(actual).toHaveLength(3);
  const tags = actual.map((json) =>
    json.features[0].properties.messages
      .slice(1)
      .map((row) => row[9])
      .join(" "),
  );
  expect(tags[0]).toContain("surface=asphalt");
  expect(tags[1]).toContain("highway=track");
  expect(tags[1]).toContain("surface=dirt");
  expect(tags[2]).toContain("highway=path");
  expect(tags[2]).toContain("surface=gravel");
  for (const json of actual) {
    for (const row of json.features[0].properties.messages.slice(1))
      expect(Number(row[4])).toBe(1000);
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
  await expect(
    page.getByLabel("Seguir caminos", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Seguir caminos", { exact: true }),
  ).toHaveAttribute("aria-description", /BRouter.*coordenadas.*nunca el GPX/);
  await expect(
    page.getByRole("button", {
      name: "Permitir cálculo con BRouter",
      exact: true,
    }),
  ).toHaveCount(0);
  const profiles = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://brouter.de/brouter?")) {
      calls++;
      profiles.push(new URL(r.url()).searchParams.get("profile"));
    }
  });

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
  expect(profiles).toHaveLength(2);
  expect(profiles[0]).toMatch(/^custom_/);
  expect(profiles[1]).toBe(profiles[0]);
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

  await page.getByLabel("Seguir caminos", { exact: true }).uncheck();

  const revoked = await state(page);
  await drag(page, page.getByTitle(/^Editar punto /).first(), 25, -10);
  const freeEdited = await state(page);
  expect(freeEdited.draft).not.toEqual(revoked.draft);
  expect(freeEdited.routes).toEqual(revoked.routes);
  expect(calls).toBe(4);

  await page.getByLabel("Seguir caminos", { exact: true }).check();
  expect(errors).toEqual([]);
});

test("crear un track por caminos con clics reales y recuperarlo al recargar", async ({
  page,
}) => {
  test.setTimeout(90000);
  await imported(page);
  const a = await page
    .getByTitle("Editar punto 1", { exact: true })
    .boundingBox();
  const b = await page
    .getByTitle("Editar punto 3", { exact: true })
    .boundingBox();
  await page.getByRole("button", { name: "+ Dibujar", exact: true }).click();

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
  await expect(
    page.getByLabel("Seguir caminos", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Seguir caminos", { exact: true }),
  ).toHaveAttribute("aria-description", /BRouter.*coordenadas.*nunca el GPX/);
});

test("fallo y cancelación conservan geometría; modo libre no llama al servicio", async ({
  page,
}) => {
  await imported(page);

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

  await page.getByLabel("Seguir caminos", { exact: true }).uncheck();

  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  expect((await state(page)).draft[0].points).toHaveLength(3);
  expect((await state(page)).draft[0].points[1]).not.toEqual(
    before.draft[0].points[1],
  );
});

test("fallo y cancelación al preparar el perfil conservan originales y copias", async ({
  page,
}) => {
  await imported(page);
  const before = await state(page);

  let calculations = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("https://brouter.de/brouter?")) calculations++;
  });
  await page.route("https://brouter.de/brouter/profile", (route) =>
    route.fulfill({ status: 503, body: "Fallo explícito de prueba" }),
  );
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  await expect(page.getByText(/El trazado anterior se conserva/)).toBeVisible();
  expect((await state(page)).draft).toEqual(before.draft);
  await page.unroute("https://brouter.de/brouter/profile");
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("https://brouter.de/brouter/profile", async (route) => {
    await held;
    await route.abort().catch(() => {});
  });
  await drag(page, page.getByTitle("Editar punto 2", { exact: true }), 25, -10);
  await page
    .getByRole("button", { name: "Cancelar cálculo", exact: true })
    .click();
  release();
  const after = await state(page);
  expect(after.draft).toEqual(before.draft);
  expect(after.routes).toEqual(before.routes);
  expect(calculations).toBe(0);
});
