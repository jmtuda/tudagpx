import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Destructive maintenance: only after explicit owner confirmation. Never run
// during ordinary deployments or as an automatic retention policy.
const expected = Number(
  process.argv
    .find((arg) => arg.startsWith("--expected-revisions="))
    ?.split("=")[1],
);
if (
  !process.argv.includes("--confirm-prune-history") ||
  !Number.isSafeInteger(expected) ||
  expected < 1
) {
  throw new Error(
    "Explicit history-deletion confirmation and --expected-revisions=N are required.",
  );
}
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
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
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
  const before = await client.query(`SELECT
    (SELECT count(*)::int FROM tudagpx_workspace_versions) AS revisions,
    pg_database_size(current_database())::text AS database_bytes,
    pg_total_relation_size('tudagpx_workspace_versions')::text AS versions_bytes,
    pg_total_relation_size('tudagpx_upload_parts')::text AS parts_bytes`);
  assert.equal(
    before.rows[0].revisions,
    expected,
    "Revision count changed: inspect and reconfirm the deletion scope.",
  );
  console.log(JSON.stringify({ before: before.rows[0] }));
  await client.query("BEGIN");
  transaction = true;
  // Briefly prevent concurrent commits/staging while capturing and pruning.
  await client.query(
    "LOCK TABLE tudagpx_workspace_versions, tudagpx_upload_parts IN SHARE ROW EXCLUSIVE MODE",
  );
  const check = await client.query(
    "SELECT count(*)::int AS revisions, count(DISTINCT owner_id)::int AS owners FROM tudagpx_workspace_versions",
  );
  assert.equal(check.rows[0].revisions, expected);
  assert.equal(
    check.rows[0].owners,
    1,
    "Unexpected additional owners: abort maintenance.",
  );
  await client.query(`CREATE TEMP TABLE tudagpx_maintenance_keep ON COMMIT DROP AS
    SELECT DISTINCT ON(owner_id) owner_id, version, md5(payload::text) AS checksum
    FROM tudagpx_workspace_versions ORDER BY owner_id, version DESC`);
  const removed = await client.query(`DELETE FROM tudagpx_workspace_versions v
    USING tudagpx_maintenance_keep k WHERE v.owner_id = k.owner_id AND v.version < k.version`);
  const parts = await client.query(`WITH expired AS (
    SELECT owner_id, upload_id FROM tudagpx_upload_parts GROUP BY owner_id, upload_id
    HAVING max(created_at) < now() - interval '24 hours'
  ) DELETE FROM tudagpx_upload_parts p USING expired e
    WHERE p.owner_id = e.owner_id AND p.upload_id = e.upload_id`);
  const verified = await client.query(`SELECT count(*)::int AS latest_retained,
    bool_and(md5(v.payload::text) = k.checksum) AS exact_payload_preserved
    FROM tudagpx_workspace_versions v JOIN tudagpx_maintenance_keep k
    ON v.owner_id = k.owner_id AND v.version = k.version`);
  assert.equal(verified.rows[0].latest_retained, 1);
  assert.equal(verified.rows[0].exact_payload_preserved, true);
  const preserved = (
    await client.query("SELECT version, checksum FROM tudagpx_maintenance_keep")
  ).rows[0];
  assert.equal(removed.rowCount, expected - 1);
  const remaining = await client.query(
    "SELECT count(*)::int AS revisions FROM tudagpx_workspace_versions",
  );
  assert.equal(remaining.rows[0].revisions, 1);
  await client.query("COMMIT");
  transaction = false;
  console.log(
    JSON.stringify({
      deletedHistoricalRevisions: removed.rowCount,
      deletedExpiredParts: parts.rowCount,
      integrity: verified.rows[0],
    }),
  );
  // VACUUM FULL must run outside a transaction; keep the live version number.
  await client.query(
    "VACUUM (FULL, ANALYZE) public.tudagpx_workspace_versions",
  );
  await client.query("VACUUM (FULL, ANALYZE) public.tudagpx_upload_parts");
  const readback = await client.query(
    "SELECT EXISTS(SELECT 1 FROM tudagpx_workspace_versions WHERE version = $1 AND md5(payload::text) = $2) AS exact_payload_preserved",
    [preserved.version, preserved.checksum],
  );
  assert.equal(readback.rows[0].exact_payload_preserved, true);
  const after = await client.query(`SELECT
    (SELECT count(*)::int FROM tudagpx_workspace_versions) AS revisions,
    (SELECT count(*)::int FROM tudagpx_upload_parts) AS pending_parts,
    pg_database_size(current_database())::text AS database_bytes,
    pg_total_relation_size('tudagpx_workspace_versions')::text AS versions_bytes,
    pg_total_relation_size('tudagpx_upload_parts')::text AS parts_bytes`);
  console.log(
    JSON.stringify({
      after: after.rows[0],
      compacted: true,
      integrityReadback: readback.rows[0],
      note: "Current payload and revision number preserved; no automatic future pruning configured.",
    }),
  );
} catch (error) {
  if (transaction && client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    JSON.stringify({
      maintenanceFailed: true,
      code: error.code || error.name,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
