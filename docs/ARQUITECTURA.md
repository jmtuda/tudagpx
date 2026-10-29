# Arquitectura de la primera versión local

## Reutilización

Se mantienen React, Vite, Leaflet y react-leaflet. MapaBase.jsx conserva los cuatro servicios de teselas originales y las atribuciones. Se han corregido el selector accesible, una propiedad de estilo y el sobrezoom.

La implementación anterior de Supabase sigue en src/App.jsx, src/components y src/utils/gpxParser.js, recuperable también en main. No se ejecuta desde main.jsx: evita cuentas, llamadas al backend anterior y cambios sobre datos existentes. No se han consultado credenciales ni conectado servicios de producción.

## Aplicación local

- LocalApp.jsx: biblioteca, selección, historial del borrador, importación, comparación básica, proyectos y revisión.
- components/WorkspaceMap.jsx: capas de rutas/segmentos/borrador, límites de vista, selección y arrastre de punto activo.
- utils/workspace.js: geometría, métricas, parser GPX, serialización GPX, revisión y validación de copias.
- utils/localStore.js: IndexedDB y descargas.
- workspace.css: interfaz adaptativa. index.css conserva estilos anteriores.

## Datos e invariantes

Una base IndexedDB, tudagpx-local-v1, almacena un documento schema=1 mediante transacciones atómicas. Contiene rutas con trazados separados, segmentos, borrador, nombre y snapshots de proyectos. El guardado de revisiones se encola para evitar escrituras fuera de orden. La interfaz muestra fallos; si la lectura o validación inicial falla, no reemplaza los datos por demostraciones.

Cada ruta importada conserva el XML original como texto, nombre del archivo y fecha. Los puntos usados por biblioteca y editor se copian: no se comparten como objetos mutables. Los puntos sin elevación usan null, no cero. Los tracks y rutas GPX mantienen sus límites; las métricas no suman saltos entre tramos. No se hacen llamadas de geocodificación ni se envían GPX a servidores.

Guardar versión añade un snapshot independiente, incluso incompleto. Abrir un proyecto conserva el borrador anterior en otro snapshot. Importar una copia añade sus contenidos con identificadores nuevos; no reemplaza el trabajo existente. Descargar copia completa incluye los GPX originales. No hay operaciones de borrado de originales ni de versiones en esta entrega.

## Geografía y edición

La biblioteca encuentra líneas que cruzan el rectángulo visible incluso si no hay vértices dentro. La selección queda fuera del filtro de vista. Las referencias disponibles se dibujan grises; seleccionadas, de colores; borrador naranja discontinuo. Ocultar es independiente de seleccionar.

El editor no exige continuidad. Dibujar genera rectas libres, sin servicio de enrutamiento. Mover un punto elimina su elevación anterior: no se inventa una nueva. No hay snapping, interpolación automática ni datos de elevación externos.

## Revisión y exportación

Las comprobaciones detectan borrador vacío, tramos con menos de dos puntos, coordenadas inválidas, huecos mayores de 30 m entre elementos, elevación ausente y aristas iguales a seis decimales, también invertidas. Los avisos geográficos se marcan en el mapa. Las advertencias requieren aceptación; los errores bloquean exportación. Se serializa GPX 1.1 con escape XML y un trkseg por elemento; se vuelve a parsear antes de descargar. Nunca se trazan conectores automáticamente.

No es todavía un validador exhaustivo: solapamientos parciales, saltos dentro de un tramo y sentido/orden incorrectos requieren revisión visual. El perfil comparativo inicial se presenta por ruta y usa los puntos como eje horizontal, no distancia acumulada.

## Privacidad y límites

Solo se reciben mapas desde IGN/OSM, que conocen las teselas solicitadas como en cualquier mapa web. El servidor escucha exclusivamente en loopback, sin publicación. Los datos de biblioteca están en el perfil del navegador y origen http://127.0.0.1:5173; localhost o un puerto distinto tienen otro almacenamiento. Internet es necesario para cartografía, no para editar GPX.

La importación admite varios archivos de hasta 25 MB cada uno; no se ha optimizado aún el rendimiento de trazados enormes. No hay autenticación porque es un usuario local. No debe publicarse esta modalidad como aplicación multiusuario.

## Evolución sin migración prematura

El modelo está separado del proveedor de almacenamiento. La siguiente persistencia será una API privada y PostgreSQL/PostGIS con geometría indexada, migraciones versionadas y originales inmutables. Neon se conectará únicamente desde servidor con secretos privados y autorización del propietario. Vercel es el destino futuro, no se ha desplegado nada. No se ha instalado Docker ni desplegado una base innecesaria para esta primera prueba visual.

El versionado avanzado deberá registrar identidades estables, revisiones y referencias explícitas ruta–versión de segmento; avisar dependencias y adaptar selectivamente creando nuevas versiones. Los snapshots actuales son conservación local, no sustituyen ese sistema completo.
