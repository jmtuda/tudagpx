// Función para calcular la distancia entre dos coordenadas en km (Fórmula de Haversine)
function calcularDistanciaPuntos(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Función para obtener la localidad de salida a partir de la primera coordenada (Geocodificación Inversa)
async function obtenerLocalidad(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    );
    const data = await response.json();
    if (data && data.address) {
      // Priorizar ciudad, pueblo, municipio o villa
      return (
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.municipality ||
        data.address.county ||
        'Desconocida'
      );
    }
    return 'Desconocida';
  } catch (error) {
    console.error('Error al obtener la localidad:', error);
    return 'Desconocida';
  }
}

// Función principal para parsear el GPX
export async function parsearGPX(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');

  const trackPoints = xmlDoc.querySelectorAll('trkpt');
  const puntos = [];
  let distanciaTotal = 0;
  let desnivelPositivo = 0;

  trackPoints.forEach((pt, index) => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    
    // Obtener elevación si existe la etiqueta <ele>
    const eleNode = pt.querySelector('ele');
    const ele = eleNode ? parseFloat(eleNode.textContent) : null;

    puntos.push({ lat, lon, ele });

    // Calcular distancia y desnivel con respecto al punto anterior
    if (index > 0) {
      const prev = puntos[index - 1];
      distanciaTotal += calcularDistanciaPuntos(prev.lat, prev.lon, lat, lon);

      if (ele !== null && prev.ele !== null) {
        const difEle = ele - prev.ele;
        if (difEle > 0) {
          desnivelPositivo += difEle; // Solo sumamos cuando se asciende
        }
      }
    }
  });

  // Obtener la localidad usando el primer punto de la ruta
  let localidadSalida = 'Desconocida';
  if (puntos.length > 0) {
    localidadSalida = await obtenerLocalidad(puntos[0].lat, puntos[0].lon);
  }

  return {
    puntos: puntos.map(p => [p.lat, p.lon]), // Formato array [lat, lon] para Leaflet
    distanciaKm: parseFloat(distanciaTotal.toFixed(2)),
    desnivelM: Math.round(desnivelPositivo),
    localidadSalida,
  };
}