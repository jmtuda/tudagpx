import { inBounds, stats } from "./workspace";

export const emptyRouteFilters = {
  name: "",
  sport: "Todos",
  minKm: "",
  maxKm: "",
  minAscent: "",
  maxAscent: "",
  inView: false,
};
export function filterRoutes(routes, filters, bounds) {
  const name = filters.name.trim().toLocaleLowerCase("es");
  return routes.filter((route) => {
    if (!route.name.toLocaleLowerCase("es").includes(name)) return false;
    if (filters.sport !== "Todos" && route.sport !== filters.sport)
      return false;
    if (
      filters.inView &&
      !route.tracks.some((track) => inBounds(track, bounds))
    )
      return false;
    const metrics = stats(route.tracks);
    return [
      ["minKm", metrics.km, true],
      ["maxKm", metrics.km, false],
      ["minAscent", metrics.ascent, true],
      ["maxAscent", metrics.ascent, false],
    ].every(([key, value, minimum]) => {
      if (filters[key] === "") return true;
      const limit = Number(filters[key]);
      return (
        Number.isFinite(limit) &&
        limit >= 0 &&
        (minimum ? value >= limit : value <= limit)
      );
    });
  });
}
