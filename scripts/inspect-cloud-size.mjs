import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// Read-only aggregate inspection: no GPX, names, owner ids or credentials printed.
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
const sql = neon(url);
const migration = readFileSync(
  new URL("../migrations/003_incremental_sync.sql", import.meta.url),
  "utf8",
);
const definitions = [
  ...migration.matchAll(
    /CREATE OR REPLACE FUNCTION\s+(\w+)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g,
  ),
];
assert.equal(definitions.length, 3);
for (const [, name, body] of definitions) {
  const [verified] =
    await sql`SELECT count(*)::int AS matches FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ${name} AND p.prosrc = ${body}`;
  assert.equal(verified.matches, 1, name);
}
const [summary] = await sql`SELECT count(*)::int AS owners,
  coalesce(sum(octet_length(payload::text)), 0)::text AS latest_state_bytes,
  coalesce(sum(jsonb_array_length(payload->'routes')), 0)::int AS routes,
  coalesce(sum(jsonb_array_length(payload->'segments')), 0)::int AS segments,
  coalesce(sum(jsonb_array_length(payload->'projects')), 0)::int AS projects
  FROM (SELECT DISTINCT ON(owner_id) payload FROM tudagpx_workspace_versions ORDER BY owner_id, version DESC) latest`;
const [storage] = await sql`SELECT count(*)::text AS snapshots,
  pg_total_relation_size('tudagpx_workspace_versions')::text AS relation_bytes
  FROM tudagpx_workspace_versions`;
console.log(
  JSON.stringify(
    {
      summary,
      migrationDefinitionsVerified: true,
      storage,
      note: "Only aggregate numbers returned by Neon; no workspace payload downloaded or modified.",
    },
    null,
    2,
  ),
);
