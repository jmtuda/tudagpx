import test from "node:test";
import assert from "node:assert/strict";
import { validateChange } from "./workspaceTransport.js";

const points = [
  { lat: 40, lon: -3 },
  { lat: 40.01, lon: -3.01, ele: null },
];
const waypoint = {
  id: "w",
  lat: 40,
  lon: -3,
  name: "Fuente",
  description: "Agua ñ 🏔",
  ele: null,
};
const legacy = () => ({
  schema: 1,
  routes: [
    {
      id: "r",
      name: "Ruta",
      tracks: [points],
      original: "<gpx/>",
      originalBase64: "PGdweC8+",
    },
  ],
  segments: [{ id: "s", name: "Segmento", points }],
  draft: [{ id: "d", name: "Borrador", points: [] }],
  projects: [],
  draftName: "Prueba",
});

test("legacy metadata is optional, completed/description can change without rewriting originals", () => {
  const before = legacy(),
    after = structuredClone(before);
  for (const category of ["routes", "segments"])
    Object.assign(after[category][0], {
      completed: true,
      description: "Unicode ñ 🏔 <script>texto</script>",
    });
  assert.doesNotThrow(() => validateChange(after, before));
  assert.equal(Object.hasOwn(before.routes[0], "completed"), false);
});

test("waypoints missing and [] are equivalent in both directions", () => {
  const before = legacy(),
    after = structuredClone(before);
  after.routes[0].waypoints = [];
  after.segments[0].waypoints = [];
  assert.doesNotThrow(() => validateChange(after, before));
  assert.doesNotThrow(() => validateChange(before, after));
});

test("library waypoints are immutable including name/description/elevation, explicit deletion survives", () => {
  for (const category of ["routes", "segments"]) {
    const before = legacy();
    before[category][0].waypoints = [waypoint];
    for (const fields of [
      { lat: 41 },
      { lon: -4 },
      { name: "changed" },
      { description: "changed" },
      { ele: 0 },
      { id: "changed" },
    ]) {
      const after = structuredClone(before);
      Object.assign(after[category][0].waypoints[0], fields);
      assert.throws(() => validateChange(after, before), /original/);
    }
    for (const mode of ["missing", "empty", "implicit-delete"]) {
      const after = structuredClone(before);
      if (mode === "missing") delete after[category][0].waypoints;
      if (mode === "empty") after[category][0].waypoints = [];
      if (mode === "implicit-delete") after[category] = [];
      assert.throws(() => validateChange(after, before), /original/);
    }
    const after = structuredClone(before),
      id = after[category][0].id;
    after[category] = [];
    assert.doesNotThrow(() =>
      validateChange(after, before, { remove: { [category]: [id] } }),
    );
  }
});

test("new identities may contain waypoints, drafts may edit them and share waypoint ids between copies", () => {
  const before = legacy(),
    after = structuredClone(before);
  for (const category of ["routes", "segments"])
    after[category].push({
      ...structuredClone(after[category][0]),
      id: `copy-${category}`,
      waypoints: [waypoint],
    });
  after.draft = [0, 1].map((i) => ({
    id: `d${i}`,
    name: "Borrador",
    points: [],
    waypoints: [{ ...waypoint, lat: 41 + i }],
    description: "Editada",
  }));
  assert.doesNotThrow(() => validateChange(after, before));
});

test("invalid metadata/waypoints are rejected in all current collections", () => {
  for (const category of ["routes", "segments", "draft"]) {
    for (const description of [null, 1, [], false]) {
      const after = legacy();
      after[category][0].description = description;
      assert.throws(() => validateChange(after));
    }
    if (category !== "draft")
      for (const completed of [null, 1, "true", []]) {
        const after = legacy();
        after[category][0].completed = completed;
        assert.throws(() => validateChange(after));
      }
    for (const waypoints of [
      null,
      {},
      [null],
      [waypoint, waypoint],
      [{ ...waypoint, id: "" }],
      [{ ...waypoint, id: "\u00a0" }],
      [{ ...waypoint, lat: 91 }],
      [{ ...waypoint, lon: -181 }],
      [{ ...waypoint, lat: NaN }],
      [{ ...waypoint, ele: Infinity }],
      [{ ...waypoint, name: null }],
      [{ ...waypoint, description: 2 }],
    ]) {
      const after = legacy();
      after[category][0].waypoints = waypoints;
      assert.throws(() => validateChange(after));
    }
  }
});

test("segments preserve original text and bytes, projects remain disallowed", () => {
  for (const field of ["original", "originalBase64"]) {
    const before = legacy(),
      after = structuredClone(before);
    after.segments[0][field] = "YQ==";
    assert.throws(() => validateChange(after, before), /original/);
  }
  const after = legacy();
  after.projects = [{ id: "p", name: "Legacy", elements: [] }];
  assert.throws(() => validateChange(after), /actual|proyectos/);
});
