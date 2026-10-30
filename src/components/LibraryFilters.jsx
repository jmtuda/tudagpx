export function LibraryFilters({ query, onQuery, importKind, onImportKind }) {
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
        </div>
      </details>
    </section>
  );
}
