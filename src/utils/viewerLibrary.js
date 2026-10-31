// A shared, read-only view model keeps map, cards and profiles in sync.
export function viewerLibrary(data) {
  return [
    ...data.routes
      .filter((item) => !item.deletedAt)
      .map((item) => ({ ...item, kind: "route" })),
    ...data.segments
      .filter((item) => !item.deletedAt)
      .map((item) => ({
        ...item,
        kind: "segment",
        sport: item.sport || "Sin clasificar",
        tracks: [item.points],
      })),
  ];
}
