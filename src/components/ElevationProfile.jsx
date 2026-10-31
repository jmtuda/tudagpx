import { useEffect, useMemo, useRef, useState } from "react";
import { distance } from "../utils/workspace";
import { editorRouteColors, editorRouteKey } from "../utils/editorRoutes";

// Distance and ascent never cross track boundaries or missing elevation samples.
function buildElevationProfile(elements) {
  let meters = 0,
    known = 0,
    ascent = 0,
    min = Infinity,
    max = -Infinity;
  const samples = [],
    runs = [];
  for (const element of elements) {
    let run = [];
    for (let i = 0; i < element.points.length; i++) {
      const point = element.points[i],
        previous = element.points[i - 1];
      if (previous) meters += distance(previous, point);
      const sample = { point, meters, elementId: element.id, index: i };
      samples.push(sample);
      if (Number.isFinite(point.ele)) {
        known++;
        min = Math.min(min, point.ele);
        max = Math.max(max, point.ele);
        if (Number.isFinite(previous?.ele))
          ascent += Math.max(0, point.ele - previous.ele);
        run.push(sample);
      } else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
  }
  return { samples, runs, meters, known, min, max, ascent };
}
const km = (meters) =>
  (meters / 1000).toLocaleString("es", { maximumFractionDigits: 2 });

export function ElevationProfile({
  elements = [],
  active,
  routes,
  minimized,
  onToggle,
  onHover,
  mode,
  crop,
  onRange,
}) {
  const activeElement = elements.find((element) => element.id === active);
  const routeId = activeElement && editorRouteKey(activeElement);
  const cropping =
    !routes &&
    mode === "crop" &&
    activeElement?.points.length > 1 &&
    crop &&
    onRange;
  const profiles = useMemo(() => {
    const colors = editorRouteColors(elements);
    const sources =
      routes ||
      (activeElement
        ? [
            {
              id: routeId,
              name: activeElement.editorRouteName || activeElement.name,
              color: colors.get(routeId),
              elements: cropping
                ? [
                    {
                      ...activeElement,
                      points: activeElement.points.slice(
                        crop.start,
                        crop.end + 1,
                      ),
                    },
                  ]
                : elements.filter(
                    (element) => editorRouteKey(element) === routeId,
                  ),
            },
          ]
        : []);
    return sources.map((source) => ({
      ...source,
      ...buildElevationProfile(source.elements),
    }));
  }, [routes, elements, activeElement, routeId, cropping, crop]);
  const fullProfile = useMemo(
    () => buildElevationProfile(activeElement ? [activeElement] : []),
    [activeElement],
  );
  const [cursor, setCursor] = useState(null);
  const container = useRef(null),
    dragStart = useRef(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const samples = profiles.flatMap((profile) => profile.samples);
  const selected = samples.includes(cursor?.sample) ? cursor : null;
  const chartWidth = width - 80;
  const total = Math.max(0, ...profiles.map((profile) => profile.meters));
  const known = profiles.reduce((sum, profile) => sum + profile.known, 0);
  const min = Math.min(...profiles.map((profile) => profile.min));
  const max = Math.max(...profiles.map((profile) => profile.max));
  const pad = known ? Math.max(5, (max - min) * 0.08) : 0;
  const low = known ? min - pad : 0,
    high = known ? max + pad : 1;
  const x = (sample) => 58 + (sample.meters / (total || 1)) * chartWidth;
  const y = (sample) => 100 - ((sample.point.ele - low) / (high - low)) * 82;
  function inspect(sample, profile) {
    setCursor(sample ? { sample, profile } : null);
    onHover?.(sample?.point || null, profile?.color);
  }
  function inspectPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const target =
      Math.max(
        0,
        Math.min(
          1,
          (((event.clientX - rect.left) / rect.width) * width - 58) /
            chartWidth,
        ),
      ) * total;
    const targetHeight =
      low +
      ((100 - ((event.clientY - rect.top) / rect.height) * 128) / 82) *
        (high - low);
    let nearest = null,
      owner = null,
      score = Infinity;
    for (const profile of profiles)
      for (const sample of profile.samples) {
        const next =
          Math.abs(sample.meters - target) / (total || 1) +
          (Number.isFinite(sample.point.ele)
            ? (Math.abs(sample.point.ele - targetHeight) / (high - low)) * 0.1
            : 0);
        if (next < score) {
          nearest = sample;
          owner = profile;
          score = next;
        }
      }
    inspect(nearest, owner);
  }
  function rangeIndex(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    let best = 0;
    fullProfile.samples.forEach((sample, index) => {
      const position = fullProfile.meters
        ? sample.meters / fullProfile.meters
        : index / (fullProfile.samples.length - 1);
      const current = fullProfile.meters
        ? fullProfile.samples[best].meters / fullProfile.meters
        : best / (fullProfile.samples.length - 1);
      if (Math.abs(position - fraction) < Math.abs(current - fraction))
        best = index;
    });
    return best;
  }
  function selectRange(event) {
    if (dragStart.current === null) return;
    const index = rangeIndex(event),
      last = fullProfile.samples.length - 1;
    const start = Math.min(dragStart.current, index, last - 1);
    onRange({
      start,
      end: Math.min(last, Math.max(dragStart.current, index, start + 1)),
    });
  }
  const rangeX = (index) =>
    fullProfile.meters
      ? (fullProfile.samples[index]?.meters / fullProfile.meters) * 100
      : (index / (fullProfile.samples.length - 1)) * 100;
  return (
    <section
      ref={container}
      className={`elevation-profile${minimized ? " is-minimized" : ""}${cropping ? " is-cropping" : ""}`}
      aria-label="Perfil de altitud"
    >
      <header>
        <button
          type="button"
          aria-label={`${minimized ? "Mostrar" : "Minimizar"} perfil de altitud`}
          aria-expanded={!minimized}
          aria-controls="workspace-elevation-chart"
          onClick={() => {
            inspect(null);
            onToggle();
          }}
        >
          <span aria-hidden="true">{minimized ? "⌃" : "⌄"}</span>
        </button>
        <output className="elevation-reading" aria-live="polite">
          {selected
            ? `${km(selected.sample.meters)} km · ${Number.isFinite(selected.sample.point.ele) ? `${Math.round(selected.sample.point.ele)} m` : "Sin altitud"}`
            : `${km(total)} km`}
        </output>
        <div className="elevation-metrics" aria-label="Métricas de las rutas">
          {profiles.map((profile) => (
            <span
              key={profile.id}
              className="elevation-route-metric"
              style={{ color: profile.color }}
              data-route-id={profile.id}
              data-distance={profile.meters}
              data-ascent={profile.ascent}
              title={profile.name}
            >
              <strong>{profile.name}</strong>{" "}
              <span>
                {km(profile.meters)} km · ↑ {Math.round(profile.ascent)} m
              </span>
            </span>
          ))}
        </div>
      </header>
      <div id="workspace-elevation-chart" hidden={minimized}>
        {samples.length ? (
          <>
            <svg
              viewBox={`0 0 ${width} 128`}
              preserveAspectRatio="none"
              role="slider"
              tabIndex={0}
              aria-label="Explorar perfil de altitud"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, samples.length - 1)}
              aria-valuenow={Math.max(0, samples.indexOf(selected?.sample))}
              aria-valuetext={
                selected
                  ? `${selected.profile.name}, ${km(selected.sample.meters)} kilómetros, ${Number.isFinite(selected.sample.point.ele) ? `${Math.round(selected.sample.point.ele)} metros` : "sin altitud"}`
                  : "Usa las flechas para recorrer los puntos"
              }
              onPointerMove={inspectPointer}
              onPointerDown={inspectPointer}
              onPointerLeave={() => inspect(null)}
              onBlur={() => inspect(null)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const current = Math.max(0, samples.indexOf(selected?.sample));
                const index =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? samples.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            samples.length - 1,
                            current + (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        );
                inspect(
                  samples[index],
                  profiles.find((profile) =>
                    profile.samples.includes(samples[index]),
                  ),
                );
              }}
            >
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction} className="elevation-axis">
                  <line
                    x1="58"
                    x2={width - 22}
                    y1={100 - fraction * 82}
                    y2={100 - fraction * 82}
                  />
                  <text x="50" y={104 - fraction * 82} textAnchor="end">
                    {known
                      ? `${Math.round(low + fraction * (high - low))} m`
                      : "— m"}
                  </text>
                  <text
                    x={58 + fraction * chartWidth}
                    y="122"
                    textAnchor={
                      fraction === 0
                        ? "start"
                        : fraction === 1
                          ? "end"
                          : "middle"
                    }
                  >
                    {km(total * fraction)} km
                  </text>
                </g>
              ))}
              {profiles.map((profile) => (
                <g
                  key={profile.id}
                  data-route-id={profile.id}
                  style={{ "--profile-color": profile.color }}
                >
                  {profile.runs.map((run, index) => (
                    <g key={index} className="elevation-run">
                      <path
                        d={run
                          .map(
                            (sample, i) =>
                              `${i ? "L" : "M"}${x(sample)},${y(sample)}`,
                          )
                          .join(" ")}
                      />
                      {run.length === 1 && (
                        <circle cx={x(run[0])} cy={y(run[0])} r="2.5" />
                      )}
                    </g>
                  ))}
                </g>
              ))}
              {selected && (
                <g className="elevation-cursor">
                  <line
                    x1={x(selected.sample)}
                    x2={x(selected.sample)}
                    y1="18"
                    y2="100"
                  />
                  {Number.isFinite(selected.sample.point.ele) && (
                    <circle
                      cx={x(selected.sample)}
                      cy={y(selected.sample)}
                      r="4"
                    />
                  )}
                </g>
              )}
            </svg>
            {known < samples.length && (
              <span className="elevation-note">
                {known
                  ? "Altitud parcial: los huecos no se interpolan."
                  : "Sin datos de altitud en este archivo."}
              </span>
            )}
          </>
        ) : (
          <p className="elevation-note">
            {routes
              ? "Selecciona rutas para comparar sus perfiles."
              : "Abre una copia para ver su perfil de altitud."}
          </p>
        )}
        {cropping && (
          <div className="elevation-crop-controls">
            <svg
              className="elevation-range-selection"
              viewBox="0 0 100 18"
              preserveAspectRatio="none"
              role="img"
              aria-label="Perfil para seleccionar el recorte; arrastra sobre él"
              onPointerDown={(event) => {
                event.preventDefault();
                dragStart.current = rangeIndex(event);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={selectRange}
              onPointerUp={(event) => {
                selectRange(event);
                dragStart.current = null;
              }}
              onPointerCancel={() => {
                dragStart.current = null;
              }}
            >
              <rect width="100" height="18" fill="#dce6e3" />
              <rect
                x={rangeX(crop.start)}
                width={rangeX(crop.end) - rangeX(crop.start)}
                height="18"
                fill={profiles[0]?.color}
              />
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
