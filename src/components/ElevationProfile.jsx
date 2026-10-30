import { useEffect, useMemo, useRef, useState } from "react";
import { distance } from "../utils/workspace";
import { editorRouteKey } from "../utils/editorRoutes";

// No distance is added between tracks. Missing elevations break the SVG path;
// neither zeroes nor interpolated heights are substituted for absent GPX data.
function buildElevationProfile(elements) {
  let meters = 0;
  let known = 0;
  const samples = [];
  const runs = [];
  for (const element of elements) {
    let run = [];
    for (let i = 0; i < element.points.length; i++) {
      const point = element.points[i];
      if (i) meters += distance(element.points[i - 1], point);
      const sample = { point, meters, elementId: element.id, index: i };
      samples.push(sample);
      if (Number.isFinite(point.ele)) {
        known++;
        run.push(sample);
      } else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
  }
  const heights = samples.filter((s) => Number.isFinite(s.point.ele)).map((s) => s.point.ele);
  let min = Infinity, max = -Infinity;
  for (const height of heights) {
    min = Math.min(min, height);
    max = Math.max(max, height);
  }
  return { samples, runs, meters, known, min, max };
}

const km = (meters) => (meters / 1000).toLocaleString("es", { maximumFractionDigits: 2 });

export function ElevationProfile({ elements, active, minimized, onToggle, onHover }) {
  const activeElement = elements.find((element) => element.id === active);
  const routeId = activeElement && editorRouteKey(activeElement);
  const tracks = useMemo(() => elements.filter((element) => editorRouteKey(element) === routeId), [elements, routeId]);
  const profile = useMemo(() => buildElevationProfile(tracks), [tracks]);
  const [cursor, setCursor] = useState(null);
  const container = useRef(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const chartWidth = width - 80;
  // A sample reference is valid only while its geometry is unchanged.
  const selected = profile.samples.includes(cursor) ? cursor : null;
  const name = activeElement?.editorRouteName || activeElement?.name || "Sin archivo activo";
  const x = (sample) => 58 + sample.meters / (profile.meters || 1) * chartWidth;
  const pad = Math.max(5, (profile.max - profile.min) * 0.08);
  const low = profile.known ? profile.min - pad : 0;
  const high = profile.known ? profile.max + pad : 1;
  const y = (sample) => 100 - (sample.point.ele - low) / (high - low) * 82;
  function inspect(sample) {
    setCursor(sample);
    onHover(sample?.point || null);
  }
  function inspectPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const target = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * width - 58) / chartWidth)) * profile.meters;
    let nearest = null;
    for (const sample of profile.samples) {
      if (!nearest || Math.abs(sample.meters - target) < Math.abs(nearest.meters - target)) nearest = sample;
    }
    inspect(nearest);
  }
  return (
    <section ref={container} className={`elevation-profile${minimized ? " is-minimized" : ""}`} aria-label="Perfil de altitud">
      <header>
        <button type="button" aria-expanded={!minimized} aria-controls="editor-elevation-chart" onClick={() => { inspect(null); onToggle(); }}>
          <span aria-hidden="true">{minimized ? "▴" : "▾"}</span> {minimized ? "Mostrar" : "Minimizar"} perfil de altitud
        </button>
        <span className="elevation-file" title={name}>{name}</span>
        <output className="elevation-reading" aria-live="polite">
          {selected ? `${km(selected.meters)} km · ${Number.isFinite(selected.point.ele) ? `${Math.round(selected.point.ele)} m` : "Sin altitud"}` : `${km(profile.meters)} km`}
        </output>
      </header>
      <div id="editor-elevation-chart" hidden={minimized}>
        {profile.samples.length ? (
          <>
            <svg viewBox={`0 0 ${width} 128`} preserveAspectRatio="none" role="slider" tabIndex={0}
              aria-label="Explorar perfil de altitud" aria-valuemin={0} aria-valuemax={Math.max(0, profile.samples.length - 1)}
              aria-valuenow={Math.max(0, profile.samples.indexOf(selected))}
              aria-valuetext={selected ? `${km(selected.meters)} kilómetros, ${Number.isFinite(selected.point.ele) ? `${Math.round(selected.point.ele)} metros` : "sin altitud"}` : "Usa las flechas para recorrer los puntos"}
              onPointerMove={inspectPointer} onPointerDown={inspectPointer} onPointerLeave={() => inspect(null)} onBlur={() => inspect(null)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const current = Math.max(0, profile.samples.indexOf(selected));
                const index = event.key === "Home" ? 0 : event.key === "End" ? profile.samples.length - 1 : Math.max(0, Math.min(profile.samples.length - 1, current + (event.key === "ArrowRight" ? 1 : -1)));
                inspect(profile.samples[index]);
              }}>
              {[0, 0.5, 1].map((fraction) => <g key={fraction} className="elevation-axis">
                <line x1="58" x2={width - 22} y1={100 - fraction * 82} y2={100 - fraction * 82} />
                <text x="50" y={104 - fraction * 82} textAnchor="end">{profile.known ? `${Math.round(low + fraction * (high - low))} m` : "— m"}</text>
                <text x={58 + fraction * chartWidth} y="122" textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>{km(profile.meters * fraction)} km</text>
              </g>)}
              {profile.runs.map((run, index) => <g key={index} className="elevation-run">
                <path d={run.map((sample, i) => `${i ? "L" : "M"}${x(sample)},${y(sample)}`).join(" ")} />
                {run.length === 1 && <circle cx={x(run[0])} cy={y(run[0])} r="2.5" />}
              </g>)}
              {selected && <g className="elevation-cursor"><line x1={x(selected)} x2={x(selected)} y1="18" y2="100" />{Number.isFinite(selected.point.ele) && <circle cx={x(selected)} cy={y(selected)} r="4" />}</g>}
            </svg>
            {profile.known < profile.samples.length && <span className="elevation-note">{profile.known ? "Altitud parcial: los huecos no se interpolan." : "Sin datos de altitud en este archivo."}</span>}
          </>
        ) : <p className="elevation-note">Abre una copia para ver su perfil de altitud.</p>}
      </div>
    </section>
  );
}
