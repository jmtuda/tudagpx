import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import assert from "node:assert/strict";
import { neon, neonConfig } from "@neondatabase/serverless";
import { handleWorkspace } from "../api/workspace.js";

// Tiny random owner only. Never run scripts that reinstall 003/004 over 005.
async function main() {
  const readMigration = (name) =>
    readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
  const migration = readMigration("005_metadata_waypoints.sql");
  const parse = (source) => [
    ...source.matchAll(
      /CREATE OR REPLACE FUNCTION\s+(\w+)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g,
    ),
  ];
  const definitions = parse(migration);
  assert.equal(definitions.length, 3);
  const comments = migration.match(/COMMENT ON FUNCTION[^']*'[^']*';/g) || [];
  assert.equal(
    migration
      .replace(/--[^\n]*/g, "")
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/g, "")
      .replace(/COMMENT ON FUNCTION[^']*'[^']*';/g, "")
      .replace(/\b(?:BEGIN|COMMIT);/g, "")
      .trim(),
    "",
  );
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
  const oldDefinitions = [
    ...parse(readMigration("003_incremental_sync.sql")),
    ...parse(readMigration("004_current_only.sql")),
  ];
  const current = new Map(oldDefinitions.map((entry) => [entry[1], entry[2]]));
  const verify = async (name, bodies) => {
    const [result] =
      await sql`SELECT count(*)::int AS matches FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ${name} AND p.prosrc = ANY(${bodies}::text[])`;
    assert.equal(result.matches, 1, `Unexpected SQL definition: ${name}`);
  };
  for (const [name, body] of current) {
    await verify(name, [
      body,
      ...definitions
        .filter((entry) => entry[1] === name)
        .map((entry) => entry[2]),
    ]);
  }
  let migrationDataUnchanged = null;
  if (process.argv.includes("--migrate")) {
    // Guard both tables in the SAME transaction, returning no payloads/owner identities.
    // SHARE locks prevent concurrent changes between the two fingerprints.
    await sql.transaction([
      sql.query("SET LOCAL lock_timeout = '10s'"),
      sql.query(
        "LOCK TABLE tudagpx_workspace_versions, tudagpx_upload_parts IN SHARE MODE",
      ),
      sql.query(`CREATE TEMP TABLE metadata_migration_guard ON COMMIT DROP AS SELECT
        (SELECT md5(coalesce(string_agg(owner_id || ':' || version::text || ':' || md5(payload::text), '|' ORDER BY owner_id, version), '')) FROM tudagpx_workspace_versions) AS heads,
        (SELECT md5(coalesce(string_agg(owner_id || ':' || upload_id || ':' || part::text || ':' || total::text || ':' || created_at::text || ':' || md5(chunk), '|' ORDER BY owner_id, upload_id, part), '')) FROM tudagpx_upload_parts) AS parts`),
      ...definitions.map(([statement]) => sql.query(statement)),
      ...comments.map((statement) => sql.query(statement)),
      sql.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM metadata_migration_guard WHERE heads IS DISTINCT FROM
        (SELECT md5(coalesce(string_agg(owner_id || ':' || version::text || ':' || md5(payload::text), '|' ORDER BY owner_id, version), '')) FROM tudagpx_workspace_versions)
        OR parts IS DISTINCT FROM (SELECT md5(coalesce(string_agg(owner_id || ':' || upload_id || ':' || part::text || ':' || total::text || ':' || created_at::text || ':' || md5(chunk), '|' ORDER BY owner_id, upload_id, part), '')) FROM tudagpx_upload_parts))
        THEN RAISE EXCEPTION 'Definition migration changed persisted data'; END IF; END $$`),
    ]);
    migrationDataUnchanged = true;
  }
  for (const [, name, body] of definitions) await verify(name, [body]);
  for (const name of [
    "tudagpx_valid_points",
    "tudagpx_validate_workspace",
    "tudagpx_stage_workspace_part",
    "tudagpx_cleanup_uploads",
  ])
    await verify(name, [current.get(name)]);
  const owner = `metadata-verification-${randomUUID()}`;
  const measurements = [];
  let version = 0;
  async function api(method, body, expected, label) {
    const metrics = { bytes: 0, calls: 0 };
    let status = 200,
      result;
    await operation.run(metrics, () =>
      handleWorkspace(
        { method, body: { policy: "current-only-v1", ...body } },
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
      requestBytes: Buffer.byteLength(
        JSON.stringify({ policy: "current-only-v1", ...body }),
      ),
      clientResponseBytes: Buffer.byteLength(JSON.stringify(result ?? null)),
      neonResponseBodyBytes: metrics.bytes,
      neonCalls: metrics.calls,
    });
    assert.equal(status, expected, `${label}: ${JSON.stringify(result)}`);
    return result;
  }
  async function save(patch, expected = 200, label = "patch") {
    const result = await api("PUT", { version, patch }, expected, label);
    if (expected === 200) {
      assert.equal(result.version, version + 1);
      version = result.version;
      assert.deepEqual(Object.keys(result), ["version"]);
      const [head] =
        await sql`SELECT count(*)::int AS count, max(version)::text AS version FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
      assert.deepEqual(head, { count: 1, version: String(version) });
    }
    return result;
  }
  const points = [
    { lat: 40, lon: -3 },
    { lat: 40.01, lon: -3.01, ele: null },
  ];
  const original = "<gpx><!-- Montaña 🏔 ñ & exact bytes --></gpx>\r\n";
  const originalBase64 = Buffer.from(original).toString("base64");
  const route = {
    id: "r",
    name: "Ruta",
    tracks: [points],
    original,
    originalBase64,
  };
  const segment = {
    id: "s",
    name: "Segmento",
    points,
    original,
    originalBase64,
  };
  const waypoint = {
    id: "w",
    lat: 40,
    lon: -3,
    ele: null,
    name: "Fuente 🏔",
    description: "Agua ñ\n<script>texto, no HTML</script>",
  };
  const draft = [{ id: "d", name: "Borrador", points: [] }];
  const data = {
    schema: 1,
    routes: [route],
    segments: [segment],
    draft,
    projects: [],
    draftName: "Prueba",
  };
  let originalHash;
  async function hashOriginals() {
    const [result] =
      await sql`SELECT md5((SELECT jsonb_agg(jsonb_build_array(item->'id', item->'original', item->'originalBase64', item->'tracks', item->'points', coalesce(item->'waypoints','[]'::jsonb)) ORDER BY item->>'id')::text FROM jsonb_array_elements(payload->'routes' || payload->'segments') item)) AS hash FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    return result.hash;
  }
  try {
    const seeded = await api(
      "PUT",
      { version: 0, data },
      200,
      "legacy seed without defaults",
    );
    version = seeded.version;
    const [legacy] =
      await sql`SELECT payload = ${JSON.stringify(data)}::jsonb AS exact FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.equal(legacy.exact, true);
    await save(
      {
        routes: [{ id: "r", fields: { waypoints: [] } }],
        segments: [{ id: "s", fields: { waypoints: [] } }],
      },
      200,
      "missing waypoints equals empty",
    );
    originalHash = await hashOriginals();
    const description = "Descripción Unicode ñ 🏔\n<em>Solo texto</em>";
    await save(
      {
        routes: [{ id: "r", fields: { completed: true, description } }],
        segments: [{ id: "s", fields: { completed: false, description } }],
      },
      200,
      "metadata only small delta",
    );
    const delta = measurements.at(-1);
    assert.ok(delta.requestBytes < 500);
    assert.ok(delta.neonResponseBodyBytes < 1000);
    assert.equal(delta.neonCalls, 1);
    assert.equal(await hashOriginals(), originalHash);
    const [metadata] =
      await sql`SELECT (payload->'routes'->0->>'description' = ${description} AND payload->'routes'->0->'completed' = 'true'::jsonb AND payload->'segments'->0->'completed' = 'false'::jsonb) AS exact FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.equal(metadata.exact, true);
    for (const category of ["routes", "segments"]) {
      for (const fields of [
        { completed: "true" },
        { completed: null },
        { completed: 1 },
        { description: null },
        { description: [] },
        { description: 2 },
      ]) {
        await save(
          { [category]: [{ id: category === "routes" ? "r" : "s", fields }] },
          400,
          `${category} invalid metadata`,
        );
      }
    }
    const invalidWaypoints = [
      null,
      {},
      [null],
      [{ ...waypoint, lat: 91 }],
      [{ ...waypoint, lon: -181 }],
      [{ ...waypoint, lat: "40" }],
      [{ ...waypoint, ele: "3" }],
      [{ ...waypoint, name: null }],
      [{ ...waypoint, description: 3 }],
      [{ ...waypoint, id: "" }],
      [{ ...waypoint, id: " \t\n" }],
      [{ ...waypoint, id: 1 }],
      [waypoint, { ...waypoint }],
    ];
    for (const category of ["routes", "segments", "draft"]) {
      for (const waypoints of invalidWaypoints) {
        const patch =
          category === "draft"
            ? { fields: { draft: [{ ...draft[0], waypoints }] } }
            : {
                [category]: [
                  {
                    id: category === "routes" ? "bad-r" : "bad-s",
                    fields: {
                      ...(category === "routes" ? route : segment),
                      id: category === "routes" ? "bad-r" : "bad-s",
                      waypoints,
                    },
                  },
                ],
              };
        await save(patch, 400, `${category} invalid waypoints`);
      }
    }
    for (const description of [null, false, 1])
      await save(
        { fields: { draft: [{ ...draft[0], description }] } },
        400,
        "draft invalid description",
      );
    // Raw JSON numeric overflow cannot be represented with JSON.stringify(Infinity).
    await assert.rejects(
      sql`SELECT tudagpx_validate_current_workspace(${JSON.stringify({ ...data, draft: [{ ...draft[0], waypoints: [{ ...waypoint, ele: "OVERFLOW" }] }] }).replace('"OVERFLOW"', "1e400")}::jsonb)`,
      (error) => error.code === "22023",
    );
    await save(
      {
        routes: [
          { id: "wr", fields: { ...route, id: "wr", waypoints: [waypoint] } },
        ],
        segments: [
          { id: "ws", fields: { ...segment, id: "ws", waypoints: [waypoint] } },
        ],
      },
      200,
      "new independent waypoint originals",
    );
    originalHash = await hashOriginals();
    for (const category of ["routes", "segments"]) {
      for (const waypoints of [
        [],
        [{ ...waypoint, lat: 41 }],
        [{ ...waypoint, name: "changed" }],
        [{ ...waypoint, description: "changed" }],
        [{ ...waypoint, ele: 25 }],
      ]) {
        await save(
          {
            [category]: [
              {
                id: category === "routes" ? "wr" : "ws",
                fields: { waypoints },
              },
            ],
          },
          400,
          `${category} immutable waypoint`,
        );
      }
      // A full save cannot silently remove an original.
      await api(
        "PUT",
        { version, data },
        400,
        `${category} no implicit delete`,
      );
    }
    const draftCopies = [0, 1].map((index) => ({
      ...draft[0],
      id: `d${index}`,
      description,
      waypoints: [waypoint],
    }));
    await save(
      { fields: { draft: draftCopies } },
      200,
      "same waypoint id allowed across draft copies",
    );
    draftCopies[0].waypoints = [
      {
        ...waypoint,
        lat: 41,
        name: "Editado",
        description: "Nuevo texto",
        ele: 0,
      },
    ];
    await save(
      { fields: { draft: draftCopies } },
      200,
      "draft waypoint editable",
    );
    assert.equal(await hashOriginals(), originalHash);
    const [persisted] =
      await sql`SELECT (payload->'draft' = ${JSON.stringify(draftCopies)}::jsonb AND payload->'routes'->1->'waypoints' = ${JSON.stringify([waypoint])}::jsonb AND payload->'segments'->1->'waypoints' = ${JSON.stringify([waypoint])}::jsonb) AS exact FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.equal(persisted.exact, true);
    await api(
      "PUT",
      { version: version - 1, patch: {} },
      409,
      "optimistic 409",
    );
    await save(
      { projects: [{ id: "p", fields: { name: "Legacy", elements: [] } }] },
      400,
      "no hidden projects",
    );
    const upload = randomUUID();
    const patch = {
      routes: [
        { id: "wr", fields: { completed: true, description: "Multipart ñ" } },
      ],
    };
    const encoded = JSON.stringify(patch),
      cut = Math.floor(encoded.length / 2);
    for (const part of [1, 0])
      await api(
        "POST",
        {
          upload,
          part,
          total: 2,
          chunk: part ? encoded.slice(cut) : encoded.slice(0, cut),
        },
        200,
        "tiny multipart stage",
      );
    const assembled = await api(
      "PUT",
      { version, upload, total: 2, protocol: 2 },
      200,
      "multipart assembled only in DB",
    );
    version = assembled.version;
    assert.equal(measurements.at(-1).neonCalls, 1);
    assert.ok(measurements.at(-1).neonResponseBodyBytes < 1000);
    assert.equal(await hashOriginals(), originalHash);
    await save(
      { remove: { routes: ["wr"], segments: ["ws"] } },
      200,
      "explicit original deletion allowed",
    );
    const [removed] =
      await sql`SELECT (payload->'draft' = ${JSON.stringify(draftCopies)}::jsonb AND jsonb_array_length(payload->'routes') = 1 AND jsonb_array_length(payload->'segments') = 1) AS exact FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`;
    assert.equal(removed.exact, true);
  } finally {
    await sql.transaction([
      sql`DELETE FROM tudagpx_upload_parts WHERE owner_id = ${owner}`,
      sql`DELETE FROM tudagpx_workspace_versions WHERE owner_id = ${owner}`,
    ]);
    const [cleaned] =
      await sql`SELECT (SELECT count(*)::int FROM tudagpx_upload_parts WHERE owner_id = ${owner}) AS parts, (SELECT count(*)::int FROM tudagpx_workspace_versions WHERE owner_id = ${owner}) AS heads`;
    assert.deepEqual(cleaned, { parts: 0, heads: 0 });
  }
  console.log(
    JSON.stringify(
      {
        migrationSha256: createHash("sha256").update(migration).digest("hex"),
        migrationDataUnchanged,
        definitionsExact: definitions.map((entry) => entry[1]),
        unchangedBaseDefinitions: true,
        originalExactSqlHash: true,
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
  // Never print child process stdout/stderr or database connection metadata.
  console.error(
    JSON.stringify({
      failed: true,
      name: error.name,
      code: error.code,
      message:
        error.name === "AssertionError"
          ? error.message
          : "Cloud verification failed (connection metadata withheld).",
    }),
  );
  process.exitCode = 1;
});
