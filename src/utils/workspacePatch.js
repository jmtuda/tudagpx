// The network protocol contains changed fields only, never unchanged originals.
export const CURRENT_POLICY = "current-only-v1";
export function sameValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
  );
}
export function emptyCloudWorkspace() {
  return {
    schema: 1,
    routes: [],
    segments: [],
    draft: [],
    draftName: "Mi nueva ruta",
    projects: [],
  };
}
export function createWorkspacePatch(previous, next) {
  const base = previous || emptyCloudWorkspace();
  const patch = {};
  for (const key of ["draft", "draftName"]) {
    if (!sameValue(base[key], next[key])) {
      (patch.fields ||= {})[key] = next[key];
    }
  }
  for (const collection of ["routes", "segments", "projects"]) {
    const old = new Map(base[collection].map((item) => [item.id, item]));
    const current = new Set(next[collection].map((item) => item.id));
    const removed = [...old.keys()].filter((id) => !current.has(id));
    if (collection === "projects") {
      if (next.projects.length)
        throw new Error(
          "Los proyectos recuperados deben abrirse en el editor, no guardarse como historial oculto.",
        );
      continue;
    }
    if (removed.length) (patch.remove ||= {})[collection] = removed;
    const changes = [];
    for (const item of next[collection]) {
      const existing = old.get(item.id);
      if (sameValue(existing, item)) continue;
      const fields = {};
      if (
        existing &&
        Object.keys(existing).some((key) => !Object.hasOwn(item, key))
      ) {
        throw new Error(
          "No se permite quitar campos de un original o una versión guardada.",
        );
      }
      for (const key of Object.keys(item)) {
        if (key !== "id" && (!existing || !sameValue(existing[key], item[key])))
          fields[key] = item[key];
      }
      if (Object.keys(fields).length) changes.push({ id: item.id, fields });
    }
    if (changes.length) patch[collection] = changes;
  }
  return Object.keys(patch).length ? patch : null;
}
