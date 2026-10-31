import { useEffect, useState } from "react";
import ToolIcon from "./ToolIcon";

export function EditorTools({
  editing,
  onOpen,
  mode,
  onMode,
  elements,
  active,
  onName,
  onNew,
  onOpenLibrary,
  onClear,
  canClear,
  drawing,
  onFinish,
  onExit,
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
  routingConsent,
  onConsent,
  onRevokeConsent,
  routingBusy,
  onCancelRouting,
}) {
  const [segmentName, setSegmentName] = useState({ active: null, value: "" });
  useEffect(() => {
    if (!editing) return;
    const handler = (e) => {
      if (e.target.closest('input,textarea,select,[contenteditable="true"]'))
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
  const cropName = segmentName.active === active ? segmentName.value : "";
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
        <button
          aria-label="Abrir rutas y segmentos"
          title="Abrir rutas y segmentos de la biblioteca"
          onClick={onOpenLibrary}
        >
          <ToolIcon name="library" />
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
        <button aria-label="+ Dibujar" title="Nuevo trazado" onClick={onNew}>
          <ToolIcon name="plus" />
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
        <details className="routing-info">
          <summary
            aria-label="Información de cálculo"
            title="Información de cálculo"
          >
            <ToolIcon name="info" />
          </summary>
          <div className="routing-info-content">
            <p>
              BRouter · asfalto, pistas y senderos, sin preferencia por firme ·
              datos © OpenStreetMap. Puede incluir caminos peatonales; no
              garantiza ciclabilidad.
            </p>
            <p>
              Para calcular por caminos se envían las coordenadas de las anclas
              del tramo editado, no el archivo GPX completo ni sus nombres.
              Requiere internet.
            </p>
            <p>
              Al unir rutas se conserva su sentido y el orden numerado de la
              barra inferior. Para conectar huecos se envían solo sus extremos a
              BRouter y se sigue el camino más corto.
            </p>
            {!routing && (
              <p>
                Modo libre: líneas rectas, sin enviar coordenadas al servicio de
                cálculo al dibujar o editar. La unión de huecos sí utiliza
                BRouter.
              </p>
            )}
            {routingConsent ? (
              <button onClick={onRevokeConsent}>Retirar permiso</button>
            ) : (
              <>
                <button onClick={onConsent}>
                  Permitir cálculo con BRouter
                </button>
                {mergeSelection.length > 1 && (
                  <button
                    aria-label="Permitir conexiones con BRouter"
                    onClick={onConsent}
                  >
                    Permitir conexiones con BRouter
                  </button>
                )}
                <button onClick={() => onRouting(false)}>
                  Usar modo libre sin enviar coordenadas
                </button>
              </>
            )}
          </div>
        </details>
        <button
          aria-label="Salir del editor"
          title="Salir del editor"
          onClick={onExit}
        >
          <ToolIcon name="close" />
        </button>
        <span className="tool-divider" aria-hidden="true" />
        <div
          className="editor-save-actions"
          role="group"
          aria-label="Guardar y limpiar"
        >
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
            onClick={
              mode === "crop"
                ? () =>
                    onSaveSelection(
                      cropName.trim() || `${element.name} · segmento`,
                    )
                : onSaveSegment
            }
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
          <button
            aria-label="Limpiar mapa"
            title="Limpiar mapa sin borrar la biblioteca (se puede deshacer)"
            onClick={onClear}
            disabled={!canClear}
          >
            <ToolIcon name="clear" />
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
          {element && (
            <label className="trace-name">
              Nombre del tramo
              <input
                aria-label="Nombre del tramo"
                value={element.name}
                onChange={(event) => onName(event.target.value)}
              />
            </label>
          )}
          <label className="routing-toggle">
            <input
              type="checkbox"
              checked={routing}
              onChange={(e) => onRouting(e.target.checked)}
            />
            Seguir caminos
          </label>
        </section>
      )}
      {mode === "crop" && element?.points.length > 1 && (
        <section className="editor-options" aria-label="Opciones del editor">
          <label className="trace-name">
            Nombre del nuevo segmento
            <input
              aria-label="Nombre del nuevo segmento"
              placeholder={`${element.name} · segmento`}
              value={cropName}
              onChange={(e) =>
                setSegmentName({ active, value: e.target.value })
              }
            />
          </label>
        </section>
      )}
    </div>
  );
}
