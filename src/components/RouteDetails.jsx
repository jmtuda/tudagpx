import { useState } from "react";
import { stats } from "../utils/workspace";

export function RouteDetails({ item, onBack, onSave, onSend, onRename, onDelete, onDownload }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(item.description || "");
  const [completed, setCompleted] = useState(item.completed === true);
  const metrics = stats(item.tracks);
  return (
    <aside className="sidebar route-details" aria-label="Detalle del recorrido">
      <div className="route-details-content">
        <button className="detail-back" onClick={onBack}>← Volver a la biblioteca</button>
        <p className="detail-kind">{item.kind === "segment" ? "Segmento" : "Ruta"}</p>
        <h2 tabIndex={-1}>{item.name}</h2>
        <p className="detail-metrics">{metrics.km.toFixed(2)} km · ↗ {metrics.ascent} m subida</p>
        <span className={`completion-badge ${item.completed ? "is-completed" : ""}`}>
          {item.completed ? "✓ Realizada" : "Pendiente de realizar"}
        </span>
        {editing ? (
          <form className="route-metadata-form" onSubmit={(event) => {
            event.preventDefault();
            onSave({ completed, description });
            setEditing(false);
          }}>
            <label className="completed-field"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} />Realizada</label>
            <div className="description-field"><label htmlFor="route-description-text">Descripción</label><textarea id="route-description-text" rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe el recorrido, sus puntos de interés o tus notas…" /></div>
            <div className="tools">
              <button type="button" onClick={() => setEditing(false)}>Cancelar cambios</button>
              <button type="submit" className="primary">Guardar datos</button>
            </div>
          </form>
        ) : (
          <section className="route-description" aria-label="Descripción del recorrido">
            <h3>Descripción</h3>
            <p>{item.description || "Todavía no hay descripción."}</p>
            <button onClick={() => {
              setDescription(item.description || "");
              setCompleted(item.completed === true);
              setEditing(true);
            }}>Editar datos</button>
          </section>
        )}
        {item.waypoints?.length > 0 && <section className="detail-waypoints" aria-label="Waypoints del recorrido">
          <h3>Waypoints</h3>
          <ol>{item.waypoints.map((waypoint) => <li key={waypoint.id}><strong>{waypoint.name}</strong><p>{waypoint.description || "Sin descripción"}</p></li>)}</ol>
        </section>}
        <div className="detail-actions">
          <button className="primary" onClick={() => onSend(item)}>Enviar al editor</button>
          <button onClick={() => onDownload(item)}>Descargar GPX</button>
          <button onClick={() => onRename(item)}>Editar nombre</button>
          <button onClick={() => onDelete(item)}>Borrar</button>
        </div>
      </div>
    </aside>
  );
}
