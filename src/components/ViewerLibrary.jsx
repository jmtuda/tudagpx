import { colors, stats } from "../utils/workspace";
import { filterRoutes } from "../utils/routeFilters";
import { RouteFilters } from "./RouteFilters";
import ToolIcon from "./ToolIcon";
import { LibrarySort } from "./LibrarySort";
import { orderLibrary } from "../utils/libraryOrder";

export function ViewerLibrary({
  items,
  tab,
  onTab,
  filters,
  onFilters,
  bounds,
  visible,
  onToggle,
  onSend,
  onRename,
  onDelete,
  onDownload,
  onBackup,
  onRestore,
  onOpenDetails,
  order = "added-asc",
  onOrder,
}) {
  const category = items.filter(
    (item) => item.kind === (tab === "routes" ? "route" : "segment"),
  );
  const filtered = orderLibrary(filterRoutes(category, filters, bounds), order);
  return (
    <aside
      id="library-panel"
      className="sidebar"
      aria-label="Biblioteca de rutas y segmentos"
    >
      <div className="dock-controls">
        <RouteFilters
          category={tab === "routes" ? "rutas" : "segmentos"}
          value={filters}
          onChange={onFilters}
          count={filtered.length}
          total={category.length}
        />
      </div>
      <div className="sidebar-top">
        <nav aria-label="Biblioteca">
          {[
            ["routes", "Rutas", "route"],
            ["segments", "Segmentos", "segment"],
          ].map(([key, name, kind]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              aria-pressed={tab === key}
              onClick={() => onTab(key)}
            >
              {name} <b>{items.filter((item) => item.kind === kind).length}</b>
            </button>
          ))}
        </nav>
        <LibrarySort key={tab} category={tab === "routes" ? "rutas" : "segmentos"} value={order} onChange={onOrder} />
      </div>
      <div className="panel-content">
        {filtered.map((item) => {
          const metrics = stats(item.tracks);
          const selected = visible.includes(item.id);
          return (
            <article
              key={item.id}
              data-kind={item.kind}
              onClick={(event) => {
                if (!event.target.closest("button,input,select,textarea,a,label")) onOpenDetails(item);
              }}
              className={`library-card compact-route-card viewer-route-card${selected ? " selected" : ""}`}
              style={{
                "--route-color": colors[items.indexOf(item) % colors.length],
              }}
            >
              <div className="card-title">
                <input
                  type="checkbox"
                  aria-label={`Mostrar ${item.name}`}
                  checked={selected}
                  onChange={() => onToggle(item.id)}
                />
                <h3><a className="card-detail-link" href={`#recorrido/${encodeURIComponent(item.id)}`} onClick={(event) => { event.preventDefault(); onOpenDetails(item); }}>{item.name}</a></h3>
                {selected && (
                  <span className="color-mark" title="Color en el mapa" />
                )}
              </div>
              <span className="metrics">
                {metrics.km.toFixed(2)} km ·{" "}
                <span title="Desnivel positivo acumulado">
                  ↗ {metrics.ascent} m subida
                </span>
                {metrics.missing > 0 && <small> · elevación parcial</small>}
              </span>
              <span className={`completion-badge ${item.completed ? "is-completed" : ""}`}>{item.completed ? "✓ Realizada" : "Pendiente"}</span>
              {item.description && <p className="card-description">{item.description}</p>}
              {selected && (
                <div className="catalog-actions viewer-catalog-actions">
                  <button
                    className="send-to-editor"
                    title={`Enviar una copia de ${item.name} al editor`}
                    onClick={() => onSend(item)}
                  >
                    Enviar al editor
                  </button>

                  <button
                    aria-label={`Editar nombre de ${item.name}`}
                    onClick={() => onRename(item)}
                  >
                    Editar nombre
                  </button>
                  <button
                    aria-label={`Borrar ${item.name}`}
                    onClick={() => onDelete(item)}
                  >
                    Borrar
                  </button>
                  <button
                    className="download-gpx-icon"
                    aria-label="Descargar GPX"
                    title={`Descargar GPX de ${item.name}`}
                    onClick={() => onDownload(item)}
                  >
                    <ToolIcon name="export" />
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {!filtered.length && (
          <p className="empty">
            {category.length
              ? "Ningún recorrido coincide con los filtros. La selección sigue visible en el mapa."
              : tab === "segments"
                ? "Todavía no hay segmentos guardados."
                : "Importa tu primer archivo GPX."}
          </p>
        )}
      </div>
      <footer className="sidebar-footer">
        <details className="backup-controls">
          <summary>Copias de seguridad</summary>
          <div className="tools">
            <button onClick={onBackup}>Descargar copia completa</button>
            <button onClick={onRestore}>Añadir copia de seguridad</button>
          </div>
        </details>
        <small>Originales protegidos · sin conexión a Supabase</small>
      </footer>
    </aside>
  );
}
