import { useEffect, useId, useRef, useState } from "react";
import "../waypoints.css";

// Mount for a request; callbacks own the undoable commit and deletion confirmation.
export function WaypointDialog({ request, onSave, onCancel, onDelete }) {
  if (!request) return null;
  return (
    <WaypointForm
      key={request.waypoint?.id || `${request.point.lat},${request.point.lon}`}
      request={request}
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  );
}

function WaypointForm({ request, onSave, onCancel, onDelete }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [name, setName] = useState(request.waypoint?.name || "Waypoint");
  const [description, setDescription] = useState(
    request.waypoint?.description || "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  const act = async (callback) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await callback();
    } catch (reason) {
      setError(reason?.message || "No se ha podido guardar el waypoint.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="waypoint-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!description.trim()) {
            setError("Escribe una descripción para el waypoint.");
            return;
          }
          act(() =>
            onSave({
              ...request.point,
              ...request.waypoint,
              id: request.waypoint?.id || crypto.randomUUID(),
              name: name.trim() || "Waypoint",
              description: description.trim(),
            }),
          );
        }}
      >
        <h2 id={titleId}>
          {request.waypoint ? "Editar waypoint" : "Añadir waypoint"}
        </h2>
        <label>
          Nombre (opcional)
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
        </label>
        <div className="waypoint-field">
          <label htmlFor={`${titleId}-description`}>Descripción</label>
          <textarea
            id={`${titleId}-description`}
            autoFocus
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={busy}
            rows={4}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="waypoint-dialog-actions">
          {request.waypoint && onDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => onDelete(request.waypoint))}
            >
              Borrar waypoint
            </button>
          )}
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={busy}>
            Guardar waypoint
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default WaypointDialog;
