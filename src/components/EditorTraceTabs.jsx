import { useMemo } from "react";

// Un GPX multitramos ocupa una pestaña; sus tramos siguen siendo independientes.
export function EditorTraceTabs({ elements, active, onSelect }) {
  const routes = useMemo(() => {
    const groups = new Map();
    for (const element of elements) {
      const id = element.editorRouteId || element.id;
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
          className="loaded-route-tabs"
        >
          {routes.map((route, index) => (
            <button
              key={route.id}
              role="tab"
              aria-selected={route.id === activeRoute?.id}
              tabIndex={
                route.id === activeRoute?.id || (!activeRoute && index === 0)
                  ? 0
                  : -1
              }
              title={`${route.name}${route.elements.length > 1 ? ` · ${route.elements.length} tramos` : ""}`}
              onClick={() =>
                onSelect(
                  route.elements.find((e) => e.id === active)?.id ||
                    route.elements[0].id,
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
                event.currentTarget.parentElement.children[next].focus();
              }}
            >
              <span>{route.name}</span>
              {route.elements.length > 1 && (
                <small>{route.elements.length} tramos</small>
              )}
            </button>
          ))}
        </div>
      ) : (
        <span className="loaded-empty">
          Ninguna ruta cargada. Usa «Enviar al editor» o carga una copia.
        </span>
      )}
    </div>
  );
}
