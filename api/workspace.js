import { neon } from "@neondatabase/serverless";
import { prepare, owner } from "../server/private.js";
import { PART_SIZE, checkUpload } from "../server/workspaceTransport.js";

const POLICY = "current-only-v1";

export async function handleWorkspace(req, res, sql, user) {
  try {
    // Fence old tabs before any Neon query or temporary upload write.
    if (["POST", "PUT"].includes(req.method) && req.body?.policy !== POLICY)
      return res.status(409).json({
        error:
          "Actualiza la aplicación antes de guardar. Conserva tu trabajo y descarga una copia.",
      });
    if (req.method === "POST") {
      try {
        const { upload, part, total, chunk } = req.body || {};
        if (
          !checkUpload(upload, part, total) ||
          typeof chunk !== "string" ||
          chunk.length > PART_SIZE + 1
        )
          throw new Error("Parte no válida");
        const staged =
          await sql`SELECT part FROM tudagpx_stage_workspace_part(${user.id}::text, ${upload}::text, ${part}::int, ${total}::int, ${chunk}::text)`;
        if (!staged.length) throw new Error("Parte incompatible");
      } catch {
        return res.status(400).json({
          error:
            "No se ha podido cargar esta parte. Conserva la pestaña y reintenta.",
        });
      }
      return res.status(200).json({ ok: true });
    }
    if (req.method === "GET" && req.query?.metadata === "1") {
      const rows =
        await sql`SELECT version, ceil(char_length(payload::text)::numeric / ${PART_SIZE})::int AS parts FROM tudagpx_workspace_versions WHERE owner_id = ${user.id} ORDER BY version DESC LIMIT 1`;
      return res.status(200).json({
        version: Number(rows[0]?.version || 0),
        parts: rows[0]?.parts || 0,
        ownerId: user.id,
        policy: POLICY,
      });
    }
    if (req.method === "GET" && req.query?.part !== undefined) {
      const version = Number(req.query.version),
        part = Number(req.query.part);
      if (
        !Number.isSafeInteger(version) ||
        version < 1 ||
        !Number.isSafeInteger(part) ||
        part < 0 ||
        part >= 1024
      )
        return res.status(400).json({ error: "Parte no válida." });
      const rows =
        await sql`SELECT substring(payload::text FROM ${part * PART_SIZE + 1}::int FOR ${PART_SIZE}::int) AS chunk FROM tudagpx_workspace_versions WHERE owner_id = ${user.id} AND version = ${version}`;
      return res
        .status(rows.length ? 200 : 404)
        .json(rows[0] || { error: "Versión no encontrada." });
    }
    if (req.method === "GET") {
      // Guard legacy reads in SQL, before Neon sends a potentially huge payload.
      const rows =
        await sql`SELECT version, octet_length(payload::text) > 3000000 AS oversized,
        CASE WHEN octet_length(payload::text) <= 3000000 THEN payload ELSE NULL END AS payload
        FROM tudagpx_workspace_versions WHERE owner_id = ${user.id} ORDER BY version DESC LIMIT 1`;
      if (rows[0]?.oversized)
        return res.status(413).json({
          error:
            "Actualiza la aplicación para descargar la biblioteca por partes. Descarga antes una copia local si hay cambios pendientes.",
        });
      return res.status(200).json({
        version: Number(rows[0]?.version || 0),
        data: rows[0]?.payload || null,
      });
    }
    if (req.method !== "PUT") return res.status(405).end();
    const body = req.body || {};
    if (Buffer.byteLength(JSON.stringify(body)) > 3_000_000)
      return res.status(413).json({
        error:
          "Carga demasiado grande. Actualiza la aplicación para enviarla por partes; no se ha borrado ningún dato.",
      });
    const { version, upload, total, protocol } = body;
    if (!Number.isSafeInteger(version) || version < 0)
      return res.status(409).json({
        error: "Conflicto de versiones. Descarga tu copia antes de recargar.",
      });
    const isPatch = Object.hasOwn(body, "patch") || protocol === 2;
    if (
      (protocol !== undefined && protocol !== 2) ||
      (upload !== undefined &&
        (typeof upload !== "string" ||
          !/^[a-f0-9-]{36}$/.test(upload) ||
          !Number.isInteger(total) ||
          total < 1 ||
          total > 1024)) ||
      (upload === undefined &&
        protocol === 2 &&
        !Object.hasOwn(body, "patch")) ||
      (Object.hasOwn(body, "patch") && Object.hasOwn(body, "data"))
    )
      return res.status(400).json({ error: "Carga no válida." });
    try {
      const document = isPatch ? body.patch : body.data;
      // One atomic current-only commit: assembly, validation, immutable originals
      // and removal of prior heads all stay in Postgres, including full saves.
      const saved = await sql`SELECT version FROM tudagpx_save_workspace(
        ${user.id}::text, ${version}::bigint, ${JSON.stringify(document ?? null)}::jsonb,
        ${isPatch}::boolean, ${upload ?? null}::text, ${total ?? null}::int)`;
      if (!saved.length) throw new Error("Missing saved revision");
      return res.status(200).json({ version: Number(saved[0].version) });
    } catch (error) {
      if (error.code === "40001" || error.code === "23505")
        return res.status(409).json({
          error:
            "Hay cambios en otra pestaña o dispositivo. Descarga tu copia antes de recargar.",
        });
      if (error.code === "22023" || error.code === "22P02")
        return res
          .status(400)
          .json({ error: error.message || "Datos no válidos." });
      throw error;
    }
  } catch (error) {
    console.error(
      "Workspace storage operation failed",
      error.name,
      error.code || "NO_CODE",
    );
    return res.status(503).json({
      error:
        "No se ha podido acceder a Neon. Conserva la pestaña y descarga una copia.",
    });
  }
}

export default async function handler(req, res) {
  if (!prepare(req, res)) return;
  try {
    const user = await owner(req);
    if (!user)
      return res
        .status(401)
        .json({ error: "Inicia sesión con la cuenta autorizada." });
    return await handleWorkspace(
      req,
      res,
      neon(process.env.DATABASE_URL),
      user,
    );
  } catch {
    return res.status(503).json({
      error:
        "No se ha podido acceder a Neon. Conserva la pestaña y descarga una copia.",
    });
  }
}
