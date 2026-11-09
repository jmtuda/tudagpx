# TudaGPX

Biblioteca geográfica y editor de rutas con React, Vite y Leaflet. Web privada en https://tudagpx.vercel.app con correo/contraseña y almacenamiento Neon. La modalidad local conserva los datos en IndexedDB, sin cuenta.

En la web, el trabajo se protege primero en este navegador y se sincronizan solo los cambios tras una pausa breve (3 segundos; máximo 15 segundos mientras sigues editando, más el tiempo de red). Espera a «Guardado en Neon» antes de continuar en otro dispositivo. La copia local evita descargar otra vez la biblioteca si la versión no ha cambiado. Solo se conserva el estado actual: biblioteca visible y trabajo abierto, sin papelera ni historial automático oculto. Los conflictos no se resuelven sobrescribiendo tu trabajo. Si aparece un error, descarga una copia antes de resolverlo o borrar datos del navegador.

## Abrir la aplicación

En este Mac, abre http://127.0.0.1:5173 en tu navegador habitual.

Si el servidor está detenido, haz doble clic en `Abrir TudaGPX.command`, dentro de esta carpeta. Se abrirán una ventana de Terminal y el navegador. Mantén esa ventana abierta mientras trabajas. No necesitas escribir comandos.

Usa siempre la misma dirección y navegador: los datos se guardan ahí, no se sincronizan entre navegadores. No uses una ventana privada para conservar trabajo. Los mapas necesitan internet.

## Primera prueba

La cabecera tiene dos pestañas:

- «Ver rutas»: biblioteca fija, con selector Rutas/Segmentos. Marca recorridos para superponerlos en colores y comparar sus perfiles. Busca por nombre y tipo de ciclismo; en «Más filtros» puedes limitar distancia, desnivel y recorridos que cruzan el mapa visible. Filtrar o cambiar de categoría no oculta los seleccionados. El botón con una diana sobre el mapa centra toda la selección, incluidas rutas y segmentos. Aquí no aparecen herramientas de edición ni el borrador. En móvil la biblioteca permanece visible debajo del mapa.
- «Editar»: sin biblioteca lateral, con todo el ancho disponible para el mapa. Recibe copias de la biblioteca mediante «Enviar al editor» desde el visor. También puedes arrastrar uno o varios GPX externos sobre su mapa: se abren solo para editar, sin añadirlos automáticamente a Rutas ni Segmentos. Se conserva la creación de trazados nuevos y el trabajo previo. Guardar ruta/segmento y Limpiar siguen en la barra superior.

Los módulos no comparten las capas de recorridos activos. Marcar, importar o pulsar una línea en el visor no carga nada en el editor. «Enviar al editor» abre una copia independiente y conserva el original; cada envío crea una copia nueva. «Importar GPX» en la cabecera y arrastrar sobre el visor añaden originales a la biblioteca. Arrastrar sobre el editor abre trabajo independiente sin modificar la biblioteca ni el archivo de tu ordenador. Sus tramos quedan agrupados por archivo y se añaden al trabajo existente; el lote admite deshacer.

Las rutas cargadas en el editor aparecen en botones de fondo sólido sobre un contenedor transparente al pie del mapa. Pulsa su nombre para activarla; puedes desplazarte si hay muchas o usar las flechas. Si un GPX tiene varios tramos, ocupa una sola pestaña; pulsa el tramo en el mapa para activarlo sin unirlos. Las líneas siempre son continuas, también en las copias inactivas. Inicio se marca con un cuadrado verde y play blanco; final, con un cuadrado rojo. La barra empieza por nuevo trazado y reúne herramientas, limpiar y guardados, con un separador antes de Guardar ruta. No hay botones de abrir biblioteca, información ni salir del editor. El cuadro de edición solo muestra «Seguir caminos»; su ayuda explica BRouter, y desmarcarlo retira el permiso y cancela cálculos.

El perfil inferior está disponible tanto en el visor como en el editor y se minimiza mediante el chevron de su borde. En el visor se superponen los perfiles de todas las rutas seleccionadas, con ejes comunes de distancia real y altitud. Cada perfil y sus datos de distancia/subida acumulada comparten el color de la ruta en el mapa. No se inventan elevaciones ni se conectan los huecos entre tramos.

Solo las fichas seleccionadas muestran «Enviar al editor», «Editar nombre», «Borrar» y un icono de descarga GPX, en la misma línea. No hay botones de centrar ni quitar selección en la biblioteca. Renombrar solo cambia el catálogo, no el original. Borrar pide confirmación y elimina definitivamente el registro, sin papelera ni versión oculta; las copias independientes que sigan abiertas en el editor se conservan. Los originales de la biblioteca que mantengas siguen siendo inmutables. La descarga de rutas mantiene sus bytes exactos; los segmentos se serializan como GPX validado.

Cambiar entre pestañas conserva el borrador, historial, filtros y selecciones de la sesión, sin recrear el mapa. Al abrir o recargar, la página empieza siempre en «Ver rutas», aunque antes estuvieras editando. El borrador y la biblioteca se conservan: pulsa «Editar» para continuar. Los GPX externos también se recuperan como trabajo abierto, pero no aparecen en la biblioteca hasta guardarlos expresamente. Las superposiciones y filtros no se restauran tras cerrar o recargar.

1. Abre «Ver rutas» y elige Segmentos. Los datos de demostración son sintéticos y no deben seguirse en campo.
2. Cambia el mapa con el selector superior derecho: IGN Base, MTN, PNOA y OpenStreetMap.
3. Selecciona uno o varios segmentos para ver sus líneas y perfiles. El filtro de zona busca por intersección geográfica, sin alterar la selección.
4. Pulsa «Enviar al editor» en la ficha de un segmento. Trabajas sobre una copia, no sobre el original. Vuelve al visor para enviar más rutas o segmentos.
5. Edita directamente sobre el mapa: arrastra los puntos blancos para moverlos; arrastra los pequeños «+» para insertar nuevos puntos. Pulsa un punto (o haz clic derecho) para eliminarlo, dividir o marcar los límites de un recorte. La barra superior contiene lápiz, recorte, tijeras, deshacer y rehacer. El lápiz permite activar/desactivar la edición; no hay botón «Mover mapa».
6. El primer botón «+» inicia un trazado. En modo lápiz, pulsar el mapa prolonga el trazado activo. «Seguir caminos» y el permiso BRouter están activados inicialmente por petición del propietario. El perfil genérico trata por igual asfalto, pistas y senderos; puede incluir pasos peatonales y no garantiza ciclabilidad. Desmarca «Seguir caminos» para usar líneas rectas, retirar el permiso y cancelar cálculos pendientes; marcarlo de nuevo permite calcular. Los guardados crean copias con el nombre elegido. «Limpiar» vacía el mapa sin borrar la biblioteca y permite deshacer. El trabajo abierto se conserva al cambiar de pestaña o recargar.
7. El trabajo actual se guarda automáticamente, incluso incompleto. No se almacenan versiones automáticas anteriores. Los proyectos de copias JSON antiguas se recuperan como trazados visibles en el editor.
8. Guardar ruta/segmento comprueba automáticamente el GPX antes de pedir nombre. Si hay un error, informa y bloquea el guardado; si no, pide el nombre y crea una entrada nueva sin exigir aceptación de avisos. Cancelar el nombre no modifica la biblioteca. «Exportar a GPX» conserva su revisión y aceptación de advertencias antes de descargar. Se mantienen tramos separados sin inventar conexiones. Esta revisión básica no garantiza seguridad ni transitabilidad sobre el terreno.

Para añadir datos a tu biblioteca, pulsa «Importar GPX» o arrástralos sobre el mapa de «Ver rutas». Después usa «Enviar al editor». Si solo quieres trabajar un archivo externo, abre «Editar» y arrástralo sobre su mapa: no entra en la biblioteca. Para incorporarlo más tarde, pulsa «Guardar ruta» o «Guardar segmento», valida y elige un nombre. El guardado automático protege el trabajo en curso, pero no añade rutas a la biblioteca. El icono «Descargar GPX» de una ficha seleccionada descarga el archivo importado sin modificaciones.

Para crear un segmento de una parte del recorrido, abre «Recortar trazado» en la barra del mapa. Ajusta Inicio y Final en su cuadro o arrastra sobre la franja del perfil inferior. El gráfico, distancia y subida siguen mostrando exclusivamente lo seleccionado. Los iconos «Guardar selección como segmento», «Aplicar recorte al borrador» y «Cancelar recorte» están arriba. Guardar valida antes de pedir nombre y añade un segmento sin recortar el borrador; aplicar cambia la copia y puede deshacerse; cancelar abandona la selección sin modificarla.

El lápiz permite desactivar la edición y ocultar su cuadro, manteniendo las herramientas. La biblioteca solo está en «Ver rutas», fija y sin controles para ocultarla. Deshacer: Ctrl/⌘ Z; rehacer: Ctrl/⌘ Mayús Z. Detalles: docs/EDITOR_VISUAL.md.

## Proteger el trabajo

Al pie de la biblioteca, abre «Copias de seguridad». «Descargar copia completa» guarda biblioteca actual, originales conservados y trabajo abierto en un JSON descargado por ti, sin añadir un archivo oculto en la aplicación. Hazlo periódicamente y antes de borrar datos del navegador. «Añadir copia de seguridad» incorpora los elementos no borrados y abre el trabajo recuperado en el editor, con identidades nuevas. Los snapshots de copias antiguas también se abren en el editor, no se guardan ocultos.

No hay papelera ni historial persistente para deshacer una eliminación de biblioteca confirmada. Deshacer/rehacer del editor sigue disponible durante la sesión. Si quieres conservar una versión antigua, descárgala expresamente a tu ordenador.

## Límites de esta entrega

- La modalidad local y la web privada tienen almacenes separados; publicar una versión no migra ni sustituye bibliotecas. La web utiliza revisiones privadas en Neon; detalles en docs/DESPLIEGUE.md.
- Interacción visual inspirada en gpx.studio, no una réplica completa: faltan unión avanzada y variantes.
- Revisión básica: coordenadas, huecos entre elementos, elevación y aristas idénticas. No detecta todos los solapamientos ni garantiza el sentido correcto.
- Comparación por superposición de recorridos y perfiles de distancia real, con cifras y colores por ruta. El perfil no incluye zoom ni cálculo de pendientes.
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
