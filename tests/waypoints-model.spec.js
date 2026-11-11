import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("GPX UTF-8 root waypoints round trip, escaped descriptions, unchanged tracks", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { parseGPX, exportGPX } = await import("/src/utils/workspace.js");
    const source =
      '<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><desc>Fallback</desc></metadata><wpt lat="40.123456789" lon="-3.123456789"><ele>123.456</ele><name>Peña &amp; río 🧭</name><desc>Agua &lt;potable&gt; &quot;sí&quot;\nEspaña</desc></wpt><wpt lat="40.2" lon="-3.2"><name>Sin cota</name></wpt><trk><name>Ruta</name><desc>Descripción &amp; más</desc><trkseg><trkpt lat="40.123456789" lon="-3.123456789"><ele>9.123456789</ele></trkpt><trkpt lat="40.2" lon="-3.2"/></trkseg><trkseg><trkpt lat="41" lon="-4"/><trkpt lat="41.1" lon="-4.1"/></trkseg></trk></gpx>';
    const route = parseGPX(source);
    const before = JSON.stringify(route);
    const elements = route.tracks.map((points) => ({
      points,
      waypoints: route.waypoints,
      description: route.description,
    }));
    const output = exportGPX(elements, '<Ruta & "nombre">');
    const roundtrip = parseGPX(output);
    const xml = new DOMParser().parseFromString(output, "application/xml");
    return {
      unchanged: before === JSON.stringify(route),
      original: route.original === source,
      tracks: route.tracks,
      newTracks: roundtrip.tracks,
      wpts: route.waypoints.map(({ id: _id, ...point }) => point),
      newWpts: roundtrip.waypoints.map(({ id: _id, ...point }) => point),
      rootWpts: [...xml.documentElement.children].filter(
        (n) => n.localName === "wpt",
      ).length,
      trkpts: xml.getElementsByTagName("trkpt").length,
      description: roundtrip.description,
      name: roundtrip.name,
      output,
    };
  });
  expect(result.unchanged).toBe(true);
  expect(result.original).toBe(true);
  expect(result.newTracks).toEqual(result.tracks);
  expect(result.newWpts).toEqual(result.wpts);
  expect(result.rootWpts).toBe(2);
  expect(result.trkpts).toBe(4);
  expect(result.name).toBe('<Ruta & "nombre">');
  expect(result.description).toBe("Descripción & más");
  expect(result.output).toContain("&lt;potable&gt;");
});

test("legacy GPX and backups remain optional; rte and metadata descriptions supported", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { parseGPX, validateWorkspace } =
      await import("/src/utils/workspace.js");
    const legacy = {
      schema: 1,
      routes: [],
      segments: [],
      draft: [{ id: "old", name: "Old", points: [] }],
      projects: [],
      draftName: "Old",
    };
    const before = JSON.stringify(legacy);
    validateWorkspace(legacy);
    const route = parseGPX(
      '<gpx><metadata><desc>Metadata ñ</desc></metadata><rte><rtept lat="1" lon="2"/><rtept lat="2" lon="3"/></rte></gpx>',
    );
    const rte = parseGPX(
      '<gpx><rte><desc>Rte</desc><rtept lat="1" lon="2"/></rte></gpx>',
    );
    return {
      unchanged: before === JSON.stringify(legacy),
      waypoints: route.waypoints,
      completed: Object.hasOwn(route, "completed"),
      desc: route.description,
      rte: rte.description,
    };
  });
  expect(result).toEqual({
    unchanged: true,
    waypoints: [],
    completed: false,
    desc: "Metadata ñ",
    rte: "Rte",
  });
});

test("immutable group edits canonicalize, isolate legacy copies and permit undo", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const {
      getGroupWaypoints,
      copyWaypoints,
      upsertGroupWaypoint,
      removeGroupWaypoint,
    } = await import("/src/utils/waypoints.js");
    const p = {
      id: "w",
      lat: 1,
      lon: 2,
      ele: null,
      name: "Fuente",
      description: "Agua",
    };
    const draft = [
      { id: "a", editorRouteId: "file", points: [], waypoints: [p] },
      { id: "b", editorRouteId: "file", points: [], waypoints: [p] },
      { id: "legacy", points: [], waypoints: [p] },
    ];
    const before = JSON.stringify(draft);
    const added = upsertGroupWaypoint(draft, "b", { ...p, id: "new" });
    const edited = upsertGroupWaypoint(added, "b", {
      ...p,
      description: "Editado",
    });
    const removed = removeGroupWaypoint(edited, "b", "new");
    const copied = copyWaypoints(getGroupWaypoints(draft, "b"));
    const moved = upsertGroupWaypoint(
      [{ ...draft[0], waypoints: undefined }, draft[1]],
      "b",
      p,
    );
    return {
      unchanged: before === JSON.stringify(draft),
      lengths: [added[0].waypoints.length, removed[0].waypoints.length],
      noSecondary: !Object.hasOwn(edited[1], "waypoints"),
      legacySame: edited[2] === draft[2],
      copyId: copied[0].id !== p.id,
      copyObject: copied[0] !== p,
      description: getGroupWaypoints(removed, "b")[0].description,
      legacy: getGroupWaypoints(edited, "legacy")[0].description,
      moved: moved[0].waypoints.length,
      missingSame: removeGroupWaypoint(draft, "missing", "w") === draft,
    };
  });
  expect(result).toEqual({
    unchanged: true,
    lengths: [2, 1],
    noSecondary: true,
    legacySame: true,
    copyId: true,
    copyObject: true,
    description: "Editado",
    legacy: "Agua",
    moved: 1,
    missingSame: true,
  });
});

test("schema rejects invalid waypoints and metadata across routes, segments, drafts and projects", async ({
  page,
}) => {
  const results = await page.evaluate(async () => {
    const { validateWorkspace, exportGPX, parseGPX } =
      await import("/src/utils/workspace.js");
    const p = { id: "w", lat: 1, lon: 2, name: "", description: "" };
    const bad = [
      null,
      {},
      { ...p, id: "" },
      { ...p, lat: 91 },
      { ...p, lon: Infinity },
      { ...p, lat: "1" },
      { ...p, ele: NaN },
      { ...p, name: 2 },
      { ...p, description: null },
    ];
    const checks = [];
    for (const collection of ["routes", "segments", "draft", "projects"]) {
      for (const waypoints of [null, {}, ...bad.map((v) => [v]), [p, p]]) {
        const state = {
          schema: 1,
          routes: [],
          segments: [],
          draft: [],
          projects: [],
          draftName: "",
        };
        const item = {
          id: "a",
          name: "a",
          tracks: [[{ lat: 1, lon: 2 }]],
          points: [{ lat: 1, lon: 2 }],
          waypoints,
        };
        state[collection] =
          collection === "projects"
            ? [{ id: "project", name: "project", elements: [item] }]
            : [item];
        try {
          validateWorkspace(state);
          checks.push(false);
        } catch {
          checks.push(true);
        }
      }
    }
    for (const metadata of [{ completed: "yes" }, { description: 1 }]) {
      try {
        validateWorkspace({
          schema: 1,
          routes: [],
          segments: [],
          draft: [{ id: "d", name: "d", points: [], ...metadata }],
          projects: [],
          draftName: "",
        });
        checks.push(false);
      } catch {
        checks.push(true);
      }
    }
    try {
      exportGPX(
        [
          {
            points: [
              { lat: 1, lon: 2 },
              { lat: 2, lon: 3 },
            ],
            waypoints: [{ ...p, lat: 100 }],
          },
        ],
        "bad",
      );
      checks.push(false);
    } catch {
      checks.push(true);
    }
    try {
      parseGPX(
        '<gpx><wpt lat="99" lon="1"/><trk><trkseg><trkpt lat="1" lon="2"/></trkseg></trk></gpx>',
      );
      checks.push(false);
    } catch {
      checks.push(true);
    }
    return checks;
  });
  expect(results.every(Boolean)).toBe(true);
});

test("Leaflet layer adds only in waypoint mode, accessible popup and read-only markers", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const { default: React } =
      await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } =
      await import("/node_modules/.vite/deps/react-dom_client.js");
    const layerSource = await (
      await fetch("/src/components/WaypointLayer.jsx")
    ).text();
    const leafletModule = layerSource.match(
      /from\s+["']([^"']*react-leaflet[^"']*)["']/,
    )[1];
    const { MapContainer } = await import(leafletModule);
    const { WaypointLayer } = await import("/src/components/WaypointLayer.jsx");
    document.getElementById("root").style.display = "none";
    const host = document.createElement("div");
    document.body.append(host);
    const waypoint = {
      id: "w",
      lat: 40,
      lon: -3,
      name: "Fuente ñ",
      description: "Agua <potable>",
    };
    window.waypointCalls = [];
    function Harness() {
      const [adding, setAdding] = React.useState(false);
      const [readOnly, setReadOnly] = React.useState(false);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          { onClick: () => setAdding(!adding) },
          "Toggle adding",
        ),
        React.createElement(
          "button",
          { onClick: () => setReadOnly(!readOnly) },
          "Toggle read-only",
        ),
        React.createElement(
          MapContainer,
          {
            center: [40, -3],
            zoom: 10,
            style: { height: 400, width: 600 },
            zoomControl: false,
          },
          React.createElement(WaypointLayer, {
            elements: [{ id: "a", points: [], waypoints: [waypoint] }],
            active: "a",
            adding,
            readOnly,
            onAdd: (point) => window.waypointCalls.push(["add", point]),
            onEdit: (point) => window.waypointCalls.push(["edit", point]),
          }),
        ),
      );
    }
    ReactDOM.createRoot(host).render(React.createElement(Harness));
  });
  const map = page.locator(".leaflet-container:visible");
  await map.click({ position: { x: 100, y: 100 } });
  expect(await page.evaluate(() => window.waypointCalls)).toEqual([]);
  await page.getByRole("button", { name: "Toggle adding" }).click();
  await map.click({ position: { x: 100, y: 100 } });
  const calls = await page.evaluate(() => window.waypointCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe("add");
  expect(calls[0][1].ele).toBeNull();
  const marker = page.getByRole("button", { name: "Fuente ñ", exact: true });
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".waypoint-popup")).toContainText("Agua <potable>");
  await page
    .getByRole("button", { name: "Editar waypoint", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.waypointCalls)).map((v) => v[0]),
  ).toEqual(["add", "edit"]);
  await page.getByRole("button", { name: "Toggle read-only" }).click();
  await expect(
    page.getByRole("button", { name: "Editar waypoint", exact: true }),
  ).toHaveCount(0);
  await map.click({ position: { x: 100, y: 100 } });
  expect(
    (await page.evaluate(() => window.waypointCalls)).map((v) => v[0]),
  ).toEqual(["add", "edit"]);
});

async function mountDialog(page, request) {
  await page.evaluate(async (request) => {
    const { default: React } =
      await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } =
      await import("/node_modules/.vite/deps/react-dom_client.js");
    const { WaypointDialog } =
      await import("/src/components/WaypointDialog.jsx");
    document.getElementById("root").style.display = "none";
    const host = document.createElement("div");
    document.body.append(host);
    window.waypointCalls = [];
    ReactDOM.createRoot(host).render(
      React.createElement(WaypointDialog, {
        request,
        onSave: (point) => window.waypointCalls.push(["save", point]),
        onCancel: () => window.waypointCalls.push(["cancel"]),
        onDelete: (point) => window.waypointCalls.push(["delete", point]),
      }),
    );
  }, request);
}

test("dialog requires description, defaults name and returns complete waypoint", async ({
  page,
}) => {
  await mountDialog(page, { point: { lat: 40, lon: -3, ele: null } });
  const dialog = page.getByRole("dialog", { name: "Añadir waypoint" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Descripción").fill("   ");
  await dialog.getByRole("button", { name: "Guardar waypoint" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Escribe una descripción",
  );
  await dialog.getByLabel("Nombre").fill("");
  await dialog.getByLabel("Descripción").fill("  Fuente ñ & <agua>  ");
  await dialog.getByRole("button", { name: "Guardar waypoint" }).click();
  const calls = await page.evaluate(() => window.waypointCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0][1]).toMatchObject({
    lat: 40,
    lon: -3,
    ele: null,
    name: "Waypoint",
    description: "Fuente ñ & <agua>",
  });
  expect(calls[0][1].id).toBeTruthy();
});

test("dialog delegates delete confirmation once and Escape cancels", async ({
  page,
}) => {
  const point = {
    id: "w",
    lat: 40,
    lon: -3,
    name: "Agua",
    description: "Potable",
  };
  await mountDialog(page, { point, waypoint: point });
  await page.getByRole("button", { name: "Borrar waypoint" }).click();
  expect(await page.evaluate(() => window.waypointCalls)).toEqual([
    ["delete", point],
  ]);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.waypointCalls)).toEqual([
    ["delete", point],
    ["cancel"],
  ]);
});
