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
5. En Borrador, edita directamente sobre el mapa: arrastra los puntos blancos para moverlos; arrastra los pequeños «+» para insertar nuevos puntos. Pulsa un punto (o haz clic derecho) para eliminarlo, dividir o marcar los límites de un recorte. La barra flotante contiene lápiz, recorte, tijeras, deshacer y rehacer.
6. El botón «+» de la barra flotante inicia un trazado nuevo. En modo lápiz, pulsar el mapa prolonga el trazado activo. «Seguir caminos» está activado inicialmente: elige Gravel, Carretera, MTB o Cicloturismo y pulsa «Permitir cálculo con BRouter». Calcula por la red de OpenStreetMap tanto al dibujar como al mover o insertar anclas. Desmarca «Seguir caminos» para dibujar libremente. «Terminar dibujo» finaliza la sesión y «Salir del editor» vuelve a la biblioteca.
7. «Guardar versión» conserva una copia independiente del proyecto, aunque esté incompleto. El borrador se guarda además automáticamente.
8. «Revisar y exportar» muestra avisos en el mapa. Los errores impiden descargar; las advertencias pueden aceptarse. Se exporta un tramo GPX por elemento, sin inventar conexiones.

Para tus propios datos, pulsa «Importar GPX». Puedes seleccionar varios archivos. En Rutas, «Editar copia» abre inmediatamente el recorrido en el editor sin modificar el original, sin necesidad de convertirlo antes en segmentos. El selector «Importar como» permite incorporarlos a Rutas o directamente a Segmentos. El botón «Original GPX» descarga el archivo importado sin modificaciones.

Para crear un segmento de una parte del recorrido, abre «Recortar trazado» en la barra del mapa. Ajusta Inicio y Final o arrastra sobre el perfil; verás la selección sobre el mapa antes de cambiar nada. Ponle un nombre y pulsa «Guardar selección como segmento»: se añade a la biblioteca sin recortar el borrador. «Aplicar recorte al borrador» es una acción diferente y puede deshacerse. «Cancelar recorte» abandona la selección sin modificar el trazado.

El botón «−» minimiza las opciones del editor para dejar más mapa visible; las herramientas siguen disponibles. El botón «☰» oculta la biblioteca completa. Se puede editar también con el panel oculto. Deshacer: Ctrl/⌘ Z; rehacer: Ctrl/⌘ Mayús Z. Detalles: docs/EDITOR_VISUAL.md.

## Proteger el trabajo

En Proyectos, «Descargar copia completa» guarda biblioteca, originales, borrador y versiones en un JSON. Hazlo periódicamente y antes de borrar datos del navegador. «Añadir copia de seguridad» recupera esa información sin borrar los datos actuales. Su borrador aparece como un proyecto más.

Abrir una versión conserva el borrador que tenías en otro snapshot. Los datos originales no se borran automáticamente. El sistema avanzado de versiones y dependencias entre rutas y segmentos sigue pendiente.

## Límites de esta entrega

- Almacenamiento local provisional; todavía no hay PostgreSQL/PostGIS ni sincronización.
- Interacción visual inspirada en gpx.studio, no una réplica completa: faltan unión avanzada y variantes.
- Revisión básica: coordenadas, huecos entre elementos, elevación y aristas idénticas. No detecta todos los solapamientos ni garantiza el sentido correcto.
- Comparación inicial por superposición, cifras y perfiles individuales; eje horizontal del perfil por puntos, todavía no por distancia.
- El cálculo por caminos requiere internet y permiso en cada sesión: envía las coordenadas de las anclas locales a BRouter, no el GPX completo. El modo libre no utiliza ese servicio. Las elevaciones calculadas proceden de BRouter si están disponibles; en modo libre, mover un punto elimina su elevación anterior.
- BRouter sigue la red de OpenStreetMap, no las líneas dibujadas en las ortofotos PNOA. Puede no conocer un camino o sus restricciones actuales. Revisa siempre el resultado; no garantiza transitabilidad ni permiso de acceso. Si falla, se conserva el trazado anterior, sin sustituirlo automáticamente por rectas.
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
