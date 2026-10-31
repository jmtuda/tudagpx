import { emptyRouteFilters } from "../utils/routeFilters";

export function RouteFilters({
  value,
  onChange,
  count,
  total,
  category = "rutas",
}) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <section
      className="filters viewer-filters"
      aria-label={`Filtros de ${category}`}
    >
      <details className="all-route-filters">
        <summary>
          Buscar y filtrar {category} · {count} de {total}
        </summary>
        <input
          aria-label={`Buscar ${category} por nombre`}
          placeholder={`Buscar ${category} por nombre…`}
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
        />
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

        <div className="filter-results">
          <span role="status">
            {count} de {total} {category}
          </span>
          <button onClick={() => onChange({ ...emptyRouteFilters })}>
            Limpiar filtros
          </button>
        </div>
      </details>
    </section>
  );
}
