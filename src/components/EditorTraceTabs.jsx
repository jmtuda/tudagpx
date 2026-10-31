import { useMemo } from "react";
import { editorRouteColors, editorRouteKey } from "../utils/editorRoutes";

// Un GPX multitramos ocupa una pestaña; sus tramos siguen siendo independientes.
export function EditorTraceTabs({
  elements,
  active,
  onSelect,
  onClose,
  selection = [],
}) {
  const routeColors = editorRouteColors(elements);
  const routes = useMemo(() => {
    const groups = new Map();
    for (const element of elements) {
      const id = editorRouteKey(element);
      if (!groups.has(id))
        groups.set(id, {
          id,
          name: element.editorRouteName || element.name,
          elements: [],
        });
      groups.get(id).elements.push(element);
    }
    return [...groups.values()];
  }, [elements]);
  const activeRoute = routes.find((route) =>
    route.elements.some((e) => e.id === active),
  );
  return (
    <div className="editor-loaded-routes">
      <span className="loaded-label">En el editor</span>
      {routes.length ? (
        <div
          role="tablist"
          aria-label="Rutas cargadas en el editor"
          aria-multiselectable="true"
          className="loaded-route-tabs"
        >
          {routes.map((route, index) => (
            <div
              className="loaded-route-file"
              key={route.id}
              style={{ "--route-color": routeColors.get(route.id) }}
            >
              <button
                role="tab"
                aria-selected={
                  selection.length
                    ? selection.includes(route.id)
                    : route.id === activeRoute?.id
                }
                tabIndex={
                  route.id === activeRoute?.id || (!activeRoute && index === 0)
                    ? 0
                    : -1
                }
                title={`${route.name}${route.elements.length > 1 ? ` · ${route.elements.length} tramos` : ""}`}
                onContextMenu={(event) => {
                  if (event.ctrlKey) {
                    event.preventDefault();
                    onSelect(route.elements[0].id, true);
                  }
                }}
                onClick={(event) =>
                  onSelect(
                    route.elements.find((e) => e.id === active)?.id ||
                      route.elements[0].id,
                    event.ctrlKey || event.metaKey,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? routes.length - 1
                        : (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            routes.length) %
                          routes.length;
                  onSelect(routes[next].elements[0].id);
                  event.currentTarget
                    .closest('[role="tablist"]')
                    .querySelectorAll('[role="tab"]')
                    [next].focus();
                }}
              >
                <i className="loaded-route-color" aria-hidden="true" />
                <span>{route.name}</span>
                {selection.length > 1 && selection.includes(route.id) && (
                  <small aria-hidden="true">
                    {selection.indexOf(route.id) + 1}
                  </small>
                )}
                {route.elements.length > 1 && (
                  <small>{route.elements.length} tramos</small>
                )}
              </button>
              <button
                className="close-loaded-route"
                aria-label={`Cerrar ${route.name}`}
                title="Cerrar del editor (no borra el original; se puede deshacer)"
                onClick={() => onClose(route.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span className="loaded-empty">
          Ninguna ruta cargada. Usa «Enviar al editor» desde «Ver rutas».
        </span>
      )}
    </div>
  );
}
