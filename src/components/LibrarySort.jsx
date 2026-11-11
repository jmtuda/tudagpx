import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { libraryOrders } from "../utils/libraryOrder";

export function LibrarySort({ category, value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const menu = useRef(null);
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = button.current.getBoundingClientRect();
      const box = menu.current.getBoundingClientRect();
      setPosition({
        left: Math.max(12, Math.min(anchor.right - box.width, window.innerWidth - box.width - 12)),
        top: anchor.bottom + 8 + box.height <= window.innerHeight - 12
          ? anchor.bottom + 8 : Math.max(12, anchor.top - box.height - 8),
        maxHeight: window.innerHeight - 24,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div className="library-sort" ref={root} onKeyDown={(event) => {
    if (event.key === "Escape") { setOpen(false); button.current.focus(); }
  }}>
    <button ref={button} className="library-sort-toggle" aria-label={`Ordenar ${category}`} title={`Ordenar ${category}`} aria-expanded={open} aria-controls="library-sort-options" onClick={() => setOpen(!open)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 4v16m-4-4 4 4 4-4M13 5h8m-8 5h6m-6 5h4" /></svg>
    </button>
    {open && <fieldset ref={menu} id="library-sort-options" className="library-sort-options" style={position || { visibility: "hidden" }}><legend>Ordenar {category}</legend>
      {libraryOrders.map(([key, label]) => <label key={key}><input type="radio" name="library-order" value={key} checked={value === key} onChange={() => { onChange(key); setOpen(false); button.current.focus(); }} />{label}</label>)}
    </fieldset>}
  </div>;
}
