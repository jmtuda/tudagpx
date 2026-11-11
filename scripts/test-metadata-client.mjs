import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspacePatch, emptyCloudWorkspace } from "../src/utils/workspacePatch.js";

function fixture() {
  const points = [{ lat: 40.75, lon: -3.99, ele: 900 }, { lat: 40.751, lon: -3.98, ele: 910 }];
  const original = '<gpx version="1.1" creator="test"><trk><trkseg><trkpt lat="40.75" lon="-3.99"/><trkpt lat="40.751" lon="-3.98"/></trkseg></trk></gpx>';
  const waypoints = [{ id: "w1", lat: 40.75, lon: -3.99, ele: null, name: "Fuente", description: "Agua junto al camino" }];
  return { ...emptyCloudWorkspace(), routes: [{ id: "r1", name: "Ruta", tracks: [points], original, originalBase64: Buffer.from(original).toString("base64"), waypoints }], segments: [{ id: "s1", name: "Segmento", points, waypoints }], draft: [{ id: "d1", name: "Copia", points: structuredClone(points), waypoints: structuredClone(waypoints) }] };
}
for (const collection of ["routes", "segments"]) {
  test(`completed/description only send changed metadata for ${collection}`, () => {
    const previous = fixture();
    const next = structuredClone(previous);
    Object.assign(next[collection][0], { completed: true, description: "Descripción ⛰️\nSegunda línea <sin HTML>" });
    assert.deepEqual(createWorkspacePatch(previous, next), { [collection]: [{ id: next[collection][0].id, fields: { completed: true, description: next[collection][0].description } }] });
    const cleared = structuredClone(next);
    Object.assign(cleared[collection][0], { completed: false, description: "" });
    assert.deepEqual(createWorkspacePatch(next, cleared), { [collection]: [{ id: next[collection][0].id, fields: { completed: false, description: "" } }] });
    assert.equal(createWorkspacePatch(cleared, structuredClone(cleared)), null);
    assert.deepEqual(next.draft, previous.draft);
  });
}
test("editing a draft waypoint never retransmits library originals", () => {
  const previous = fixture();
  const next = structuredClone(previous);
  next.draft[0].waypoints[0].description = "Nueva descripción de la copia";
  assert.deepEqual(createWorkspacePatch(previous, next), { fields: { draft: next.draft } });
  assert.deepEqual(next.routes, previous.routes);
  assert.deepEqual(next.segments, previous.segments);
});
