import { emptyRouteFilters } from "../utils/routeFilters";

export function RouteFilters({ value, onChange, count, total }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <section className="filters viewer-filters" aria-label="Filtros de rutas">
      <details className="all-route-filters">
        <summary>
          Buscar y filtrar rutas · {count} de {total}
        </summary>
        <input
          aria-label="Buscar rutas por nombre"
          placeholder="Buscar rutas por nombre…"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <select
          aria-label="Tipo de ciclismo"
          value={value.sport}
          onChange={(e) => set("sport", e.target.value)}
        >
          {["Todos", "Sin clasificar", "Carretera", "Gravel", "MTB"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        <details>
          <summary>Más filtros: distancia, desnivel y zona</summary>
          <div className="range-filters">
            {[
              ["minKm", "Distancia mínima (km)"],
              ["maxKm", "Distancia máxima (km)"],
              ["minAscent", "Desnivel mínimo (m)"],
              ["maxAscent", "Desnivel máximo (m)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Sin límite"
                  value={value[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="geographic-filter">
            <input
              type="checkbox"
              checked={value.inView}
              onChange={(e) => set("inView", e.target.checked)}
            />
            Solo rutas que cruzan el mapa visible
          </label>
          <p className="hint">
            El desnivel es el acumulado disponible en el GPX; puede estar
            incompleto.
          </p>
        </details>
        <div className="filter-results">
          <span role="status">
            {count} de {total} rutas
          </span>
          <button onClick={() => onChange({ ...emptyRouteFilters })}>
            Limpiar filtros
          </button>
        </div>
      </details>
    </section>
  );
}
