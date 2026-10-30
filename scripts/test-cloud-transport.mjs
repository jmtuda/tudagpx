import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { handleWorkspace } from "../api/workspace.js";
import {
  createRemoteStore,
  readResponse,
  splitWorkspace,
} from "../src/utils/workspaceTransfer.js";
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
await sql.query(
  readFileSync(
    new URL("../migrations/002_upload_parts.sql", import.meta.url),
    "utf8",
  ),
);
const tables =
  await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'tudagpx_upload_parts'`;
assert.equal(tables.length, 1);
console.log("Migration verified: upload parts table present.");
const user = { id: `transport-verification-${randomUUID()}` };
let maximumRequest = 0,
  maximumResponse = 0;
let failPart = false;
async function api(path, options) {
  const parsed = new URL(path, "https://tudagpx.vercel.app");
  const body = options.body ? JSON.parse(options.body) : undefined;
  maximumRequest = Math.max(
    maximumRequest,
    Buffer.byteLength(options.body || ""),
  );
  if (failPart && options.method === "POST")
    return new Response("upstream unavailable", { status: 503 });
  let status = 200,
    payload;
  const response = {
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
  };
  await handleWorkspace(
    {
      method: options.method,
      query: Object.fromEntries(parsed.searchParams),
      body,
    },
    response,
    sql,
    user,
  );
  const text = JSON.stringify(payload);
  maximumResponse = Math.max(maximumResponse, Buffer.byteLength(text));
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const hash = (text) => createHash("sha256").update(text).digest("hex");
try {
  const original =
    "<gpx><!--" +
    'Prueba sintética: montaña 🏔 " \\ '.repeat(70_000) +
    "--></gpx>";
  const data = {
    schema: 1,
    routes: [
      {
        id: "synthetic-route",
        name: "PRUEBA SINTÉTICA — no navegar",
        original,
        originalBase64: Buffer.from(original).toString("base64"),
        tracks: [
          [
            { lat: 40, lon: -3, ele: null },
            { lat: 40.01, lon: -3.01, ele: 20 },
          ],
        ],
      },
    ],
    segments: [],
    draft: [],
    projects: [],
    draftName: "Prueba de transporte",
  };
  const bytes = Buffer.byteLength(JSON.stringify(data));
  assert.ok(bytes > 4_500_000);
  const remote = createRemoteStore(api);
  await remote.save(data);
  const reader = createRemoteStore(api);
  const recovered = await reader.load();
  assert.deepEqual(recovered, data);
  assert.equal(
    hash(recovered.routes[0].originalBase64),
    hash(data.routes[0].originalBase64),
  );
  assert.ok(maximumRequest < 1_000_000 && maximumResponse < 1_000_000);
  console.log(
    JSON.stringify({
      test: "REAL Neon + production handler + client, synthetic isolated owner (no login bypass in deployment)",
      bytes,
      maximumRequest,
      maximumResponse,
      originalBytesIntact: true,
    }),
  );
  failPart = true;
  await assert.rejects(remote.save(data), /HTTP 503/);
  failPart = false;
  const afterFailure =
    await sql`SELECT count(*)::int AS count FROM tudagpx_workspace_versions WHERE owner_id = ${user.id}`;
  assert.equal(afterFailure[0].count, 1);
  await remote.save(data);
  await assert.rejects(reader.save(data), /otra pestaña/);
  const mutation = structuredClone(data);
  mutation.routes[0].originalBase64 = "YQ==";
  await assert.rejects(remote.save(mutation), /originales/);
  for (const [status, message] of [
    [413, /tamaño/],
    [401, /sesión/],
    [502, /HTTP 502/],
  ])
    await assert.rejects(
      readResponse(new Response("not JSON", { status })),
      message,
    );
  const unicode = "a".repeat(127999) + "🏔";
  assert.equal(splitWorkspace(unicode).join(""), unicode);
  assert.ok(splitWorkspace(unicode).every((part) => !part.endsWith("\ud83c")));
  console.log(
    "PASS: large save/reload, exact originals, bounded transfers, interrupted upload, conflict, immutable originals, non-JSON HTTP failures and Unicode.",
  );
} finally {
  // Delete ONLY this script's synthetic test namespace, never owner data.
  await sql`DELETE FROM tudagpx_upload_parts WHERE owner_id = ${user.id}`;
  await sql`DELETE FROM tudagpx_workspace_versions WHERE owner_id = ${user.id}`;
  const remaining =
    await sql`SELECT count(*)::int AS count FROM tudagpx_workspace_versions WHERE owner_id = ${user.id}`;
  assert.equal(remaining[0].count, 0);
  console.log("Synthetic test records removed and absence verified.");
}
