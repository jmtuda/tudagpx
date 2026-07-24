export function Contenedor({ children, titulo }) {
  return (
    <div style={{
      maxWidth: '1100px',
      margin: '30px auto',
      padding: '0 20px',
      fontFamily: 'inherit'
    }}>
      {titulo && <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-main)' }}>{titulo}</h2>}
      <div className="card">
        {children}
      </div>
    </div>
  );
}