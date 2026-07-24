import { useState } from 'react';
import { supabase } from '../supabaseClient';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [esRegistro, setEsRegistro] = useState(false); // Para alternar entre Iniciar Sesión y Registrarse
  const [mensaje, setMensaje] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);

    if (esRegistro) {
      // Registro de nuevo usuario
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMensaje(error.message);
      } else {
        alert('¡Registro exitoso! Revisa tu correo si se requiere confirmación, o ya puedes iniciar sesión.');
      }
    } else {
      // Inicio de sesión
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMensaje('Correo o contraseña incorrectos.');
      }
    }
    setCargando(false);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '80px auto', padding: '30px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        {esRegistro ? '📝 Registro de Usuario' : '🔐 Iniciar Sesión'}
      </h2>

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ fontSize: '13px', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Correo electrónico:</label>
          <input
            type="email"
            placeholder="tu_correo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contraseña:</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        {mensaje && <p style={{ color: 'red', fontSize: '13px', margin: '0' }}>{mensaje}</p>}

        <button
          type="submit"
          disabled={cargando}
          style={{
            padding: '10px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {cargando ? 'Procesando...' : esRegistro ? 'Registrarse' : 'Entrar'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
        {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta todavía?'} {' '}
        <span
          onClick={() => setEsRegistro(!esRegistro)}
          style={{ color: '#0070f3', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {esRegistro ? 'Inicia sesión aquí' : 'Regístrate aquí'}
        </span>
      </p>
    </div>
  );
}