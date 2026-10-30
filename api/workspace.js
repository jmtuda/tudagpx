import { neon } from "@neondatabase/serverless";
import { prepare, owner } from "../server/private.js";
import {
  PART_SIZE,
  stagePart,
  assembleUpload,
  validateChange,
} from "../server/workspaceTransport.js";

export async function handleWorkspace(req, res, sql, user) {
  try {
    if (req.method === "POST") {
      try {
        await stagePart(sql, user.id, req.body || {});
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
    const rows =
      await sql`SELECT version, payload FROM tudagpx_workspace_versions WHERE owner_id = ${user.id} ORDER BY version DESC LIMIT 1`;
    const current = rows[0];
    if (
      req.method === "GET" &&
      current &&
      Buffer.byteLength(JSON.stringify(current.payload)) > 3_000_000
    )
      return res.status(413).json({
        error:
          "Actualiza la aplicación para descargar la biblioteca por partes. Descarga antes una copia local si hay cambios pendientes.",
      });
    if (req.method === "GET")
      return res.status(200).json({
        version: Number(current?.version || 0),
        data: current?.payload || null,
      });
    if (req.method !== "PUT") return res.status(405).end();
    const { version, upload, total } = req.body || {};
    let data = req.body?.data;
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 3_000_000)
      return res.status(413).json({
        error:
          "Carga demasiado grande. Actualiza la aplicación para enviarla por partes; no se ha borrado ningún dato.",
      });
    try {
      if (upload) data = await assembleUpload(sql, user.id, upload, total);
      validateChange(data, current?.payload);
    } catch (error) {
      return res
        .status(400)
        .json({ error: error.message || "Datos no válidos." });
    }
    if (
      !Number.isSafeInteger(version) ||
      version !== Number(current?.version || 0)
    )
      return res.status(409).json({
        error:
          "Hay cambios en otra pestaña o dispositivo. Descarga tu copia antes de recargar.",
      });

    try {
      await sql`INSERT INTO tudagpx_workspace_versions (owner_id, version, payload) VALUES (${user.id}, ${version + 1}, ${JSON.stringify(data)}::jsonb)`;
    } catch (error) {
      if (error.code === "23505")
        return res.status(409).json({
          error: "Conflicto de versiones. Descarga tu copia antes de recargar.",
        });
      throw error;
    }
    // Read back the exact immutable revision before acknowledging a save.
    const saved =
      await sql`SELECT version FROM tudagpx_workspace_versions WHERE owner_id = ${user.id} AND version = ${version + 1}`;
    if (!saved.length) throw new Error("Missing saved revision");
    if (upload) {
      try {
        await sql`DELETE FROM tudagpx_upload_parts WHERE owner_id = ${user.id} AND upload_id = ${upload}`;
      } catch {
        console.warn(
          "Temporary upload cleanup deferred; revision already committed.",
        );
      }
    }
    return res.status(200).json({ version: Number(saved[0].version) });
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
