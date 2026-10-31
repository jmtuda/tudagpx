const paths = {
  route: (
    <>
      <path d="M5 17V5h14v14H9" />
      <path d="M8 3v6h8V3M9 21v-8h8v8" />
    </>
  ),
  segment: (
    <>
      <path d="M5 3h12l4 4v14H3V3h2M7 3v6h10V3" />
      <path d="M7 17h10" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6" />
      <path d="M4 5h3m10 0h3" />
    </>
  ),
  clear: (
    <>
      <path d="m14 3 7 7-10 11H6l-5-5L14 3ZM7 10l8 8M11 21h11" />
    </>
  ),
  library: <path d="M3 20V5h7l2 3h9v12H3Zm0-9h18" />,
  edit: (
    <>
      <path d="m4 16-1 5 5-1L21 7l-4-4L4 16ZM14 6l4 4" />
    </>
  ),
  crop: (
    <>
      <path d="M6 3v15h15M3 6h15v15" />
      <path d="m15 9 6-6" />
    </>
  ),
  split: (
    <>
      <circle cx="5" cy="6" r="3" />
      <circle cx="5" cy="18" r="3" />
      <path d="m8 8 13 13M8 16 21 3" />
    </>
  ),
  merge: (
    <>
      <path d="M4 3v5c0 4 8 4 8 8v5M20 3v5c0 4-8 4-8 8M8 17l4 4 4-4" />
    </>
  ),
  reverse: (
    <>
      <path d="M3 7h17l-4-4M21 17H4l4 4M20 7l-4 4M4 17l4-4" />
    </>
  ),
  center: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v5m0 10v5M2 12h5m10 0h5" />
    </>
  ),
  undo: <path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v4" />,
  redo: <path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 7v4" />,
  plus: <path d="M12 4v16M4 12h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7v1" />
    </>
  ),
};

export default function ToolIcon({ name }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
