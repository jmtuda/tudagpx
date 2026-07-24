import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { SubirRuta } from './components/SubirRuta';
import { ListaRutas } from './components/ListaRutas';
import { Login } from './components/Login';
import './index.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [pestanaActiva, setPestanaActiva] = useState('explorar'); // 'explorar' o 'subir'

  useEffect(() => {
    // Comprobar la sesión activa al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargandoSesion(false);
    });

    // Escuchar cambios de inicio y cierre de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (cargandoSesion) {
    return <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Cargando aplicación...</div>;
  }

  // Si no hay sesión iniciada, mostramos únicamente el componente de Login
  if (!session) {
    return <Login />;
  }

  // Si hay sesión, mostramos la interfaz protegida con el nuevo diseño unificado
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Cabecera superior moderna */}
      <header style={{
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border)',
        padding: '15px 30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>🚴‍♂️</span>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Mis Rutas GPX</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px' }}>
            👤 {session.user.email}
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: '6px 14px',
              background: '#fee2e2',
              color: '#dc2626',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Botones de Pestañas de Navegación */}
      <nav style={{ maxWidth: '1100px', width: '100%', margin: '20px auto 0 auto', padding: '0 20px', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setPestanaActiva('explorar')}
          style={{
            padding: '10px 20px',
            background: pestanaActiva === 'explorar' ? 'var(--primary)' : 'white',
            color: pestanaActiva === 'explorar' ? 'white' : 'var(--text-main)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontWeight: '600',
            boxShadow: 'var(--shadow)',
            transition: 'background 0.2s'
          }}
        >
          🗺️ Explorar Rutas
        </button>

        <button
          onClick={() => setPestanaActiva('subir')}
          style={{
            padding: '10px 20px',
            background: pestanaActiva === 'subir' ? 'var(--primary)' : 'white',
            color: pestanaActiva === 'subir' ? 'white' : 'var(--text-main)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontWeight: '600',
            boxShadow: 'var(--shadow)',
            transition: 'background 0.2s'
          }}
        >
          ➕ Subir Nueva Ruta
        </button>
      </nav>

      {/* Contenido según la pestaña activa */}
      <main style={{ flex: 1, paddingBottom: '40px' }}>
        {pestanaActiva === 'subir' ? <SubirRuta /> : <ListaRutas />}
      </main>

    </div>
  );
}