import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import assert from "node:assert/strict";
import { neon, neonConfig } from "@neondatabase/serverless";
import { handleWorkspace } from "../api/workspace.js";

// Synthetic, small fixtures only. --migrate applies definitions, never maintenance.
async function main() {
  const migration = readFileSync(
    new URL("../migrations/004_current_only.sql", import.meta.url),
    "utf8",
  );
  const definitions = [
    ...migration.matchAll(
      /CREATE OR REPLACE FUNCTION\s+(\w+)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g,
    ),
  ];
  assert.equal(definitions.length, 4);
  const comments = migration.match(/COMMENT ON FUNCTION[^']*'[^']*';/g) || [];
  const remainder = migration
    .replace(/--[^\n]*/g, "")
    .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/g, "")
    .replace(/COMMENT ON FUNCTION[^']*'[^']*';/g, "")
    .replace(/\b(?:BEGIN|COMMIT);/g, "")
    .trim();
  assert.equal(
    remainder,
    "",
    "Migration must contain definitions and comments only",
  );
  const migrationSha256 = createHash("sha256").update(migration).digest("hex");
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
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
  const operation = new AsyncLocalStorage();
  neonConfig.fetchFunction = async (...args) => {
    const response = await fetch(...args);
    const metrics = operation.getStore();
    if (metrics) {
      metrics.bytes += (await response.clone().arrayBuffer()).byteLength;
      metrics.calls++;
    }
    return response;
  };
  const sql = neon(url);
  const fingerprint = async () =>
    (
      await sql`SELECT
    (SELECT md5(coalesce(string_agg(owner_id || ':' || version::text || ':' || md5(payload::text), '|' ORDER BY owner_id, version), '')) FROM tudagpx_workspace_versions) AS versions,
    (SELECT md5(coalesce(string_agg(owner_id || ':' || upload_id || ':' || part::text || ':' || total::text || ':' || created_at::text || ':' || md5(chunk), '|' ORDER BY owner_id, upload_id, part), '')) FROM tudagpx_upload_parts) AS parts`
    )[0];
  let migrationDataUnchanged = null;
  if (process.argv.includes("--migrate")) {
    const before = await fingerprint();
    await sql.transaction([
      ...definitions.map(([statement]) => sql.query(statement)),
      ...comments.map((statement) => sql.query(statement)),
    ]);
    assert.deepEqual(
      await fingerprint(),
      before,
      "Definition migration changed persisted data",
    );
    migrationDataUnchanged = true;
  }
  for (const [, name, body] of definitions) {
    const [verified] =
      await sql`SELECT count(*)::int AS matches FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ${name} AND p.prosrc = ${body}`;
    assert.equal(verified.matches, 1, name);
  }
  const [description] =
    await sql`SELECT obj_description('tudagpx_save_workspace(text,bigint,jsonb,boolean,text,integer)'::regprocedure, 'pg_proc') AS description`;
  assert.match(description.description, /current-only-v1/);
  const owner = `current-only-verification-${randomUUID()}`;
  const otherOwner = `current-only-verification-${randomUUID()}`;
  const measurements = [];
  let version = 0;
  async function api(method, body, expected = 200, label = method, query = {}) {
    const metrics = { bytes: 0, calls: 0 };
    let status = 200,
      result;
    await operation.run(metrics, () =>
      handleWorkspace(
        { method, body, query },
        {
          status(value) {
            status = value;
            return this;
          },
          json(value) {
            result = value;
            return this;
          },
          end() {
            return this;
          },
        },
        sql,
        { id: owner },
      ),
    );
    measurements.push({
      label,
      status,
      requestBytes: Buffer.byteLength(JSON.stringify(body ?? {})),
      clientResponseBytes: Buffer.byteLength(JSON.stringify(result ?? null)),
      neonResponseBodyBytes: metrics.bytes,
      neonCalls: metrics.calls,
    });
    if (expected !== null)
      assert.equal(status, expected, `${label}: ${JSON.stringify(result)}`);
    return result;
  }
  const put = async (body, expected = 200, label = "PUT") =>
    api("PUT", { policy: "current-only-v1", ...body }, expected, label);
  async function save(patch, expected = 200, label = "patch") {
    const result = await put({ version, patch }, expected, label);
    if (expected === 200) version = result.version;
    return result;
  }
  const points = [
    { lat: 40, lon: -3, ele: null },
    { lat: 40.01, lon: -3.01, ele: 20 },
  ];
  const original = "<gpx><!-- Montaña 🏔 ñ --></gpx>";
  const route = {
    id: "r",
    name: "Ruta",
    original,
    originalBase64: Buffer.from(original).toString("base64"),
    tracks: [points],
  };
  const segment = { id: "s", name: "Segmento", points };
  const draft = [
    {
      id: "open-copy",
      name: "Copia independiente abierta",
      points,
      sourceId: "r",
    },
  ];
  const data = {
    schema: 1,
    routes: [route, { ...route, id: "survivor" }],
    segments: [segment, { ...segment, id: "survivor-s" }],
    draft,
    projects: [],
    draftName: "Prueba",
  };
  async function assertHead() {
    const [head] =
      await sql`SELECT count(*)::int AS count, max(version)::text AS version FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.deepEqual(head, { count: 1, version: String(version) });
  }
  const upload = randomUUID(),
    incomplete = randomUUID();
  try {
    for (const method of ["PUT", "POST"]) {
      await api(
        method,
        { version: 0, patch: {} },
        409,
        "old client policy fence",
      );
      assert.equal(measurements.at(-1).neonCalls, 0);
    }
    const seeded = await put({ version: 0, data }, 200, "small synthetic seed");
    version = seeded.version;
    await assertHead();
    const metadata = await api("GET", undefined, 200, "metadata policy", {
      metadata: "1",
    });
    assert.equal(metadata.policy, "current-only-v1");
    assert.equal(metadata.version, version);
    await save(
      { routes: [{ id: "r", fields: { name: "Renombrada 🏔" } }] },
      200,
      "rename small delta",
    );
    assert.ok(measurements.at(-1).requestBytes < 200);
    assert.ok(measurements.at(-1).neonResponseBodyBytes < 1000);
    assert.equal(measurements.at(-1).neonCalls, 1);
    await assertHead();
    await save(
      { fields: { draftName: "Sólo estado actual" } },
      200,
      "draft small delta",
    );
    await assertHead();
    await put({ version: 1, patch: {} }, 409, "stale 409");
    for (const [fields, label] of [
      [{ original: "changed" }, "immutable XML"],
      [{ originalBase64: "YQ==" }, "immutable bytes"],
      [{ tracks: [[{ lat: 0, lon: 0 }]] }, "immutable geometry"],
    ]) {
      await save({ routes: [{ id: "survivor", fields }] }, 400, label);
    }
    for (const field of ["original", "originalBase64"]) {
      await save(
        { segments: [{ id: "survivor-s", fields: { [field]: "YQ==" } }] },
        400,
        `immutable segment ${field}`,
      );
    }
    await save(
      {
        segments: [
          { id: "survivor-s", fields: { points: [{ lat: 0, lon: 0 }] } },
        ],
      },
      400,
      "immutable segment geometry",
    );
    for (const remove of [
      null,
      [],
      { projects: [] },
      { routes: "r" },
      { routes: [null] },
      { routes: [1] },
      { routes: [""] },
      { routes: ["unknown"] },
      { routes: ["r", "r"] },
      { segments: ["unknown"] },
      { segments: ["s", "s"] },
    ]) {
      await save({ remove }, 400, "invalid/unknown/duplicate removal");
    }
    for (const category of ["routes", "segments"]) {
      const id = category === "routes" ? "r" : "s";
      await save(
        {
          [category]: [
            { id, fields: { name: "x" } },
            { id, fields: { name: "y" } },
          ],
        },
        400,
        "duplicate upsert",
      );
      await save(
        {
          remove: { [category]: [id] },
          [category]: [{ id, fields: { name: "x" } }],
        },
        400,
        "remove plus upsert",
      );
      for (const deletedAt of [null, "2026-01-01T00:00:00Z"]) {
        await save(
          { [category]: [{ id, fields: { deletedAt } }] },
          400,
          "no tombstones",
        );
      }
    }
    await save(
      {
        fields: {
          draft: [
            {
              id: "d",
              name: "Trash",
              points: [],
              deletedAt: "2026-01-01T00:00:00Z",
            },
          ],
        },
      },
      400,
      "no draft tombstones",
    );
    await save(
      { projects: [{ id: "p", fields: { name: "Snapshot", elements: [] } }] },
      400,
      "no hidden projects",
    );
    await put(
      { version, data: { ...data, routes: [data.routes[1]] } },
      400,
      "full cannot implicitly remove originals",
    );
    await put(
      {
        version,
        data: {
          ...data,
          projects: [{ id: "p", name: "Snapshot", elements: [] }],
        },
      },
      400,
      "full cannot add projects",
    );
    await put(
      {
        version,
        data: {
          ...data,
          routes: [
            { ...route, deletedAt: "2026-01-01T00:00:00Z" },
            data.routes[1],
          ],
        },
      },
      400,
      "full cannot add tombstones",
    );
    await save(
      { remove: { routes: ["r"], segments: ["s"] } },
      200,
      "explicit permanent remove",
    );
    await assertHead();
    // Only synthetic fixtures are fetched. No real owner's payload is read.
    const [deleted] =
      await sql`SELECT payload FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.deepEqual(deleted.payload.draft, draft);
    assert.deepEqual(deleted.payload.routes, [data.routes[1]]);
    assert.deepEqual(deleted.payload.segments, [data.segments[1]]);
    await save({ remove: { routes: ["r"] } }, 400, "cannot remove twice");
    const patch = {
      fields: {
        draftName: "Multipart íntegro 🏔 ñ",
        draft: [
          ...draft,
          { id: "incomplete-copy", name: "Incompleta", points: [] },
        ],
      },
    };
    const encoded = JSON.stringify(patch),
      cut = Math.floor(encoded.length / 2);
    const post = (id, part, total, chunk, expected = 200) =>
      api(
        "POST",
        { policy: "current-only-v1", upload: id, part, total, chunk },
        expected,
        "small multipart stage",
      );
    await post(upload, 1, 2, encoded.slice(cut));
    await put(
      { version, upload, total: 2, protocol: 2 },
      400,
      "incomplete multipart",
    );
    await post(upload, 0, 2, encoded.slice(0, cut));
    await post(upload, 0, 2, encoded.slice(0, cut));
    await post(upload, 0, 2, "different", 400);
    await post(upload, 0, 3, encoded.slice(0, cut), 400);
    const committed = await put(
      { version, upload, total: 2, protocol: 2 },
      200,
      "multipart database assembly",
    );
    version = committed.version;
    assert.ok(measurements.at(-1).neonResponseBodyBytes < 1000);
    assert.equal(measurements.at(-1).neonCalls, 1);
    await assertHead();
    const [multipart] =
      await sql`SELECT payload FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.equal(multipart.payload.draftName, patch.fields.draftName);
    assert.deepEqual(multipart.payload.draft, patch.fields.draft);
    assert.deepEqual(multipart.payload.routes, [data.routes[1]]);
    const [parts] =
      await sql`SELECT count(*)::int AS count FROM tudagpx_upload_parts WHERE owner_id = ${owner} AND upload_id = ${upload}`;
    assert.equal(parts.count, 0);
    // Expiration uses last activity of the whole group, owner locks and keeps the current group.
    const expired = randomUUID(),
      active = randomUUID(),
      foreign = randomUUID();
    await sql`INSERT INTO tudagpx_upload_parts(owner_id, upload_id, part, total, chunk, created_at) VALUES
      (${owner}, ${expired}, 0, 1, '{}', now() - interval '25 hours'),
      (${owner}, ${active}, 0, 2, '{', now() - interval '25 hours'),
      (${owner}, ${active}, 1, 2, '}', now()),
      (${otherOwner}, ${foreign}, 0, 1, '{}', now() - interval '25 hours')`;
    await post(incomplete, 0, 2, "{");
    const [expiry] = await sql`SELECT
      count(*) FILTER (WHERE owner_id = ${owner} AND upload_id = ${expired})::int AS expired,
      count(*) FILTER (WHERE owner_id = ${owner} AND upload_id = ${active})::int AS active,
      count(*) FILTER (WHERE owner_id = ${otherOwner} AND upload_id = ${foreign})::int AS foreign
      FROM tudagpx_upload_parts WHERE owner_id IN (${owner}, ${otherOwner})`;
    assert.deepEqual(expiry, { expired: 0, active: 2, foreign: 1 });
    await sql`UPDATE tudagpx_upload_parts SET created_at = now() - interval '25 hours' WHERE owner_id = ${owner} AND upload_id IN (${active}, ${incomplete})`;
    await save(
      { fields: { draftName: "Commit cleans expired groups" } },
      200,
      "commit cleanup",
    );
    const [left] =
      await sql`SELECT count(*)::int AS count FROM tudagpx_upload_parts WHERE owner_id = ${owner}`;
    assert.equal(left.count, 0);
    // Two competing writes: exactly one succeeds, preserving optimistic concurrency.
    const concurrent = await Promise.all([
      put(
        { version, patch: { fields: { draftName: "A" } } },
        null,
        "concurrent A",
      ),
      put(
        { version, patch: { fields: { draftName: "B" } } },
        null,
        "concurrent B",
      ),
    ]);
    assert.equal(
      concurrent.filter((r) => Number.isSafeInteger(r.version)).length,
      1,
    );
    version = concurrent.find((r) => Number.isSafeInteger(r.version)).version;
    assert.deepEqual(
      measurements
        .slice(-2)
        .map((r) => r.status)
        .sort(),
      [200, 409],
    );
    await assertHead();
  } finally {
    // Exact random identities created by this run only; never prefix-wide deletion.
    await sql.transaction([
      sql`DELETE FROM tudagpx_upload_parts WHERE owner_id IN (${owner}, ${otherOwner})`,
      sql`DELETE FROM tudagpx_workspace_versions WHERE owner_id IN (${owner}, ${otherOwner})`,
    ]);
    const [cleaned] = await sql`SELECT
      (SELECT count(*)::int FROM tudagpx_upload_parts WHERE owner_id IN (${owner}, ${otherOwner})) AS parts,
      (SELECT count(*)::int FROM tudagpx_workspace_versions WHERE owner_id IN (${owner}, ${otherOwner})) AS heads`;
    assert.deepEqual(cleaned, { parts: 0, heads: 0 });
  }
  console.log(
    JSON.stringify(
      {
        migrationSha256,
        migrationDataUnchanged,
        definitionsExact: definitions.map(([, name]) => name),
        currentHeadCountVerified: 1,
        syntheticCleanup: { parts: 0, heads: 0 },
        measurements,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  // Child-process output / database connection metadata must never be printed.
  console.error(
    JSON.stringify({
      failed: true,
      name: error.name,
      code: error.code,
      message:
        error.name === "AssertionError"
          ? error.message
          : "Cloud verification failed (credentials and connection metadata withheld).",
    }),
  );
  process.exitCode = 1;
});
