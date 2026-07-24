import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { MapaRutas } from './MapaRutas';

export function ListaRutas() {
  const [rutas, setRutas] = useState([]);
  const [idsSeleccionados, setIdsSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados para los filtros
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('TODAS');
  const [filtroActividad, setFiltroActividad] = useState('TODAS');
  const [filtroClub, setFiltroClub] = useState('TODOS'); // 'TODOS', 'SI', 'NO'

  useEffect(() => {
    async function cargarRutas() {
      const { data, error } = await supabase
        .from('rutas')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        console.error('Error cargando rutas:', error);
      } else {
        setRutas(data || []);
        if (data && data.length > 0) {
          setIdsSeleccionados([data[0].id]);
        }
      }
      setCargando(false);
    }

    cargarRutas();
  }, []);

  const handleToggleSeleccion = (id) => {
    if (idsSeleccionados.includes(id)) {
      setIdsSeleccionados(idsSeleccionados.filter(item => item !== id));
    } else {
      setIdsSeleccionados([...idsSeleccionados, id]);
    }
  };

  // Filtrado de rutas según los inputs y selects
  const rutasFiltradas = rutas.filter((ruta) => {
    const coincideNombre = ruta.nombre?.toLowerCase().includes(filtroNombre.toLowerCase());
    const coincideLocalidad = filtroLocalidad === 'TODAS' || ruta.localidad_salida === filtroLocalidad;
    const coincideActividad = filtroActividad === 'TODAS' || ruta.actividad === filtroActividad;
    
    let coincideClub = true;
    if (filtroClub === 'SI') coincideClub = ruta.del_club === true;
    if (filtroClub === 'NO') coincideClub = !ruta.del_club;

    return coincideNombre && coincideLocalidad && coincideActividad && coincideClub;
  });

  // Seleccionar/Deseleccionar basándose en las rutas actualmente visibles (filtradas)
  const seleccionarTodasVisibles = () => {
    const idsVisibles = rutasFiltradas.map(r => r.id);
    const nuevosIds = Array.from(new Set([...idsSeleccionados, ...idsVisibles]));
    setIdsSeleccionados(nuevosIds);
  };

  const deseleccionarTodasVisibles = () => {
    const idsVisibles = new Set(rutasFiltradas.map(r => r.id));
    setIdsSeleccionados(idsSeleccionados.filter(id => !idsVisibles.has(id)));
  };

  // Obtener listas únicas para los desplegables de filtros
  const actividadesUnicas = ['TODAS', ...new Set(rutas.map(r => r.actividad).filter(Boolean))];
  const localidadesUnicas = ['TODAS', ...new Set(rutas.map(r => r.localidad_salida).filter(Boolean))];

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>Cargando rutas de la base de datos...</div>;
  if (rutas.length === 0) return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>No hay ninguna ruta guardada todavía. ¡Sube alguna en la otra pestaña!</div>;

  const rutasSeleccionadasCompletas = rutas.filter(r => idsSeleccionados.includes(r.id));

  return (
    <div style={{ maxWidth: '1900px', margin: '30px auto', padding: '0 20px', display: 'flex', gap: '25px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      
      {/* Izquierda: Filtros y Listado de rutas */}
      <div style={{ flex: '1', minWidth: '340px' }}>
        
        {/* Panel de Filtros unificado con la clase card */}
        <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-main)' }}>🔍 Filtrar rutas</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: '600' }}>Nombre:</label>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: '600' }}>Localidad salida:</label>
              <select
                value={filtroLocalidad}
                onChange={(e) => setFiltroLocalidad(e.target.value)}
              >
                {localidadesUnicas.map((loc, index) => (
                  <option key={index} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: '600' }}>Actividad:</label>
              <select
                value={filtroActividad}
                onChange={(e) => setFiltroActividad(e.target.value)}
              >
                {actividadesUnicas.map((act, index) => (
                  <option key={index} value={act}>{act}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: '600' }}>Ruta del Club:</label>
              <select
                value={filtroClub}
                onChange={(e) => setFiltroClub(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                <option value="SI">Sí (Del Club)</option>
                <option value="NO">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cabecera del listado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>
            Rutas filtradas ({rutasFiltradas.length}) | <span style={{ fontSize: '13px', color: 'var(--primary)' }}>{idsSeleccionados.length} marcadas</span>
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={seleccionarTodasVisibles} className="btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>Marcar visibles</button>
            <button onClick={deseleccionarTodasVisibles} style={{ fontSize: '12px', padding: '6px 12px', background: '#f1f5f9', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '600' }}>Limpiar</button>
          </div>
        </div>

        {/* Lista con scroll y diseño unificado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
          {rutasFiltradas.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>No hay rutas que coincidan con los filtros seleccionados.</div>
          ) : (
            rutasFiltradas.map((ruta) => {
              const estaSeleccionada = idsSeleccionados.includes(ruta.id);

              return (
                <div
                  key={ruta.id}
                  onClick={() => handleToggleSeleccion(ruta.id)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    background: estaSeleccionada ? '#eff6ff' : 'var(--card-bg)',
                    borderColor: estaSeleccionada ? 'var(--primary)' : 'var(--border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    transition: 'border-color 0.2s, background 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={estaSeleccionada}
                    onChange={() => handleToggleSeleccion(ruta.id)}
                    style={{ marginTop: '4px', cursor: 'pointer', width: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text-main)' }}>{ruta.nombre}</h4>
                      
                      <a
                        href={`/?id=${ruta.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '11px', textDecoration: 'none' }}
                      >
                        Abrir
                      </a>
                    </div>

                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                      📍 {ruta.localidad_salida} • 🚴‍♂️ {ruta.actividad} • 📏 {ruta.distancia_km} km • ⛰️ {ruta.desnivel_m}m
                      {ruta.del_club && <span style={{ marginLeft: '8px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>Club</span>}
                    </p>
                    
                    <a
                      href={ruta.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}
                    >
                      📥 Descargar GPX
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Derecha: Mapa con la medida deseada */}
      <div className="card" style={{ flex: '3', minWidth: '340px', padding: '20px', height: '740px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: 'var(--text-main)' }}>🗺️ Mapa Comparativo</h3>
        
        {/* Este div contenedor debe forzar el 100% de alto y ancho */}
        <div style={{ flex: 1, width: '100%', height: 'calc(100% - 40px)', position: 'relative' }}>
          <MapaRutas rutasSeleccionadas={rutasSeleccionadasCompletas} />
        </div>
      </div>

    </div>
  );
}