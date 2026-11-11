import { validateWorkspace } from "../src/utils/workspace.js";
import { isDeepStrictEqual } from "node:util";
import { PART_SIZE, MAX_PARTS } from "../src/utils/workspaceTransfer.js";
export { PART_SIZE, MAX_PARTS };
export function checkUpload(upload, part, total) {
  return (
    typeof upload === "string" &&
    /^[a-f0-9-]{36}$/.test(upload) &&
    Number.isInteger(total) &&
    total > 0 &&
    total <= MAX_PARTS &&
    Number.isInteger(part) &&
    part >= 0 &&
    part < total
  );
}
export async function stagePart(sql, userId, { upload, part, total, chunk }) {
  if (
    !checkUpload(upload, part, total) ||
    typeof chunk !== "string" ||
    chunk.length > PART_SIZE + 1
  )
    throw new Error("Parte de carga no válida.");
  const result =
    await sql`INSERT INTO tudagpx_upload_parts (owner_id, upload_id, part, total, chunk) VALUES (${userId}, ${upload}, ${part}, ${total}, ${chunk}) ON CONFLICT (owner_id, upload_id, part) DO UPDATE SET chunk = EXCLUDED.chunk WHERE tudagpx_upload_parts.total = EXCLUDED.total AND tudagpx_upload_parts.chunk = EXCLUDED.chunk RETURNING part`;
  if (!result.length) throw new Error("Parte de carga incompatible.");
}
export async function assembleUpload(sql, userId, upload, total) {
  if (!checkUpload(upload, 0, total)) throw new Error("Carga no válida.");
  const parts =
    await sql`SELECT part, total, chunk FROM tudagpx_upload_parts WHERE owner_id = ${userId} AND upload_id = ${upload} ORDER BY part`;
  if (
    parts.length !== total ||
    parts.some((entry, i) => entry.part !== i || entry.total !== total)
  )
    throw new Error(
      "La carga está incompleta. No se ha guardado ninguna versión.",
    );
  return JSON.parse(parts.map((entry) => entry.chunk).join(""));
}
export function validateChange(data, previous, { remove = {} } = {}) {
  validateWorkspace(data);
  if (
    data.projects.length ||
    [...data.routes, ...data.segments].some((item) =>
      Object.hasOwn(item, "deletedAt"),
    )
  )
    throw new Error(
      "Solo se permite guardar el estado actual, sin papelera ni proyectos ocultos.",
    );
  for (const category of Object.keys(remove)) {
    if (
      !["routes", "segments"].includes(category) ||
      !Array.isArray(remove[category]) ||
      new Set(remove[category]).size !== remove[category].length
    )
      throw new Error("Borrado explícito no válido.");
    for (const id of remove[category]) {
      if (
        typeof id !== "string" ||
        !previous?.[category].some((item) => item.id === id) ||
        data[category].some((item) => item.id === id)
      )
        throw new Error(
          "El borrado debe identificar un registro existente que se elimina.",
        );
    }
  }
  for (const original of previous?.routes || []) {
    const next = data.routes.find((route) => route.id === original.id);
    if (!next && remove.routes?.includes(original.id)) continue;
    if (
      !next ||
      next.original !== original.original ||
      next.originalBase64 !== original.originalBase64 ||
      !isDeepStrictEqual(next.tracks, original.tracks) ||
      !isDeepStrictEqual(next.waypoints ?? [], original.waypoints ?? [])
    )
      throw new Error("No se permite sustituir ni eliminar originales.");
  }
  for (const original of previous?.segments || []) {
    const next = data.segments.find((segment) => segment.id === original.id);
    if (!next && remove.segments?.includes(original.id)) continue;
    if (
      !next ||
      !isDeepStrictEqual(next.points, original.points) ||
      next.original !== original.original ||
      next.originalBase64 !== original.originalBase64 ||
      !isDeepStrictEqual(next.waypoints ?? [], original.waypoints ?? [])
    )
      throw new Error(
        "Los segmentos originales no se pueden sobrescribir. Edita y guarda una copia.",
      );
  }
  for (const project of previous?.projects || []) {
    if (
      !isDeepStrictEqual(
        project,
        data.projects.find((next) => next.id === project.id),
      )
    )
      throw new Error("Las versiones guardadas son inmutables.");
  }
}
