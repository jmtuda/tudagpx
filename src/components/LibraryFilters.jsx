export function LibraryFilters({
  query,
  onQuery,
  importKind,
  onImportKind,
  sport,
  onSport,
  routes,
}) {
  return (
    <section
      className="filters viewer-filters"
      aria-label="Filtros de biblioteca"
    >
      <details className="all-route-filters">
        <summary>Buscar y filtrar</summary>
        <input
          aria-label="Buscar en la biblioteca"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        <div className="import-options">
          <label>
            Importar como{" "}
            <select
              aria-label="Destino del GPX"
              value={importKind}
              onChange={(event) => onImportKind(event.target.value)}
            >
              <option value="routes">Rutas</option>
              <option value="segments">Segmentos + original</option>
            </select>
          </label>
          {routes && (
            <select
              aria-label="Filtrar ciclismo"
              value={sport}
              onChange={(event) => onSport(event.target.value)}
            >
              {["Todos", "Sin clasificar", "Carretera", "Gravel", "MTB"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          )}
        </div>
      </details>
    </section>
  );
}
