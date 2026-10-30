import { colors } from "./workspace";

export const editorRouteKey = (element) => element.editorRouteId || element.id;

export function editorRouteColors(elements) {
  const groups = new Map();
  for (const element of elements) {
    const id = editorRouteKey(element);
    if (!groups.has(id)) groups.set(id, colors[groups.size % colors.length]);
  }
  return groups;
}
