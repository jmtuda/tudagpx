import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
// CLI resolves secrets directly into process memory; never log the URL or env values.
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
if (!url.startsWith("postgresql://"))
  throw new Error("Unexpected connection format");
const sql = neon(url);
const before =
  await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
console.log(
  "Existing public tables:",
  before.map((row) => row.table_name),
);
await sql.query(
  readFileSync(
    new URL("../migrations/001_workspace.sql", import.meta.url),
    "utf8",
  ),
);
const verified =
  await sql`SELECT count(*)::int AS count FROM tudagpx_workspace_versions`;
console.log("Workspace table verified; revisions:", verified[0].count);
const values = {
  DATABASE_URL: url,
  NEON_AUTH_BASE_URL:
    "https://ep-spring-waterfall-b9yxuqsz.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth",
  OWNER_EMAIL: "jmtuda@gmail.com",
  VITE_CLOUD_ENABLED: "true",
};
for (const [name, value] of Object.entries(values)) {
  const result = spawnSync(
    "npx",
    ["--yes", "vercel@latest", "env", "add", name, "production"],
    { input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  if (result.status !== 0)
    throw new Error(
      `Could not configure ${name}; provider output suppressed to protect secrets`,
    );
  console.log("Configured production variable:", name);
}
