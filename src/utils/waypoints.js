// Waypoints are independent of track geometry. Legacy files group by element id.
const groupKey = (element) => element.editorRouteId || element.id;

export function validateWaypoints(waypoints) {
  if (waypoints === undefined) return;
  if (!Array.isArray(waypoints)) throw new Error("Waypoints inválidos.");
  const ids = new Set();
  for (const point of waypoints) {
    if (
      !point ||
      typeof point.id !== "string" ||
      !point.id.trim() ||
      ids.has(point.id) ||
      !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lon) ||
      Math.abs(point.lat) > 90 ||
      Math.abs(point.lon) > 180 ||
      typeof point.name !== "string" ||
      typeof point.description !== "string" ||
      (point.ele !== undefined &&
        point.ele !== null &&
        !Number.isFinite(point.ele))
    )
      throw new Error(
        "Waypoints con datos inválidos o identificadores repetidos.",
      );
    ids.add(point.id);
  }
}

// Union by file and identity accommodates repeated arrays without losing
// distinct annotations when separate imported groups happen to share an id.
export function collectWaypoints(elements) {
  const groups = new Map();
  const result = [];
  for (const element of elements) {
    validateWaypoints(element.waypoints);
    const key = groupKey(element);
    if (!groups.has(key)) groups.set(key, new Set());
    const ids = groups.get(key);
    for (const waypoint of element.waypoints || []) {
      if (!ids.has(waypoint.id)) { ids.add(waypoint.id); result.push(waypoint); }
    }
  }
  return result;
}

export function getGroupWaypoints(elements, activeId) {
  const active = elements.find((element) => element.id === activeId);
  return active
    ? collectWaypoints(
        elements.filter((element) => groupKey(element) === groupKey(active)),
      )
    : [];
}

export function copyWaypoints(waypoints = []) {
  validateWaypoints(waypoints);
  return waypoints.map((waypoint) => ({
    ...waypoint,
    id: crypto.randomUUID(),
  }));
}

// Return a new undo-friendly draft, canonicalizing only the affected file group.
function updateGroup(elements, activeId, update) {
  const active = elements.find((element) => element.id === activeId);
  if (!active) return elements;
  const waypoints = update(getGroupWaypoints(elements, activeId));
  let first = true;
  return elements.map((element) => {
    if (groupKey(element) !== groupKey(active)) return element;
    const { waypoints: previous, ...rest } = element;
    void previous;
    if (!first) return rest;
    first = false;
    return { ...rest, waypoints };
  });
}

export function upsertGroupWaypoint(elements, activeId, waypoint) {
  validateWaypoints([waypoint]);
  return updateGroup(elements, activeId, (waypoints) => {
    const exists = waypoints.some((point) => point.id === waypoint.id);
    return exists
      ? waypoints.map((point) =>
          point.id === waypoint.id ? { ...waypoint } : point,
        )
      : [...waypoints, { ...waypoint }];
  });
}

export function removeGroupWaypoint(elements, activeId, id) {
  return updateGroup(elements, activeId, (waypoints) =>
    waypoints.filter((point) => point.id !== id),
  );
}
