import { parseGPX } from "./workspace";

// Older imports kept exact GPX bytes but had no parsed waypoint field. Recover
// annotations for display/copy only; never rewrite an existing library original.
export function libraryAnnotations(item) {
  const hasWaypoints = Array.isArray(item?.waypoints);
  const hasDescription = typeof item?.description === "string";
  let parsed;
  if (item?.original && (!hasWaypoints || !hasDescription)) {
    try { parsed = parseGPX(item.original, item.filename); }
    catch { /* Malformed legacy text must not prevent reading its library card. */ }
  }
  return {
    waypoints: hasWaypoints ? item.waypoints : parsed?.waypoints || [],
    description: hasDescription ? item.description : parsed?.description || "",
  };
}
