# TudaGPX

Biblioteca geográfica y editor libre de rutas de bicicleta. Primera versión local con React, Vite y Leaflet. Sin cuenta, sin suscripciones y sin servicios de producción conectados.

## Abrir la aplicación

En este Mac, abre http://127.0.0.1:5173 en tu navegador habitual.

Si el servidor está detenido, haz doble clic en `Abrir TudaGPX.command`, dentro de esta carpeta. Se abrirán una ventana de Terminal y el navegador. Mantén esa ventana abierta mientras trabajas. No necesitas escribir comandos.

Usa siempre la misma dirección y navegador: los datos se guardan ahí, no se sincronizan entre navegadores. No uses una ventana privada para conservar trabajo. Los mapas necesitan internet.

## Primera prueba

1. En Segmentos, marca dos trazados de demostración. Son sintéticos y no deben seguirse en campo.
2. Cambia el mapa con el selector superior derecho: IGN Base, MTN, PNOA y OpenStreetMap.
3. Mueve el mapa. La lista busca segmentos geográficamente y conserva los seleccionados fuera de la vista.
4. Pulsa «Añadir seleccionados al borrador». Trabajas sobre copias, no sobre originales.
5. En Borrador, elige un tramo o pulsa su línea naranja, selecciona un punto y arrástralo. También puedes invertir, dividir, recortar, quitar puntos, duplicar o reordenar. Deshacer/rehacer permite volver atrás.
6. «Dibujar» añade un trazado libre: pulsa varias veces sobre el mapa y después «Terminar dibujo». No se ajusta automáticamente a carreteras.
7. «Guardar versión» conserva una copia independiente del proyecto, aunque esté incompleto. El borrador se guarda además automáticamente.
8. «Revisar y exportar» muestra avisos en el mapa. Los errores impiden descargar; las advertencias pueden aceptarse. Se exporta un tramo GPX por elemento, sin inventar conexiones.

Para tus propios datos, pulsa «Importar GPX». Puedes seleccionar varios archivos. El selector «Importar como» permite incorporarlos a Rutas o directamente a Segmentos, conservando también el GPX original. Desde Rutas puedes crear segmentos y superponer varios recorridos con sus métricas y perfiles iniciales. El botón «Original GPX» descarga el archivo importado sin modificaciones.

## Proteger el trabajo

En Proyectos, «Descargar copia completa» guarda biblioteca, originales, borrador y versiones en un JSON. Hazlo periódicamente y antes de borrar datos del navegador. «Añadir copia de seguridad» recupera esa información sin borrar los datos actuales. Su borrador aparece como un proyecto más.

Abrir una versión conserva el borrador que tenías en otro snapshot. Los datos originales no se borran automáticamente. El sistema avanzado de versiones y dependencias entre rutas y segmentos sigue pendiente.

## Límites de esta entrega

- Almacenamiento local provisional; todavía no hay PostgreSQL/PostGIS ni sincronización.
- Edición básica funcional, no el editor completo de gpx.studio: faltan unión avanzada, inserción cómoda, variantes y más herramientas.
- Revisión básica: coordenadas, huecos entre elementos, elevación y aristas idénticas. No detecta todos los solapamientos ni garantiza el sentido correcto.
- Comparación inicial por superposición, cifras y perfiles individuales; eje horizontal del perfil por puntos, todavía no por distancia.
- No se calculan rutas por carreteras ni elevaciones nuevas. Mover un punto deja su elevación sin dato.
- Importación de hasta 25 MB por archivo; grandes bibliotecas y trazados masivos aún sin optimizar.
- No se ha publicado nada ni se ha conectado el Supabase anterior.

## Desarrollo y verificación

Con Node.js compatible con Vite 8 (por ejemplo Node 22.12 o superior):

- `npm ci`: instalar dependencias del lockfile.
- `npm start`: servidor local estable y apertura del navegador.
- `npm run lint`: comprobaciones estáticas.
- `npm run build`: compilación de producción.
- `npm test`: pruebas reales de Chrome con Playwright. Usan Chrome instalado (`channel: chrome`); no descargan navegadores. La prueba cartográfica requiere internet y verifica imágenes cargadas de cada proveedor.

La entrada local está en src/LocalApp.jsx. El código anterior de Supabase permanece en el repositorio y en main. No se debe introducir una conexión de producción para probar la versión local.

Contexto persistente: .hermes.md. Decisiones y modelo: docs/ARQUITECTURA.md. Estado y prioridades: docs/PROGRESO.md.
