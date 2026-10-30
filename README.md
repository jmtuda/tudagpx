# TudaGPX

Biblioteca geográfica y editor de rutas con React, Vite y Leaflet. Web privada en https://tudagpx.vercel.app con correo/contraseña y almacenamiento Neon. La modalidad local conserva los datos en IndexedDB, sin cuenta.

## Abrir la aplicación

En este Mac, abre http://127.0.0.1:5173 en tu navegador habitual.

Si el servidor está detenido, haz doble clic en `Abrir TudaGPX.command`, dentro de esta carpeta. Se abrirán una ventana de Terminal y el navegador. Mantén esa ventana abierta mientras trabajas. No necesitas escribir comandos.

Usa siempre la misma dirección y navegador: los datos se guardan ahí, no se sincronizan entre navegadores. No uses una ventana privada para conservar trabajo. Los mapas necesitan internet.

## Primera prueba

La cabecera tiene dos pestañas:

- «Ver rutas»: solo consulta y comparación. Marca varias rutas para superponerlas en colores. Busca por nombre y tipo de ciclismo; en «Más filtros» puedes limitar distancia, desnivel y rutas que cruzan el mapa visible. Filtrar la lista no oculta las rutas ya superpuestas. «Centrar superpuestas» las encuadra y «Ocultar todas» limpia la superposición. Aquí no aparecen herramientas de edición ni el borrador.
- «Editar»: biblioteca con solo Segmentos y Rutas. En Rutas, «Editar copia» abre un recorrido; en Segmentos, «Abrir segmento» incorpora una copia. «Importar como» permite importar GPX a rutas o segmentos. Guardar ruta/segmento y Limpiar están siempre en la barra superior del mapa. No hay pestañas Borrador/Proyectos ni encabezados e instrucciones redundantes sobre la lista.

Los módulos no comparten las capas de rutas activas. Marcar o importar una ruta en el visor no la carga ni la dibuja en el editor. Para pasarla, pulsa «Enviar al editor» en su ficha: abre una copia editable y conserva el original. Importar un GPX desde el editor tampoco activa su superposición en el visor. La biblioteca de originales es común, pero consultar esa biblioteca no equivale a cargar sus rutas.

Las rutas cargadas en el editor aparecen en una barra de pestañas al pie del mapa, como en gpx.studio. Pulsa su nombre para activarla; la seleccionada queda resaltada. Puedes desplazarte por la barra si hay muchas o usar las flechas del teclado. Funciona con la biblioteca oculta y las herramientas minimizadas. Si un GPX tiene varios tramos, ocupa una sola pestaña; el selector «Trazado activo» permite elegir su tramo sin unirlos. Pulsar otra línea del borrador la selecciona antes de editarla.

Cambiar entre pestañas conserva el borrador, historial, filtros y selecciones de la sesión, sin recrear el mapa. Se recuerda la pestaña principal elegida al recargar. Las superposiciones y filtros no se restauran tras cerrar o recargar; el borrador y la biblioteca sí se guardan.

1. Abre «Editar» y, en Segmentos, marca dos trazados de demostración. Son sintéticos y no deben seguirse en campo.
2. Cambia el mapa con el selector superior derecho: IGN Base, MTN, PNOA y OpenStreetMap.
3. Mueve el mapa. La lista busca segmentos geográficamente y conserva los seleccionados fuera de la vista.
4. Pulsa «Abrir seleccionados en el editor». Trabajas sobre copias, no sobre originales.
5. Edita directamente sobre el mapa: arrastra los puntos blancos para moverlos; arrastra los pequeños «+» para insertar nuevos puntos. Pulsa un punto (o haz clic derecho) para eliminarlo, dividir o marcar los límites de un recorte. La barra superior contiene lápiz, recorte, tijeras, deshacer y rehacer. El lápiz permite activar/desactivar la edición; no hay botón «Mover mapa».
6. La barra superior permite abrir rutas/segmentos o iniciar un trazado con «+». En modo lápiz, pulsar el mapa prolonga el trazado activo. «Seguir caminos» y el permiso BRouter están activados inicialmente por petición del propietario: no hace falta pulsar «Permitir». El perfil genérico trata por igual el firme de asfalto, pistas y senderos, sin categorías deportivas ni penalizar grava/tierra. Puede incluir pasos peatonales; no garantiza ciclabilidad. Desmarca «Seguir caminos» para líneas rectas o pulsa «Retirar permiso» para impedir nuevos cálculos durante esa sesión. Los botones «Guardar ruta» y «Guardar segmento» crean copias en la biblioteca; puedes nombrar el segmento. «Limpiar» vacía el mapa sin borrar la biblioteca y permite deshacer. El trabajo abierto se conserva al cambiar de pestaña o recargar.
7. El trabajo en curso se guarda automáticamente, incluso incompleto; los proyectos anteriores siguen conservados en los datos y en las copias JSON.
8. «Revisar y exportar» muestra avisos en el mapa. Los errores impiden descargar; las advertencias pueden aceptarse. Se exporta un tramo GPX por elemento, sin inventar conexiones.

Para tus propios datos, pulsa «Importar GPX». Puedes seleccionar varios archivos. En «Ver rutas» se incorporan para consultar y comparar. En «Editar» → Rutas, «Editar copia» abre el recorrido en el borrador sin modificar el original, sin necesidad de convertirlo antes en segmentos. El selector «Importar como» del editor permite incorporarlos a Rutas o directamente a Segmentos. El botón «Original GPX» descarga el archivo importado sin modificaciones.

Para crear un segmento de una parte del recorrido, abre «Recortar trazado» en la barra del mapa. Ajusta Inicio y Final o arrastra sobre el perfil; verás la selección sobre el mapa antes de cambiar nada. Ponle un nombre y pulsa «Guardar selección como segmento»: se añade a la biblioteca sin recortar el borrador. «Aplicar recorte al borrador» es una acción diferente y puede deshacerse. «Cancelar recorte» abandona la selección sin modificar el trazado.

El botón «−» minimiza las opciones del editor para dejar más mapa visible; las herramientas siguen disponibles. El botón «☰» oculta la biblioteca completa. Se puede editar también con el panel oculto. Deshacer: Ctrl/⌘ Z; rehacer: Ctrl/⌘ Mayús Z. Detalles: docs/EDITOR_VISUAL.md.

## Proteger el trabajo

Al pie de la biblioteca, abre «Copias de seguridad». «Descargar copia completa» guarda biblioteca, originales, trabajo abierto y versiones anteriores en un JSON. Hazlo periódicamente y antes de borrar datos del navegador. «Añadir copia de seguridad» añade esa información sin borrar datos actuales; sus trazados abiertos se recuperan como copias adicionales en el editor, con identidades nuevas.

Los originales y snapshots anteriores no se borran automáticamente. El sistema avanzado de versiones y dependencias entre rutas y segmentos sigue pendiente.

## Límites de esta entrega

- La modalidad local y la web privada tienen almacenes separados; publicar una versión no migra ni sustituye bibliotecas. La web utiliza revisiones privadas en Neon; detalles en docs/DESPLIEGUE.md.
- Interacción visual inspirada en gpx.studio, no una réplica completa: faltan unión avanzada y variantes.
- Revisión básica: coordenadas, huecos entre elementos, elevación y aristas idénticas. No detecta todos los solapamientos ni garantiza el sentido correcto.
- Comparación inicial por superposición, cifras y perfiles individuales; eje horizontal del perfil por puntos, todavía no por distancia.
- El cálculo por caminos requiere internet y está permitido por defecto, revocable en la sesión: envía coordenadas de las anclas locales a BRouter, no el GPX completo. La primera petición registra un perfil de cálculo sin datos personales en el mismo BRouter; se reutiliza temporalmente. El modo libre no utiliza ese servicio. Las elevaciones calculadas proceden de BRouter si están disponibles; en modo libre, mover un punto elimina su elevación anterior.
- BRouter sigue la red de OpenStreetMap, no las líneas dibujadas en las ortofotos PNOA. Puede no conocer un camino o sus restricciones actuales. Revisa siempre el resultado; no garantiza transitabilidad ni permiso de acceso. Si falla, se conserva el trazado anterior, sin sustituirlo automáticamente por rectas.
- Importación de hasta 25 MB por archivo; grandes bibliotecas y trazados masivos aún sin optimizar.
- Supabase anterior aislado: no se activa ni en local ni en la web privada publicada.

## Desarrollo y verificación

Con Node.js compatible con Vite 8 (por ejemplo Node 22.12 o superior):

- `npm ci`: instalar dependencias del lockfile.
- `npm start`: servidor local estable y apertura del navegador.
- `npm run lint`: comprobaciones estáticas.
- `npm run build`: compilación de producción.
- `npm test`: pruebas reales de Chrome con Playwright. Usan Chrome instalado (`channel: chrome`); no descargan navegadores. La prueba cartográfica requiere internet y verifica imágenes cargadas de cada proveedor.

La entrada local está en src/LocalApp.jsx. El código anterior de Supabase permanece en el repositorio y en main. No se debe introducir una conexión de producción para probar la versión local.

Contexto persistente: .hermes.md. Decisiones y modelo: docs/ARQUITECTURA.md. Estado y prioridades: docs/PROGRESO.md.
