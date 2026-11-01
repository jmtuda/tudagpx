import {
  createWorkspacePatch,
  emptyCloudWorkspace,
  sameValue,
} from "./workspacePatch.js";

export const PART_SIZE = 128_000;
export const MAX_PARTS = 1024;
export function splitWorkspace(text) {
  const parts = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + PART_SIZE, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    parts.push(text.slice(start, end));
    start = end;
  }
  if (parts.length > MAX_PARTS)
    throw new Error(
      "La biblioteca supera el tamaño admitido. Descarga una copia de seguridad.",
    );
  return parts;
}
export async function readResponse(response) {
  let result;
  try {
    result = await response.json();
  } catch {
    const message =
      response.status === 413
        ? "El servidor ha rechazado el tamaño de la transferencia. Descarga una copia y actualiza la aplicación."
        : response.status === 401
          ? "La sesión ha caducado. Descarga una copia antes de volver a entrar."
          : `El servidor no ha respondido correctamente (HTTP ${response.status}). Conserva la pestaña y reintenta.`;
    throw new Error(message);
  }
  if (!response.ok) {
    const error = new Error(
      result?.error || `Error de servidor (HTTP ${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  if (!result || typeof result !== "object")
    throw new Error(
      "Respuesta de servidor incompleta. No se ha confirmado el guardado.",
    );
  return result;
}
async function parallel(items, run) {
  let index = 0;
  const results = [];
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await run(items[i], i);
      }
    }),
  );
  return results;
}
export function createRemoteStore(fetcher = fetch, { cache } = {}) {
  let version = 0;
  let ownerId = null;
  let baseline = emptyCloudWorkspace();
  let pending = null;
  let stagedData = baseline;
  let inFlight = false;
  let blocked = false;
  let cacheQueue = Promise.resolve();
  const snapshot = (value) => JSON.parse(JSON.stringify(value));
  function persist() {
    if (!cache || !ownerId) return Promise.resolve();
    const envelope = snapshot({ version, data: baseline, pending });
    cacheQueue = cacheQueue
      .catch(() => {})
      .then(() => cache.save(ownerId, envelope));
    return cacheQueue;
  }
  async function request(query = "", body, method = "GET") {
    return readResponse(
      await fetcher(`/api/workspace${query}`, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      }),
    );
  }
  return {
    async load() {
      const info = await request("?metadata=1");
      if (
        !Number.isSafeInteger(info.version) ||
        !Number.isInteger(info.parts) ||
        info.parts < 0 ||
        info.parts > MAX_PARTS
      )
        throw new Error("Metadatos de biblioteca no válidos.");
      ownerId = typeof info.ownerId === "string" ? info.ownerId : null;
      const cached = cache && ownerId ? await cache.load(ownerId) : null;
      if (cached?.pending && Number.isSafeInteger(cached.version)) {
        // Never discard unsynced work or rebase it silently onto another device.
        baseline = cached.data || emptyCloudWorkspace();
        version = cached.version;
        pending = cached.pending;
        stagedData = pending;
        blocked = version !== info.version;
        return snapshot(pending);
      }
      let data = null;
      if (cached?.version === info.version && cached.data) {
        data = cached.data;
      } else if (info.parts) {
        const parts = await parallel(
          Array.from({ length: info.parts }, (_, i) => i),
          async (part) => {
            const result = await request(
              `?version=${info.version}&part=${part}`,
            );
            if (typeof result.chunk !== "string" || !result.chunk.length)
              throw new Error(
                "Descarga incompleta. No se ha sobrescrito ningún dato.",
              );
            return result.chunk;
          },
        );
        data = JSON.parse(parts.join(""));
      }
      version = info.version;
      baseline = snapshot(data || emptyCloudWorkspace());
      stagedData = baseline;
      pending = null;
      blocked = false;
      await persist();
      return snapshot(baseline);
    },
    async stage(data) {
      stagedData = snapshot(data);
      pending =
        !inFlight && sameValue(stagedData, baseline) ? null : stagedData;
      await persist();
    },
    async save(data, { staged = false } = {}) {
      if (!staged) await this.stage(data);
      if (blocked)
        throw new Error(
          "Hay cambios en otra pestaña o dispositivo. Tu trabajo local está conservado: descarga una copia antes de resolver el conflicto.",
        );
      const savedData = snapshot(data);
      const patch = createWorkspacePatch(baseline, savedData);
      if (!patch) return;
      if (inFlight) throw new Error("Hay una sincronización en curso.");
      inFlight = true;
      try {
        const text = JSON.stringify(patch);
        const parts = splitWorkspace(text);
        let body;
        if (parts.length === 1) body = { version, patch };
        else {
          const upload = crypto.randomUUID();
          await parallel(parts, (chunk, part) =>
            request("", { upload, part, total: parts.length, chunk }, "POST"),
          );
          body = { version, upload, total: parts.length, protocol: 2 };
        }
        let result;
        try {
          result = await request("", body, "PUT");
        } catch (error) {
          if (error.status === 409) blocked = true;
          throw error;
        }
        if (
          !Number.isSafeInteger(result.version) ||
          result.version !== version + 1
        )
          throw new Error("El servidor no ha confirmado la versión guardada.");
        version = result.version;
        baseline = savedData;
        pending = sameValue(stagedData, savedData) ? null : stagedData;
        await persist();
      } finally {
        inFlight = false;
      }
    },
  };
}
