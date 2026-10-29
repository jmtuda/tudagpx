import { useEffect, useMemo, useRef, useState } from "react";
import { cumulativeDistances } from "../utils/editorGeometry";
import { stats } from "../utils/workspace";
function CropProfile({ points, range, onRange }) {
  const distances = useMemo(() => cumulativeDistances(points), [points]);
  const total = distances.at(-1) || 1,
    count = points.length;
  const xs = distances.map((d, i) =>
    distances.at(-1) ? d / total : i / (count - 1),
  );
  const elevations = points
    .filter((p) => Number.isFinite(p.ele))
    .map((p) => p.ele);
  const low = elevations.reduce((a, b) => Math.min(a, b), Infinity),
    high = elevations.reduce((a, b) => Math.max(a, b), -Infinity);

  const chart = points
    .map((p, i) =>
      Number.isFinite(p.ele)
        ? `${xs[i] * 260},${64 - ((p.ele - low) * 48) / (high - low || 1)}`
        : null,
    )
    .filter(Boolean)
    .join(" ");
  const dragStart = useRef(null);
  function indexAt(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i;
    });
    return best;
  }
  function selectTo(index) {
    const a = Math.min(dragStart.current, index),
      b = Math.max(dragStart.current, index);
    onRange({
      start: Math.min(a, count - 2),
      end: Math.min(count - 1, Math.max(b, a + 1)),
    });
  }
  return (
    <>
      <svg
        className="crop-profile"
        viewBox="0 0 260 78"
        preserveAspectRatio="none"
        role="img"
        aria-label="Perfil para seleccionar el recorte; arrastra sobre él"
        onPointerDown={(e) => {
          e.preventDefault();
          dragStart.current = indexAt(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragStart.current !== null) selectTo(indexAt(e));
        }}
        onPointerUp={(e) => {
          if (dragStart.current !== null) selectTo(indexAt(e));
          dragStart.current = null;
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <rect width="260" height="78" fill="#f5f8f6" />
        <rect
          x={xs[range.start] * 260}
          width={(xs[range.end] - xs[range.start]) * 260}
          height="78"
          fill="#007d77"
          fillOpacity=".13"
        />
        {elevations.length > 1 && (
          <polyline
            points={chart}
            fill="none"
            stroke="#007d77"
            strokeWidth="2"
          />
        )}
        {[range.start, range.end].map((i, n) => (
          <line
            key={n}
            x1={xs[i] * 260}
            x2={xs[i] * 260}
            y1="0"
            y2="78"
            stroke={n ? "#ca543d" : "#007d77"}
            strokeWidth="3"
          />
        ))}
        {!elevations.length && (
          <text x="130" y="42" textAnchor="middle" fill="#71827d" fontSize="11">
            Sin elevación · arrastra para seleccionar
          </text>
        )}
      </svg>
      <label className="crop-slider">
        Inicio <output>{(distances[range.start] / 1000).toFixed(2)} km</output>
        <input
          aria-label="Inicio del recorte"
          type="range"
          min="0"
          max={Math.min(count - 2, range.end - 1)}
          value={range.start}
          onChange={(e) => onRange({ ...range, start: Number(e.target.value) })}
        />
      </label>
      <label className="crop-slider">
        Final <output>{(distances[range.end] / 1000).toFixed(2)} km</output>
        <input
          aria-label="Final del recorte"
          type="range"
          min={range.start + 1}
          max={count - 1}
          value={range.end}
          onChange={(e) => onRange({ ...range, end: Number(e.target.value) })}
        />
      </label>
    </>
  );
}
export function EditorTools({
  editing,
  onOpen,
  mode,
  onMode,
  elements,
  active,
  onActive,
  onNew,
  drawing,
  onFinish,
  onExit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  range,
  onRange,
  onCrop,
  onSaveSelection,
  onSaveSegment,
  onReverse,
  onCenter,
}) {
  const [minimized, setMinimized] = useState(false),
    [segmentName, setSegmentName] = useState("");
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
      if (e.key === "Escape") {
        onFinish();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, onUndo, onRedo, onFinish]);
  const element = elements.find((e) => e.id === active);
  const selection =
    element?.points.slice(
      range?.start ?? 0,
      (range?.end ?? element.points.length - 1) + 1,
    ) || [];
  const metrics = stats([selection]);
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
        {[
          ["view", "↔", "Mover mapa"],
          ["edit", "✎", "Editar trazado"],
          ["crop", "⌑", "Recortar trazado"],
          ["split", "✂", "Dividir trazado"],
        ].map(([value, icon, label]) => (
          <button
            key={value}
            className={mode === value ? "chosen" : ""}
            aria-label={label}
            title={label}
            aria-pressed={mode === value}
            onClick={() => {
              onMode(value);
              setMinimized(false);
            }}
          >
            {icon}
          </button>
        ))}
        <span className="tool-divider" />
        <button
          aria-label="↶ Deshacer"
          title="Deshacer (Ctrl/⌘ Z)"
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↶
        </button>
        <button
          aria-label="↷ Rehacer"
          title="Rehacer (Ctrl/⌘ Mayús Z)"
          onClick={onRedo}
          disabled={!canRedo}
        >
          ↷
        </button>
        <button
          aria-label="+ Dibujar"
          title="Nuevo trazado"
          onClick={() => {
            onNew();
            setMinimized(false);
          }}
        >
          ＋
        </button>
        <button
          aria-label="Salir del editor"
          title="Salir del editor"
          onClick={onExit}
        >
          ×
        </button>
      </div>
      {!minimized ? (
        <section className="editor-options" aria-label="Opciones del editor">
          <div className="editor-title">
            <strong>
              {mode === "crop"
                ? "Recortar y crear segmento"
                : mode === "split"
                  ? "Dividir trazado"
                  : mode === "view"
                    ? "Mover mapa"
                    : "Dibujar y editar"}
            </strong>
            <button
              aria-label="Minimizar herramientas"
              title="Minimizar herramientas"
              onClick={() => setMinimized(true)}
            >
              −
            </button>
          </div>
          {elements.length > 0 && (
            <select
              aria-label="Trazado activo"
              value={active || ""}
              onChange={(e) => {
                onActive(e.target.value);
                setSegmentName("");
              }}
            >
              {!element && <option value="">Elige un trazado</option>}
              {elements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
          {mode === "view" && (
            <p>
              Arrastra el mapa sin modificar el trazado. Pulsa el lápiz para
              volver a editar.
            </p>
          )}
          {mode === "edit" && (
            <>
              <p>
                Arrastra los puntos blancos para modificar el trazado. Arrastra
                los puntos «+» para insertar uno. Pulsa un punto para ver sus
                acciones.
              </p>
              <p className="editor-note">
                Pulsa el mapa para prolongar el trazado. Líneas rectas, sin
                ajuste automático a caminos.
              </p>
              <div className="editor-actions">
                <button onClick={onCenter} disabled={!element?.points.length}>
                  Centrar trazado
                </button>
                <button onClick={onReverse} disabled={!element?.points.length}>
                  Invertir trazado
                </button>
                <button
                  onClick={onSaveSegment}
                  disabled={(element?.points.length || 0) < 2}
                >
                  Guardar segmento
                </button>
                {drawing && (
                  <button className="primary" onClick={onFinish}>
                    Terminar dibujo
                  </button>
                )}
              </div>
            </>
          )}
          {mode === "split" && (
            <p>
              Pulsa en el lugar del trazado donde quieras cortarlo. Las tijeras
              señalan la posición. Se conservarán las dos partes y podrás
              deshacer.
            </p>
          )}
          {mode === "crop" &&
            (element?.points.length > 1 ? (
              <>
                <p>
                  Selecciona en el perfil o ajusta Inicio y Final. Vista previa,
                  sin modificar el trazado.
                </p>
                <CropProfile
                  points={element.points}
                  range={range}
                  onRange={onRange}
                />
                <div className="crop-metrics">
                  {metrics.km.toFixed(2)} km · ↗ {metrics.ascent} m
                  {metrics.missing ? " · elevación parcial" : ""}
                </div>
                <input
                  aria-label="Nombre del nuevo segmento"
                  placeholder={`${element.name} · segmento`}
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
                <div className="editor-actions">
                  <button
                    className="primary"
                    onClick={() =>
                      onSaveSelection(
                        segmentName.trim() || `${element.name} · segmento`,
                      )
                    }
                  >
                    Guardar selección como segmento
                  </button>
                  <button onClick={onCrop}>Aplicar recorte al borrador</button>
                  <button onClick={() => onMode("edit")}>
                    Cancelar recorte
                  </button>
                </div>
              </>
            ) : (
              <p>Elige un trazado con al menos dos puntos para recortarlo.</p>
            ))}
        </section>
      ) : (
        <button
          className="expand-editor"
          aria-label="Mostrar herramientas"
          onClick={() => setMinimized(false)}
        >
          Opciones ›
        </button>
      )}
    </div>
  );
}
