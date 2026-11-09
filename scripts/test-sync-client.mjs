import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRemoteStore,
  splitWorkspace,
} from "../src/utils/workspaceTransfer.js";
import {
  createWorkspacePatch,
  emptyCloudWorkspace,
} from "../src/utils/workspacePatch.js";
import { createSyncScheduler } from "../src/utils/syncScheduler.js";

const copy = (value) => structuredClone(value);
function fixture() {
  const data = emptyCloudWorkspace();
  data.routes.push({
    id: "r",
    name: "Original",
    original: "<gpx>" + "x".repeat(4000) + "</gpx>",
    originalBase64: btoa("original"),
    tracks: [
      [
        { lat: 40, lon: -4, ele: 10 },
        { lat: 41, lon: -4, ele: 20 },
      ],
    ],
  });
  return data;
}
// Protocol unit-test harness only; real SQL integration is tested separately.
function harness() {
  const db = { version: 1, ownerId: "owner-a", data: fixture(), fail: false };
  const requests = [];
  const stored = new Map();
  const uploads = new Map();
  const cache = {
    load: async (id) => copy(stored.get(id)),
    save: async (id, value) => stored.set(id, copy(value)),
  };
  const fetcher = async (url, options) => {
    requests.push({ url, ...options });
    const query = new URL(url, "https://example.test").searchParams;
    if (query.has("metadata"))
      return Response.json({
        version: db.version,
        ownerId: db.ownerId,
        policy: "current-only-v1",
        parts: splitWorkspace(JSON.stringify(db.data)).length,
      });
    if (query.has("part"))
      return Response.json({
        chunk: splitWorkspace(JSON.stringify(db.data))[
          Number(query.get("part"))
        ],
      });
    if (db.fail) throw new Error("offline");
    const body = JSON.parse(options.body);
    assert.equal(body.policy, "current-only-v1");
    if (options.method === "POST") {
      const parts = uploads.get(body.upload) || [];
      parts[body.part] = body.chunk;
      uploads.set(body.upload, parts);
      return Response.json({ ok: true });
    }
    if (body.version !== db.version)
      return Response.json({ error: "conflict" }, { status: 409 });
    const patch = body.patch || JSON.parse(uploads.get(body.upload).join(""));
    for (const collection of ["routes", "segments"])
      db.data[collection] = db.data[collection].filter(
        (item) => !(patch.remove?.[collection] || []).includes(item.id),
      );
    assert.ok(
      !patch.projects,
      "current-only clients must not add hidden projects",
    );
    for (const collection of ["routes", "segments"])
      for (const item of patch[collection] || []) {
        const old = db.data[collection].find((entry) => entry.id === item.id);
        if (old) Object.assign(old, item.fields);
        else db.data[collection].push({ id: item.id, ...item.fields });
      }
    Object.assign(db.data, patch.fields || {});
    return Response.json({ version: ++db.version });
  };
  return {
    db,
    requests,
    stored,
    cache,
    fetcher,
    remote: () => createRemoteStore(fetcher, { cache }),
  };
}

test("warm reload requests metadata only; initial load never writes", async () => {
  const h = harness();
  const remote = h.remote();
  const data = await remote.load();
  await remote.save(data);
  assert.equal(h.stored.get(h.db.ownerId).policy, "current-only-v1");
  assert.equal(h.requests.filter((r) => r.method !== "GET").length, 0);
  h.requests.length = 0;
  assert.deepEqual(await h.remote().load(), data);
  assert.equal(h.requests.length, 1);
  assert.match(h.requests[0].url, /metadata=1/);
});

test("rename and draft patches omit unchanged GPX and library", async () => {
  const h = harness();
  const remote = h.remote();
  const data = await remote.load();
  data.routes[0].name = "Nuevo nombre";
  await remote.save(data);
  const rename = JSON.parse(h.requests.at(-1).body);
  assert.deepEqual(rename.patch, {
    routes: [{ id: "r", fields: { name: "Nuevo nombre" } }],
  });
  const original = copy(data.routes);
  data.draft = [
    { id: "d", name: "Copia", points: copy(data.routes[0].tracks[0]) },
  ];
  await remote.save(data);
  const draft = JSON.parse(h.requests.at(-1).body);
  assert.deepEqual(Object.keys(draft.patch), ["fields"]);
  assert.equal(h.db.version, 3);
  assert.deepEqual(h.db.data.routes, original);
  assert.ok(Buffer.byteLength(JSON.stringify(rename)) < 200);
});

test("an obsolete cache policy cannot restore an old library", async () => {
  const h = harness();
  await h.remote().load();
  h.stored.get(h.db.ownerId).policy = "old-policy";
  h.stored.get(h.db.ownerId).data.routes[0].name = "Obsoleto";
  h.requests.length = 0;
  const loaded = await h.remote().load();
  assert.equal(loaded.routes[0].name, "Original");
  assert.ok(h.requests.some((request) => request.url.includes("&part=")));
  assert.equal(h.stored.get(h.db.ownerId).policy, "current-only-v1");
});

test("a replaced head during multipart reading retries the new revision", async () => {
  const h = harness();
  let replaced = false;
  const fetcher = async (url, options) => {
    if (url.includes("&part=") && !replaced) {
      replaced = true;
      h.db.version++;
      h.db.data.draftName = "Cambio concurrente";
      return Response.json({ error: "Versión no encontrada" }, { status: 404 });
    }
    return h.fetcher(url, options);
  };
  const remote = createRemoteStore(fetcher, { cache: h.cache });
  const loaded = await remote.load();
  assert.equal(loaded.draftName, "Cambio concurrente");
  assert.equal(h.stored.get(h.db.ownerId).version, 2);
  assert.equal(
    h.requests.filter((request) => request.url.includes("metadata=1")).length,
    2,
  );
});

test("cache belongs to the authenticated owner", async () => {
  const h = harness();
  await h.remote().load();
  h.db.ownerId = "owner-b";
  h.db.data.routes[0].name = "Otra cuenta";
  h.requests.length = 0;
  const loaded = await h.remote().load();
  assert.equal(loaded.routes[0].name, "Otra cuenta");
  assert.ok(h.requests.some((r) => r.url.includes("&part=")));
});

test("offline pending changes survive reload and sync from confirmed revision", async () => {
  const h = harness();
  const remote = h.remote();
  const data = await remote.load();
  data.draftName = "Trabajo protegido";
  h.db.fail = true;
  await assert.rejects(remote.save(data), /offline/);
  assert.equal(
    h.stored.get(h.db.ownerId).pending.draftName,
    "Trabajo protegido",
  );
  const restored = h.remote();
  assert.deepEqual(await restored.load(), data);
  h.db.fail = false;
  await restored.save(data);
  assert.equal(h.db.data.draftName, "Trabajo protegido");
  assert.equal(h.stored.get(h.db.ownerId).pending, null);
});

test("remote conflict preserves local recovery and refuses silent overwrite", async () => {
  const h = harness();
  const remote = h.remote();
  const data = await remote.load();
  data.draftName = "Trabajo sin sincronizar";
  await remote.stage(data);
  h.db.version++;
  const restored = h.remote();
  assert.deepEqual(await restored.load(), data);
  await assert.rejects(restored.save(data), /otra pestaña/);
  assert.equal(h.db.data.draftName, "Mi nueva ruta");
  assert.equal(h.stored.get(h.db.ownerId).pending.draftName, data.draftName);
});

test("edit/undo during an in-flight save keeps the latest local state", async () => {
  const h = harness();
  let release;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const delayed = async (url, options) => {
    if (options.method === "PUT") {
      started();
      await gate;
    }
    return h.fetcher(url, options);
  };
  const remote = createRemoteStore(delayed, { cache: h.cache });
  const original = await remote.load();
  const edited = copy(original);
  edited.draftName = "Primera edición";
  const saving = remote.save(edited);
  await ready;
  await remote.stage(original); // Undo while the previous save is still in flight.
  assert.deepEqual(h.stored.get(h.db.ownerId).pending, original);
  release();
  await saving;
  assert.deepEqual(h.stored.get(h.db.ownerId).pending, original);
  assert.equal(h.stored.get(h.db.ownerId).version, 2);
  await remote.save(original, { staged: true });
  assert.equal(h.db.data.draftName, original.draftName);
  assert.equal(h.stored.get(h.db.ownerId).pending, null);
});

test("large patches retain bounded Unicode-safe parts and protocol 2", async () => {
  const h = harness();
  const remote = h.remote();
  const data = await remote.load();
  data.draftName = "⛰️".repeat(100000);
  await remote.save(data);
  const posts = h.requests.filter((r) => r.method === "POST");
  assert.ok(posts.length > 1);
  assert.ok(posts.every((r) => !r.body.includes("originalBase64")));
  assert.equal(JSON.parse(h.requests.at(-1).body).protocol, 2);
  assert.equal(h.db.data.draftName, data.draftName);
});

test("diff emits explicit permanent removals and preserves unrelated identity", () => {
  const initial = fixture();
  initial.segments = [{ id: "s", name: "Segmento", points: [] }];
  const changed = copy(initial);
  changed.routes = [];
  changed.segments = [];
  assert.deepEqual(createWorkspacePatch(initial, changed), {
    remove: { routes: ["r"], segments: ["s"] },
  });
  assert.equal(createWorkspacePatch(initial, copy(initial)), null);
});

test("permanent removal syncs without originals and keeps open working copies", async () => {
  const h = harness();
  h.db.data.segments = [{ id: "s", name: "Segmento", points: [] }];
  h.db.data.draft = [
    { id: "d", name: "Copia", points: copy(h.db.data.routes[0].tracks[0]) },
  ];
  const remote = h.remote();
  const data = await remote.load();
  const draft = copy(data.draft);
  data.routes = [];
  data.segments = [];
  await remote.save(data);
  assert.deepEqual(JSON.parse(h.requests.at(-1).body), {
    version: 1,
    policy: "current-only-v1",
    patch: { remove: { routes: ["r"], segments: ["s"] } },
  });
  assert.deepEqual(h.db.data, data);
  assert.deepEqual(h.db.data.draft, draft);
  h.requests.length = 0;
  assert.deepEqual(await h.remote().load(), data);
  assert.equal(h.requests.length, 1);
});

test("diff refuses new hidden projects instead of creating automatic history", () => {
  const initial = fixture();
  const changed = copy(initial);
  changed.projects = [{ id: "hidden", name: "Versión", elements: [] }];
  assert.throws(
    () => createWorkspacePatch(initial, changed),
    /historial oculto/,
  );
});

function clock() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    setTimeout(fn, ms) {
      const key = ++id;
      tasks.set(key, { at: now + ms, fn });
      return key;
    },
    clearTimeout(key) {
      tasks.delete(key);
    },
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...tasks.entries()]
          .filter(([, task]) => task.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        tasks.delete(next[0]);
        await next[1].fn();
      }
      now = end;
    },
  };
}
test("sync scheduler coalesces bursts, enforces a deadline and reports failures", async () => {
  const timers = clock();
  const saved = [];
  const scheduler = createSyncScheduler(async (value) => saved.push(value), {
    timers,
    delay: 10,
    maxWait: 25,
  });
  const waits = [];
  waits.push(scheduler.schedule({ revision: 1 }));
  await timers.tick(9);
  waits.push(scheduler.schedule({ revision: 2 }));
  await timers.tick(9);
  waits.push(scheduler.schedule({ revision: 3 }));
  await timers.tick(7);
  await Promise.all(waits);
  assert.deepEqual(saved, [{ revision: 3 }]);
  const failing = createSyncScheduler(
    async () => {
      throw new Error("failed");
    },
    { timers },
  );
  const result = assert.rejects(failing.schedule({ revision: 4 }), /failed/);
  await failing.flush();
  await result;
});

test("scheduler never overlaps writes and buffers only the latest state", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const saved = [];
  const scheduler = createSyncScheduler(async (value) => {
    saved.push(value);
    if (value === 1) await gate;
  });
  const a = scheduler.schedule(1);
  const running = scheduler.flush();
  const b = scheduler.schedule(2);
  const c = scheduler.schedule(3);
  await scheduler.flush();
  assert.deepEqual(saved, [1]);
  release();
  await running;
  await Promise.all([a, b, c]);
  assert.deepEqual(saved, [1, 3]);
});
