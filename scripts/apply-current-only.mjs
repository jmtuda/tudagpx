import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Pool, neonConfig } from "@neondatabase/serverless";

// One-off, explicitly approved transition. Never an automatic startup task.
if (!process.argv.includes("--confirm-visible-only"))
  throw new Error("Owner confirmation is required.");
const connectionString = execFileSync(
  "npx",
  [
    "--yes",
    "neonctl@latest",
    "connection-string",
    "production",
    "--project-id",
    "ancient-bar-91390962",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
).trim();
neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15000,
});
let client;
let transaction = false;
try {
  client = await pool.connect();
  await client.query("SET lock_timeout = '10s'");
  await client.query("SET statement_timeout = '120s'");
  await client.query("BEGIN");
  transaction = true;
  // Match the save function's lock order to avoid deadlocking an active save.
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended(owner_id, 0)) FROM (SELECT DISTINCT owner_id FROM tudagpx_workspace_versions ORDER BY owner_id) owners",
  );
  await client.query(
    "LOCK TABLE tudagpx_workspace_versions IN SHARE ROW EXCLUSIVE MODE",
  );
  const owners = await client.query(
    "SELECT count(DISTINCT owner_id)::int AS owners FROM tudagpx_workspace_versions",
  );
  assert.equal(owners.rows[0].owners, 1);
  await client.query(`CREATE TEMP TABLE tudagpx_visible_transition ON COMMIT DROP AS
    WITH latest AS (SELECT DISTINCT ON(owner_id) owner_id, version, payload FROM tudagpx_workspace_versions ORDER BY owner_id, version DESC)
    SELECT owner_id, version,
      jsonb_build_object('remove', jsonb_build_object(
        'routes', (SELECT coalesce(jsonb_agg(r->>'id'), '[]'::jsonb) FROM jsonb_array_elements(payload->'routes') r WHERE r->>'deletedAt' IS NOT NULL),
        'segments', (SELECT coalesce(jsonb_agg(s->>'id'), '[]'::jsonb) FROM jsonb_array_elements(payload->'segments') s WHERE s->>'deletedAt' IS NOT NULL)
      )) AS patch,
      jsonb_set(jsonb_set(payload, '{routes}', (SELECT coalesce(jsonb_agg(r ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(payload->'routes') WITH ORDINALITY a(r,ord) WHERE r->>'deletedAt' IS NULL)),
        '{segments}', (SELECT coalesce(jsonb_agg(s ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(payload->'segments') WITH ORDINALITY a(s,ord) WHERE s->>'deletedAt' IS NULL)) AS expected,
      jsonb_array_length(payload->'projects') AS projects FROM latest`);
  const scope = (
    await client.query(`SELECT version::text,
    jsonb_array_length(patch->'remove'->'routes') AS deleted_routes,
    jsonb_array_length(patch->'remove'->'segments') AS deleted_segments,
    jsonb_array_length(expected->'routes') AS visible_routes,
    jsonb_array_length(expected->'segments') AS visible_segments,
    projects FROM tudagpx_visible_transition`)
  ).rows[0];
  assert.deepEqual(
    { ...scope, version: undefined },
    {
      version: undefined,
      deleted_routes: 4,
      deleted_segments: 6,
      visible_routes: 4,
      visible_segments: 9,
      projects: 0,
    },
    "Deletion scope changed: stop and reconfirm.",
  );
  const target = (
    await client.query(
      "SELECT version::text, md5(expected::text) AS checksum FROM tudagpx_visible_transition",
    )
  ).rows[0];
  const saved =
    await client.query(`SELECT saved.version::text FROM tudagpx_visible_transition t
    CROSS JOIN LATERAL tudagpx_save_workspace(t.owner_id, t.version, t.patch, true, NULL, NULL) saved`);
  assert.equal(saved.rows.length, 1);
  const newVersion = saved.rows[0].version;
  assert.equal(BigInt(newVersion), BigInt(target.version) + 1n);
  const verify = (
    await client.query(
      `SELECT count(*)::int AS states,
    bool_and(md5(payload::text) = $1) AS exact_visible_state,
    sum(jsonb_array_length(payload->'routes'))::int AS routes,
    sum(jsonb_array_length(payload->'segments'))::int AS segments
    FROM tudagpx_workspace_versions`,
      [target.checksum],
    )
  ).rows[0];
  assert.deepEqual(verify, {
    states: 1,
    exact_visible_state: true,
    routes: 4,
    segments: 9,
  });
  await client.query("COMMIT");
  transaction = false;
  await client.query(
    "VACUUM (FULL, ANALYZE) public.tudagpx_workspace_versions",
  );
  await client.query("VACUUM (FULL, ANALYZE) public.tudagpx_upload_parts");
  const after = (
    await client.query(
      `SELECT
    count(*)::int AS states, bool_and(md5(payload::text) = $1 AND version::text = $2) AS exact_state_retained,
    sum(jsonb_array_length(payload->'routes'))::int AS routes,
    sum(jsonb_array_length(payload->'segments'))::int AS segments,
    sum(octet_length(payload::text))::text AS state_json_bytes,
    pg_total_relation_size('tudagpx_workspace_versions')::text AS app_bytes,
    pg_database_size(current_database())::text AS database_bytes FROM tudagpx_workspace_versions`,
      [target.checksum, newVersion],
    )
  ).rows[0];
  assert.equal(after.exact_state_retained, true);
  assert.equal(after.states, 1);
  console.log(
    JSON.stringify(
      {
        authorizedScope: scope,
        resultingVersion: newVersion,
        after,
        note: "Only explicitly approved tombstones removed; all other fields, originals and open draft verified unchanged inside PostgreSQL.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (transaction && client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    JSON.stringify({
      failed: true,
      code: error.code || error.name,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
