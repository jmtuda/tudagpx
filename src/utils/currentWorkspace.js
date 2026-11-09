import { uid } from "./workspace.js";

// Only visible library entries and open editor work are persisted. Legacy manual
// snapshots become visible editable copies instead of another hidden archive.
export function currentWorkspace(data) {
  if (!data) return data;
  const recovered = (data.projects || []).flatMap((project) => {
    const editorRouteId = uid();
    return project.elements.map((element) => ({
      ...element,
      id: uid(),
      name: element.name,
      points: structuredClone(element.points),
      editorRouteId,
      editorRouteName: project.name,
    }));
  });
  return {
    ...data,
    routes: data.routes.filter((item) => !item.deletedAt),
    segments: data.segments.filter((item) => !item.deletedAt),
    draft: [...data.draft, ...recovered],
    projects: [],
  };
}
