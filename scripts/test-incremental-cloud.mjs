import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { neon, neonConfig } from "@neondatabase/serverless";
import { handleWorkspace } from "../api/workspace.js";
import { createRemoteStore } from "../src/utils/workspaceTransfer.js";

// Never print connection strings or inspect .env. Only the existing authorized project.
const url = execFileSync(
  "npx",
  [
    "--yes",
    "neonctl@latest",
    "connection-string",
    "production",
    "--project-id",
    "ancient-bar-91390962",
    "--pooled",
  ],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
).trim();
let neonBytes = 0;
const operation = new AsyncLocalStorage();
neonConfig.fetchFunction = async (...args) => {
  const response = await fetch(...args);
  const bytes = (await response.clone().arrayBuffer()).byteLength;
  neonBytes += bytes;
  const metrics = operation.getStore();
  if (metrics) {
    metrics.bytes += bytes;
    metrics.calls++;
  }
  return response;
};
const sql = neon(url);
if (process.argv.includes("--migrate")) {
  const before =
    await sql`SELECT to_regclass('public.tudagpx_workspace_versions') IS NOT NULL AS versions, to_regclass('public.tudagpx_upload_parts') IS NOT NULL AS parts`;
  assert.deepEqual(before[0], { versions: true, parts: true });
  const migration = readFileSync(
    new URL("../migrations/003_incremental_sync.sql", import.meta.url),
    "utf8",
  );
  // HTTP prepared statements accept one command; retain atomic migration with
  // Neon's transaction API rather than splitting inside PL/pgSQL bodies.
  const statements = migration.match(
    /CREATE OR REPLACE FUNCTION[\s\S]*?END \$\$;/g,
  );
  assert.equal(statements?.length, 3);
  statements.push(
    migration.slice(
      migration.indexOf("COMMENT ON FUNCTION"),
      migration.lastIndexOf("COMMIT;"),
    ),
  );
  await sql.transaction(statements.map((statement) => sql.query(statement)));
}
const functions =
  await sql`SELECT obj_description('tudagpx_save_workspace(text,bigint,jsonb,boolean,text,integer)'::regprocedure, 'pg_proc') AS description`;
assert.match(functions[0].description, /protocol 2/);
console.log("Additive migration readback: protocol 2 function present.");
const user = { id: `incremental-verification-${randomUUID()}` };
const measurements = [];
async function api(method, body, query = {}, expected = 200, label = method) {
  const metrics = { bytes: 0, calls: 0 };
  let status = 200,
    payload;
  await operation.run(metrics, () =>
    handleWorkspace(
      { method, body, query },
      {
        status(value) {
          status = value;
          return this;
        },
        json(value) {
          payload = value;
          return this;
        },
        end() {
          return this;
        },
      },
      sql,
      user,
    ),
  );
  const entry = {
    label,
    status,
    requestBytes: Buffer.byteLength(JSON.stringify(body ?? {})),
    clientResponseBytes: Buffer.byteLength(JSON.stringify(payload ?? null)),
    neonResponseBodyBytes: metrics.bytes,
    neonCalls: metrics.calls,
  };
  measurements.push(entry);
  if (expected !== null)
    assert.equal(status, expected, JSON.stringify({ label, status, payload }));
  return payload;
}
const points = [
  { lat: 40, lon: -3, ele: null },
  { lat: 40.01, lon: -3.01, ele: 20 },
];
const original =
  "<gpx><!--" + "Montaña 🏔 á é ñ Unicode ".repeat(250) + "--></gpx>";
const data = {
  schema: 1,
  routes: [
    {
      id: "r",
      name: "Ruta",
      original,
      originalBase64: Buffer.from(original).toString("base64"),
      tracks: [points],
    },
  ],
  segments: [{ id: "s", name: "Segmento", points }],
  draft: [],
  projects: [
    {
      id: "p",
      name: "Proyecto",
      elements: [{ id: "copy", name: "Copia", points }],
    },
  ],
  draftName: "Prueba",
};
let version = 0;
async function save(patch, expected = 200, label = "patch") {
  const result = await api("PUT", { version, patch }, {}, expected, label);
  if (expected === 200) version = result.version;
  return result;
}
try {
  const seeded = await api("PUT", { version, data }, {}, 200, "legacy seed");
  version = seeded.version;
  const metadata = await api(
    "GET",
    undefined,
    { metadata: "1" },
    200,
    "owner metadata",
  );
  assert.equal(metadata.ownerId, user.id);
  assert.equal(metadata.version, version);
  await save(
    { routes: [{ id: "r", fields: { name: "Renombrada 🏔" } }] },
    200,
    "rename without XML or points",
  );
  assert.ok(measurements.at(-1).requestBytes < 150);
  assert.ok(measurements.at(-1).neonResponseBodyBytes < 1000);
  assert.equal(measurements.at(-1).neonCalls, 1);
  await save(
    {
      fields: {
        draft: [{ id: "d", name: "Borrador incompleto", points: [] }],
        draftName: "Sólo borrador",
      },
    },
    200,
    "draft without library",
  );
  await api("PUT", { version: 1, patch: {} }, {}, 409, "stale revision");
  await save(
    { routes: [{ id: "r", fields: { original: "changed" } }] },
    400,
    "immutable XML",
  );
  await save(
    { routes: [{ id: "r", fields: { originalBase64: "YQ==" } }] },
    400,
    "immutable bytes",
  );
  await save(
    { routes: [{ id: "r", fields: { tracks: [[{ lat: 0, lon: 0 }]] } }] },
    400,
    "immutable tracks",
  );
  await save(
    { segments: [{ id: "s", fields: { points: [{ lat: 0, lon: 0 }] } }] },
    400,
    "immutable segment",
  );
  await save(
    { projects: [{ id: "p", fields: { name: "changed" } }] },
    400,
    "immutable project",
  );
  await save(
    { segments: [{ id: "r", fields: { name: "duplicate", points } }] },
    400,
    "cross collection duplicate",
  );
  await save(
    { projects: [{ id: "s", fields: { name: "duplicate", elements: [] } }] },
    400,
    "project cross collection duplicate",
  );
  await save(
    { fields: { draft: [{ id: "r", name: "duplicate", points: [] }] } },
    400,
    "draft duplicate",
  );
  await save(
    {
      fields: {
        draft: [{ id: "invalid", name: "bad", points: [{ lat: 100, lon: 0 }] }],
      },
    },
    400,
    "invalid draft",
  );
  await save(
    { segments: [{ id: "new", fields: { name: "bad", points: [] } }] },
    400,
    "invalid new record",
  );
  await save({ fields: { routes: [] } }, 400, "no physical deletion");
  await save(
    { routes: [{ id: "r", fields: { deletedAt: "not a date" } }] },
    400,
    "invalid tombstone",
  );
  await save(
    {
      segments: [{ id: "new", fields: { name: "Nueva", points } }],
      projects: [
        { id: "new-project", fields: { name: "Snapshot nuevo", elements: [] } },
      ],
    },
    200,
    "valid additions",
  );
  const upload = randomUUID();
  const patchText = JSON.stringify({
    routes: [{ id: "r", fields: { name: "Unicode 🏔 conservación" } }],
    fields: { draftName: "español 🏔" },
  });
  const boundary = patchText.indexOf("🏔");
  const chunks = [patchText.slice(0, boundary), patchText.slice(boundary)];
  await api("POST", { upload, part: 0, total: 2, chunk: chunks[0] });
  await api(
    "PUT",
    { version, upload, total: 2, protocol: 2 },
    {},
    400,
    "incomplete multipart",
  );
  await api("POST", { upload, part: 1, total: 2, chunk: chunks[1] });
  version = (
    await api(
      "PUT",
      { version, upload, total: 2, protocol: 2 },
      {},
      200,
      "Unicode multipart patch",
    )
  ).version;
  assert.equal(measurements.at(-1).neonCalls, 1);
  const checks = await sql`SELECT
    payload->'routes'->0->>'original' = ${original} AS xml_intact,
    md5(payload->'routes'->0->>'originalBase64') = md5(${data.routes[0].originalBase64}) AS bytes_intact,
    payload->'routes'->0->'tracks' = ${JSON.stringify([points])}::jsonb AS geometry_intact,
    payload->'projects'->0 = ${JSON.stringify(data.projects[0])}::jsonb AS project_intact,
    payload->'routes'->0->>'name' = 'Unicode 🏔 conservación' AS unicode_intact,
    payload->>'draftName' = 'español 🏔' AS draft_name,
    jsonb_array_length(payload->'routes') = 1 AS no_library_duplication,
    jsonb_array_length(payload->'draft') = 1 AS draft_preserved
    FROM tudagpx_workspace_versions WHERE owner_id = ${user.id} AND version = ${version}`;
  assert.ok(Object.values(checks[0]).every((value) => value === true));
  // Small legacy GET and multipart still work; never fetch the real owner's library.
  const current = await api("GET", undefined, {}, 200, "small legacy GET");
  assert.equal(current.data.routes[0].original, original);
  const legacyUpload = randomUUID();
  const text = JSON.stringify(current.data);
  const middle = Math.floor(text.length / 2);
  await api("POST", {
    upload: legacyUpload,
    part: 0,
    total: 2,
    chunk: text.slice(0, middle),
  });
  await api("POST", {
    upload: legacyUpload,
    part: 1,
    total: 2,
    chunk: text.slice(middle),
  });
  version = (
    await api(
      "PUT",
      { version, upload: legacyUpload, total: 2 },
      {},
      200,
      "legacy multipart save",
    )
  ).version;
  assert.equal(measurements.at(-1).neonCalls, 1);
  const removed = structuredClone(current.data);
  removed.routes = [];
  await api(
    "PUT",
    { version, data: removed },
    {},
    400,
    "legacy physical deletion rejected",
  );
  const concurrent = await Promise.all([
    api(
      "PUT",
      { version, patch: { fields: { draftName: "Concurrent A" } } },
      {},
      null,
      "concurrent A",
    ),
    api(
      "PUT",
      { version, patch: { fields: { draftName: "Concurrent B" } } },
      {},
      null,
      "concurrent B",
    ),
  ]);
  assert.equal(
    concurrent.filter((result) => result.version === version + 1).length,
    1,
  );
  assert.deepEqual(
    measurements
      .slice(-2)
      .map((result) => result.status)
      .sort(),
    [200, 409],
  );
  const snapshot =
    await sql`SELECT count(*)::int AS count, max(version)::int AS latest FROM tudagpx_workspace_versions WHERE owner_id = ${user.id}`;
  assert.equal(snapshot[0].count, snapshot[0].latest);
  // Exercise the actual browser transport against this real SQL-backed handler.
  // Only this small synthetic owner's data is downloaded; never the real library.
  const localCache = new Map();
  const cache = {
    load: async (id) => structuredClone(localCache.get(id)),
    save: async (id, entry) => localCache.set(id, structuredClone(entry)),
  };
  const fetcher = async (path, options) => {
    const parsed = new URL(path, "https://tudagpx.vercel.app");
    const result = await api(
      options.method,
      options.body ? JSON.parse(options.body) : undefined,
      Object.fromEntries(parsed.searchParams),
      null,
      `frontend ${options.method}`,
    );
    return Response.json(result, { status: measurements.at(-1).status });
  };
  const remote = createRemoteStore(fetcher, { cache });
  const loaded = await remote.load();
  const beforeNoop = measurements.length;
  await remote.save(loaded);
  assert.equal(
    measurements.length,
    beforeNoop,
    "Hydration must not write to Neon",
  );
  loaded.routes[0].name = "Cliente incremental real";
  await remote.save(loaded);
  assert.ok(measurements.at(-1).requestBytes < 200);
  assert.ok(measurements.at(-1).neonResponseBodyBytes < 1000);
  const beforeWarmLoad = measurements.length;
  const warm = createRemoteStore(fetcher, { cache });
  assert.deepEqual(await warm.load(), loaded);
  assert.equal(
    measurements.length,
    beforeWarmLoad + 1,
    "Warm load must query metadata only",
  );
  assert.equal(measurements.at(-1).label, "frontend GET");
  assert.ok(measurements.at(-1).neonResponseBodyBytes < 1000);
  assert.equal(localCache.get(user.id).pending, null);
  const exactMigration =
    await sql`SELECT position('Mi nueva ruta' in pg_get_functiondef('tudagpx_save_workspace(text,bigint,jsonb,boolean,text,integer)'::regprocedure)) > 0 AS default_verified`;
  assert.equal(exactMigration[0].default_verified, true);
  console.log(
    JSON.stringify(
      {
        fixtureBytes: Buffer.byteLength(JSON.stringify(data)),
        checks: checks[0],
        snapshots: snapshot[0],
        measurements,
        measuredNeonResponseBodyBytes: neonBytes,
        note: "Actual HTTP response body bytes, excluding headers/TLS. Migration/readback and verification included in total; per-operation samples isolate handler. No production owner payload read.",
      },
      null,
      2,
    ),
  );
} finally {
  await sql`DELETE FROM tudagpx_upload_parts WHERE owner_id = ${user.id}`;
  await sql`DELETE FROM tudagpx_workspace_versions WHERE owner_id = ${user.id}`;
  const remaining =
    await sql`SELECT (SELECT count(*)::int FROM tudagpx_workspace_versions WHERE owner_id = ${user.id}) AS versions, (SELECT count(*)::int FROM tudagpx_upload_parts WHERE owner_id = ${user.id}) AS parts`;
  assert.deepEqual(remaining[0], { versions: 0, parts: 0 });
  console.log("Synthetic records cleanup verified: versions=0, parts=0.");
}
