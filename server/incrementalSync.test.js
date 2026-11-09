import test from "node:test";
import assert from "node:assert/strict";
import { handleWorkspace } from "../api/workspace.js";

async function invoke(req, rows = [{ version: "8" }], failure) {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    if (failure) throw failure;
    return rows;
  };
  let status = 200,
    body;
  await handleWorkspace(
    req.body
      ? { ...req, body: { policy: "current-only-v1", ...req.body } }
      : req,
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        body = value;
        return this;
      },
      end() {
        return this;
      },
    },
    sql,
    { id: "unit-owner" },
  );
  return { status, body, calls };
}

test("patch commits via one SQL function, never reads payload or chunks to server", async () => {
  const patch = { routes: [{ id: "r", fields: { name: "Renombrada" } }] };
  const result = await invoke({ method: "PUT", body: { version: 7, patch } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { version: 8 });
  assert.equal(result.calls.length, 1);
  assert.match(
    result.calls[0].text,
    /SELECT version FROM tudagpx_save_workspace/,
  );
  assert.doesNotMatch(result.calls[0].text, /SELECT.*payload|SELECT.*chunk/);
  assert.deepEqual(result.calls[0].values, [
    "unit-owner",
    7,
    JSON.stringify(patch),
    true,
    null,
    null,
  ]);
});

test("multipart v2 assembly stays entirely in PostgreSQL", async () => {
  const upload = "12345678-1234-1234-1234-123456789012";
  const result = await invoke({
    method: "PUT",
    body: { version: 7, upload, total: 2, protocol: 2 },
  });
  assert.equal(result.status, 200);
  assert.equal(result.calls.length, 1);
  assert.deepEqual(result.calls[0].values, [
    "unit-owner",
    7,
    "null",
    true,
    upload,
    2,
  ]);
});

test("legacy full and multipart saves also never fetch previous payload", async () => {
  for (const body of [
    { version: 7, data: { schema: 1 } },
    { version: 7, upload: "12345678-1234-1234-1234-123456789012", total: 2 },
  ]) {
    const result = await invoke({ method: "PUT", body });
    assert.equal(result.status, 200);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].values[3], false);
  }
});

test("metadata is owner-scoped, legacy fields preserved", async () => {
  const result = await invoke({ method: "GET", query: { metadata: "1" } }, [
    { version: "7", parts: 2 },
  ]);
  assert.deepEqual(result.body, {
    version: 7,
    parts: 2,
    ownerId: "unit-owner",
    policy: "current-only-v1",
  });
  assert.deepEqual(result.calls[0].values, [128000, "unit-owner"]);
});

test("database conflicts and validation errors map to existing statuses", async () => {
  for (const [code, status] of [
    ["40001", 409],
    ["23505", 409],
    ["22023", 400],
    ["22P02", 400],
  ]) {
    const result = await invoke(
      { method: "PUT", body: { version: 7, patch: {} } },
      [],
      { code, message: "Datos no válidos" },
    );
    assert.equal(result.status, status);
    assert.equal(result.calls.length, 1);
  }
});

test("malformed uploads, ambiguous body, unsupported protocol and oversized requests do not query Neon", async () => {
  for (const [body, expected] of [
    [{ version: -1, patch: {} }, 409],
    [{ version: 7, patch: {}, data: {} }, 400],
    [{ version: 7, protocol: 3, patch: {} }, 400],
    [{ version: 7, protocol: 2 }, 400],
    [{ version: 7, upload: "bad", total: 2 }, 400],
    [
      { version: 7, patch: { fields: { draftName: "a".repeat(3000000) } } },
      413,
    ],
  ]) {
    const result = await invoke({ method: "PUT", body });
    assert.equal(result.status, expected);
    assert.equal(result.calls.length, 0);
  }
});

test("legacy oversized GET is guarded before payload leaves database", async () => {
  const result = await invoke({ method: "GET" }, [
    { version: "7", oversized: true, payload: null },
  ]);
  assert.equal(result.status, 413);
  assert.match(
    result.calls[0].text,
    /CASE WHEN octet_length\(payload::text\) <= 3000000 THEN payload ELSE NULL END/,
  );
});

test("download parts remain pinned to revision and return only the part", async () => {
  const result = await invoke(
    { method: "GET", query: { version: "7", part: "0" } },
    [{ chunk: "Unicode 🏔" }],
  );
  assert.deepEqual(result.body, { chunk: "Unicode 🏔" });
  assert.match(result.calls[0].text, /substring\(payload::text/);
  assert.deepEqual(result.calls[0].values, [1, 128000, "unit-owner", 7]);
});

test("old clients cannot write or stage even invalid payloads before Neon", async () => {
  for (const method of ["POST", "PUT"]) {
    for (const policy of [undefined, null, "append-only", "current-only-v2"]) {
      const result = await invoke({
        method,
        body: { policy, version: 7, patch: {} },
      });
      assert.equal(result.status, 409);
      assert.match(result.body.error, /Actualiza/);
      assert.equal(result.calls.length, 0);
    }
  }
});

test("explicit removals pass unchanged to the atomic database function", async () => {
  const patch = { remove: { routes: ["r"], segments: ["s"] } };
  const result = await invoke({ method: "PUT", body: { version: 7, patch } });
  assert.equal(result.status, 200);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].values[2], JSON.stringify(patch));
});

test("multipart staging and expiration stay in PostgreSQL", async () => {
  const upload = "12345678-1234-1234-1234-123456789012";
  const result = await invoke(
    { method: "POST", body: { upload, part: 0, total: 1, chunk: "{}" } },
    [{ part: 0 }],
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(result.calls.length, 1);
  assert.match(
    result.calls[0].text,
    /SELECT part FROM tudagpx_stage_workspace_part/,
  );
  assert.deepEqual(result.calls[0].values, ["unit-owner", upload, 0, 1, "{}"]);
  for (const body of [
    { upload, part: 0, total: 1, chunk: 3 },
    { upload: "bad", part: 0, total: 1, chunk: "{}" },
  ]) {
    const invalid = await invoke({ method: "POST", body });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.calls.length, 0);
  }
});
