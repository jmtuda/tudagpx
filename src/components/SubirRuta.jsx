import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { parsearGPX } from '../utils/gpxParser';
import { MapaPrevisualizacion } from './MapaPrevisualizacion';

function limpiarNombreArchivo(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s()]+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');
}

export function SubirRuta() {
  const [cargando, setCargando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  
  const [nombreRuta, setNombreRuta] = useState('');
  const [esDelClub, setEsDelClub] = useState(false);
  const [actividad, setActividad] = useState('MTB');
  const [datosCalculados, setDatosCalculados] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setArchivo(file);
    setNombreRuta(file.name.replace('.gpx', ''));
    setCargando(true);

    try {
      const res = await parsearGPX(file);
      setDatosCalculados(res);
    } catch (error) {
      alert('Error al leer el archivo GPX: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!archivo || !datosCalculados) return alert('Por favor, selecciona un archivo GPX válido');

    setCargando(true);

    try {
      const nombreLimpio = limpiarNombreArchivo(archivo.name);
      const nombreUnico = `${Date.now()}_${nombreLimpio}`;

      const { error: uploadError } = await supabase.storage
        .from('rutas-gpx')
        .upload(nombreUnico, archivo);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('rutas-gpx')
        .getPublicUrl(nombreUnico);

      const { error: dbError } = await supabase.from('rutas').insert([
        {
          nombre: nombreRuta || archivo.name,
          del_club: esDelClub,
          actividad,
          distancia_km: datosCalculados.distanciaKm,
          desnivel_m: datosCalculados.desnivelM,
          localidad_salida: datosCalculados.localidadSalida,
          puntos: datosCalculados.puntos,
          archivo_url: urlData.publicUrl,
        },
      ]);

      if (dbError) throw dbError;

      alert(`¡Ruta "${nombreRuta}" guardada correctamente!`);
      
      setArchivo(null);
      setNombreRuta('');
      setEsDelClub(false);
      setActividad('MTB');
      setDatosCalculados(null);
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={handleUpload} style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
      <h3>Subir Nueva Ruta GPX</h3>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>1. Archivo GPX:</label>
        <input type="file" accept=".gpx" onChange={handleFileChange} disabled={cargando} />
      </div>

      {cargando && !datosCalculados && <p>🔍 Analizando archivo GPX y calculando datos...</p>}

      {datosCalculados && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          {/* Columna Izquierda: Datos y Formulario */}
          <div style={{ flex: '1', minWidth: '280px' }}>
            <div style={{ padding: '10px', background: '#eef6ff', borderRadius: '6px', marginBottom: '15px', fontSize: '14px' }}>
              <strong>📊 Datos detectados:</strong>
              <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                <li><strong>Distancia:</strong> {datosCalculados.distanciaKm} km</li>
                <li><strong>Desnivel:</strong> {datosCalculados.desnivelM} m</li>
                <li><strong>Salida:</strong> {datosCalculados.localidadSalida}</li>
              </ul>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nombre de la ruta:</label>
              <input
                type="text"
                value={nombreRuta}
                onChange={(e) => setNombreRuta(e.target.value)}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                disabled={cargando}
                required
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Actividad:</label>
              <select
                value={actividad}
                onChange={(e) => setActividad(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
                disabled={cargando}
              >
                <option value="MTB">MTB 🚵</option>
                <option value="Gravel">Gravel 🚲</option>
                <option value="Carretera">Carretera 🚴‍♂️</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={esDelClub}
                  onChange={(e) => setEsDelClub(e.target.checked)}
                  disabled={cargando}
                  style={{ marginRight: '8px' }}
                />
                ¿Es una ruta del Club? (S/N)
              </label>
            </div>

            <button
              type="submit"
              disabled={cargando}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              {cargando ? 'Guardando...' : 'Guardar Ruta'}
            </button>
          </div>

          {/* Columna Derecha: Mapa de Previsualización */}
          <div style={{ flex: '1', minWidth: '280px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Previsualización del trazado:</label>
            <MapaPrevisualizacion puntos={datosCalculados.puntos} />
          </div>

        </div>
      )}
    </form>
  );
}