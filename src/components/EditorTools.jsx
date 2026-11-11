import { useEffect } from "react";
import ToolIcon from "./ToolIcon";

export function EditorTools({
  editing,
  onOpen,
  mode,
  onMode,
  elements,
  active,

  onNew,

  onClear,
  canClear,
  drawing,
  onFinish,

  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCrop,
  onSaveSelection,
  onSaveSegment,
  onSaveRoute,
  onExport,
  mergeSelection = [],
  onMerge,
  onReverse,
  onCenter,
  routing,
  onRouting,

  onConsent,
  onRevokeConsent,
  routingBusy,
  onCancelRouting,
  range,
  onRange,
}) {
  useEffect(() => {
    if (!editing) return;
    const handler = (e) => {
      if (e.target.closest('dialog,input,textarea,select,[contenteditable="true"]'))
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
      }
      if (e.key === "Escape") onFinish();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, onUndo, onRedo, onFinish]);
  const element = elements.find((e) => e.id === active);
  const canSave = !routingBusy && (element?.points.length || 0) > 1;
  const routingInfo =
    "BRouter envía solo coordenadas de anclas o extremos para calcular caminos; nunca el GPX completo ni nombres. Datos © OpenStreetMap, requiere internet y no garantiza ciclabilidad. Desmarca para retirar el permiso y cancelar cálculos; marca para permitirlos.";

  if (!editing)
    return (
      <button
        className="open-map-editor"
        onClick={onOpen}
        title="Editar o crear un trazado"
      >
        <span aria-hidden="true">✎</span> Editar rutas
      </button>
    );
  return (
    <div className="map-editor" aria-label="Editor visual de rutas">
      <div
        className="editor-toolstrip"
        role="toolbar"
        aria-label="Herramientas del mapa"
      >
        <button aria-label="+ Dibujar" title="Nuevo trazado" onClick={onNew}>
          <ToolIcon name="plus" />
        </button>
        {[
          ["edit", "edit", "Editar trazado"],
          ["crop", "crop", "Recortar trazado"],
          ["split", "split", "Dividir trazado"],
        ].map(([value, icon, label]) => (
          <button
            key={value}
            className={mode === value ? "chosen" : ""}
            aria-label={label}
            title={label}
            aria-pressed={mode === value}
            onClick={() =>
              onMode(value === "edit" && mode === "edit" ? "view" : value)
            }
          >
            <ToolIcon name={icon} />
          </button>
        ))}
        <button
          aria-label="Añadir waypoint"
          title="Añadir waypoint"
          className={mode === "waypoint" ? "chosen" : ""}
          aria-pressed={mode === "waypoint"}
          disabled={!element?.points.length || routingBusy}
          onClick={() => onMode(mode === "waypoint" ? "view" : "waypoint")}
        >
          <ToolIcon name="waypoint" />
        </button>
        <button
          aria-label="Unir trazados"
          title="Unir en orden de selección: clic inicial y Ctrl/⌘ + clic para añadir. Los huecos siguen el camino más corto."
          disabled={mergeSelection.length < 2 || routingBusy}
          onClick={onMerge}
        >
          <ToolIcon name="merge" />
        </button>
        <button
          aria-label="Invertir trazado"
          title="Invertir trazado"
          onClick={onReverse}
          disabled={!element?.points.length || routingBusy}
        >
          <ToolIcon name="reverse" />
        </button>
        <button
          aria-label="Centrar trazado"
          title="Centrar trazado"
          onClick={onCenter}
          disabled={!element?.points.length}
        >
          <ToolIcon name="center" />
        </button>
        {mode === "crop" && (
          <>
            <button
              aria-label="Aplicar recorte al borrador"
              title="Aplicar recorte al borrador"
              onClick={onCrop}
              disabled={!canSave}
            >
              <ToolIcon name="check" />
            </button>
            <button
              aria-label="Cancelar recorte"
              title="Cancelar recorte"
              onClick={() => onMode("edit")}
            >
              <ToolIcon name="close" />
            </button>
          </>
        )}
        <span className="tool-divider" aria-hidden="true" />
        <button
          aria-label="↶ Deshacer"
          title="Deshacer (Ctrl/⌘ Z)"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <ToolIcon name="undo" />
        </button>
        <button
          aria-label="↷ Rehacer"
          title="Rehacer (Ctrl/⌘ Mayús Z)"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <ToolIcon name="redo" />
        </button>
        {drawing && (
          <button
            className="finish-drawing primary"
            aria-label="Terminar dibujo"
            title="Terminar dibujo"
            onClick={onFinish}
          >
            <ToolIcon name="check" /> Terminar dibujo
          </button>
        )}
        <button
          aria-label="Limpiar mapa"
          title="Limpiar mapa sin borrar la biblioteca (se puede deshacer)"
          onClick={onClear}
          disabled={!canClear}
        >
          <ToolIcon name="clear" />
        </button>
        <div
          className="editor-save-actions"
          role="group"
          aria-label="Guardar y exportar"
        >
          <span className="tool-divider" aria-hidden="true" />
          <button
            aria-label="Guardar ruta"
            title="Guardar el archivo activo como nueva ruta"
            onClick={onSaveRoute}
            disabled={!canSave}
          >
            <ToolIcon name="route" />
          </button>
          <button
            aria-label={
              mode === "crop"
                ? "Guardar selección como segmento"
                : "Guardar segmento"
            }
            title={
              mode === "crop"
                ? "Guardar selección como segmento"
                : "Guardar el trazado activo como nuevo segmento"
            }
            onClick={mode === "crop" ? () => onSaveSelection() : onSaveSegment}
            disabled={!canSave}
          >
            <ToolIcon name="segment" />
          </button>
          <button
            aria-label="Exportar a GPX"
            title="Comprobar y exportar los trazados abiertos a GPX"
            onClick={onExport}
            disabled={routingBusy}
          >
            <ToolIcon name="export" />
          </button>
        </div>
      </div>
      {routingBusy && (
        <div className="routing-status" role="status">
          Calculando por caminos…{" "}
          <button onClick={onCancelRouting}>Cancelar cálculo</button>
        </div>
      )}
      {mode === "edit" && (
        <section className="editor-options" aria-label="Opciones del editor">
          <label className="routing-toggle" title={routingInfo}>
            <input
              type="checkbox"
              checked={routing}
              aria-description={routingInfo}
              onChange={(e) => {
                const enabled = e.target.checked;
                if (enabled) onConsent?.();
                else onRevokeConsent?.();
                onRouting(enabled);
              }}
            />
            Seguir caminos
          </label>
        </section>
      )}
      {mode === "waypoint" && (
        <section className="editor-options" role="status">
          Pulsa el mapa para añadir un waypoint con descripción.
        </section>
      )}
      {mode === "crop" && element?.points.length > 1 && range && onRange && (
        <section className="editor-options" aria-label="Opciones del editor">
          <label className="crop-slider">
            Inicio
            <input
              aria-label="Inicio del recorte"
              type="range"
              min="0"
              max={Math.min(element.points.length - 2, range.end - 1)}
              value={range.start}
              onChange={(event) =>
                onRange({ ...range, start: Number(event.target.value) })
              }
            />
          </label>
          <label className="crop-slider">
            Final
            <input
              aria-label="Final del recorte"
              type="range"
              min={range.start + 1}
              max={element.points.length - 1}
              value={range.end}
              onChange={(event) =>
                onRange({ ...range, end: Number(event.target.value) })
              }
            />
          </label>
        </section>
      )}
    </div>
  );
}
