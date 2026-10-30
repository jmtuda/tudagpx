import { useEffect, useRef, useState } from "react";
export function SegmentNameDialog({ segments, onSave, onCancel }) {
  const dialog = useRef(null);
  const [names, setNames] = useState(() =>
    segments.map((segment) => segment.name),
  );
  const [error, setError] = useState("");
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
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = names.map((name) => name.trim());
          if (trimmed.some((name) => !name)) {
            setError("Escribe un nombre para cada segmento.");
            return;
          }
          onSave(
            segments.map((segment, i) => ({ ...segment, name: trimmed[i] })),
          );
        }}
      >
        <h2 id="segment-name-title">
          {segments.length === 1 ? "Guardar segmento" : "Guardar segmentos"}
        </h2>
        {names.map((name, i) => (
          <label key={segments[i].id}>
            {segments.length === 1
              ? "Nombre del segmento"
              : `Nombre del segmento ${i + 1}`}
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
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" type="submit">
            {segments.length === 1 ? "Guardar segmento" : "Guardar segmentos"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
