import { useEffect, useRef, useState } from "react";
export function SegmentNameDialog({
  segments,
  onSave,
  onCancel,
  kind = "segment",
}) {
  const dialog = useRef(null);
  const [names, setNames] = useState(() =>
    segments.map((segment) => segment.name),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const singular = kind === "route" ? "ruta" : "segmento";
  const action = `Guardar ${singular}${segments.length === 1 ? "" : "s"}`;
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector("input")?.select();
    return () => element.close();
  }, []);
  return (
    <dialog
      className="segment-name-dialog"
      ref={dialog}
      aria-labelledby="segment-name-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          const trimmed = names.map((name) => name.trim());
          if (trimmed.some((name) => !name)) {
            setError(`Escribe un nombre para cada ${singular}.`);
            return;
          }
          setSaving(true);
          try {
            await onSave(
              segments.map((segment, i) => ({ ...segment, name: trimmed[i] })),
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2 id="segment-name-title">{action}</h2>
        {names.map((name, i) => (
          <label key={segments[i].id}>
            {segments.length === 1
              ? `Nombre ${kind === "route" ? "de la ruta" : "del segmento"}`
              : `Nombre del ${singular} ${i + 1}`}
            <input
              required
              value={name}
              onChange={(event) =>
                setNames((previous) =>
                  previous.map((value, j) =>
                    j === i ? event.target.value : value,
                  ),
                )
              }
            />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        <div className="tools">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button className="primary" type="submit" disabled={saving}>
            {action}
          </button>
        </div>
      </form>
    </dialog>
  );
}
