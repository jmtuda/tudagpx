export const libraryOrders = [
  ["added-asc", "Inclusión: antiguas primero"],
  ["added-desc", "Inclusión: recientes primero"],
  ["name-asc", "Nombre: A–Z"],
  ["name-desc", "Nombre: Z–A"],
];
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
export function orderLibrary(items, order = "added-asc") {
  // The persisted array is the insertion ledger, including legacy records without dates.
  // Sorting is a read-only projection; it never changes map colors or library storage.
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (order.startsWith("name-")) {
      const compared = collator.compare(a.item.name, b.item.name);
      return (order === "name-desc" ? -compared : compared) || a.index - b.index;
    }
    return order === "added-desc" ? b.index - a.index : a.index - b.index;
  }).map(({ item }) => item);
}
export function readLibraryOrders() {
  try {
    const saved = JSON.parse(localStorage.getItem("tudagpx-library-order-v1"));
    const valid = new Set(libraryOrders.map(([key]) => key));
    return {
      routes: valid.has(saved?.routes) ? saved.routes : "added-asc",
      segments: valid.has(saved?.segments) ? saved.segments : "added-asc",
    };
  } catch {
    return { routes: "added-asc", segments: "added-asc" };
  }
}
