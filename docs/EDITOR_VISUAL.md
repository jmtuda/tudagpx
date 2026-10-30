# Editor visual sobre el mapa

## Referencia de producto

Se revisó la aplicación real https://gpx.studio/app y su documentación oficial:
- https://gpx.studio/help/toolbar/routing — anclas, arrastre, inserción, detalle según zoom y menú de puntos.
- https://gpx.studio/help/toolbar/scissors — selección previa con sliders/perfil y división sobre la línea.
- https://gpx.studio/help/toolbar/merge — referencia de unión explícita; implementada selección múltiple y fusión con conexiones shortest según el flujo pedido para TudaGPX.
- https://gpx.studio/help/files-and-stats — pestañas de archivos cargados al pie del mapa, desplazamiento horizontal y selección por clic/teclado.

Se replica el modelo de interacción, no la marca ni el código de gpx.studio. La implementación es propia en React y Leaflet. Seguir caminos es el modo inicial, con BRouter y opción de modo libre.

## Flujo principal

En las opciones del lápiz, «Seguir caminos» calcula el recorrido sobre OpenStreetMap. Perfiles disponibles comprobados en https://brouter.de/brouter/profiles2/: gravel, fastbike, mtb y trekking. Al empezar cada sesión, el usuario debe permitir expresamente enviar las coordenadas de las anclas a BRouter. Puede retirar el permiso o desmarcar el modo en cualquier momento. No se envían nombres ni archivos originales. El modo libre sigue funcionando sin ese servicio.

Al prolongar el track calcula desde el último extremo; al arrastrar o insertar un punto recalcula solo entre anclas vecinas. No adapta todo un GPX importado por el simple hecho de abrirlo. La red procede de OSM, independientemente de la cartografía visible: no extrae caminos de la ortofoto. Se tolera un ajuste al camino de hasta 100 m; en una edición importada se conservan las coordenadas exactas de las anclas frontera para no desplazar la geometría exterior. Esas pequeñas transiciones requieren revisión visual. No garantiza acceso, seguridad ni transitabilidad.

El indicador «Calculando por caminos…» permite cancelar. Una petición fallida o cancelada deja el recorrido intacto, sin fallback a rectas. Un resultado aceptado se puede deshacer como un único gesto. Cambiar la actividad afecta a las siguientes ediciones, no reescribe automáticamente lo ya dibujado.

Importar GPX → Rutas → Editar copia. No hace falta crear antes segmentos intermedios. Alternativamente, añadir una referencia de la biblioteca al borrador o abrir «Editar rutas» sobre el mapa.

La selección del visor es independiente: solo se dibuja en ese módulo. «Enviar al editor» en una ficha del visor crea copias y abre el editor de forma explícita. El editor no tiene controles que modifiquen las superposiciones del visor; importar desde allí conserva el original sin activar su capa en el visor.

Barra permanente de archivos al pie del mapa del editor, inspirada en la lista de gpx.studio: clic para seleccionar, flechas/Inicio/Fin para navegar y desplazamiento horizontal cuando no caben. Cada nueva copia de GPX conserva un editorRouteId propio compartido por sus tramos y editorRouteName para su etiqueta; el GPX multitramos no se une ni pierde geometría. Se selecciona su tramo actual o el primero; el selector «Trazado activo» mantiene acceso a los otros tramos. Borradores anteriores sin metadatos conservan pestañas por elemento sin migración destructiva. Una línea inactiva se selecciona antes de insertar o dividir: evita aplicar las tijeras accidentalmente a otra ruta.

- Lápiz: anclas blancas arrastrables, puntos pequeños «+» para insertar mediante arrastre o pulsación y clic sobre la línea para insertar. Pulsar el mapa prolonga el trazado activo; si está vacío, crea uno.
- Punto: pulsación o clic derecho abre acciones para eliminarlo, dividir o marcar extremos del recorte. Mayús + clic elimina el punto. El menú no exige escribir índices.
- Recorte: controles Inicio/Final y selección arrastrada sobre el perfil, con distancia acumulada. Se previsualizan el tramo elegido y los extremos en el mapa. Cancelar no modifica datos.
- Guardar selección como segmento: añade una copia nueva a la biblioteca, con nombre propio, sin recortar el borrador. Aplicar recorte al borrador es otra acción, reversible.
- Tijeras: un clic sobre la línea activa separa la segunda parte como ruta independiente con nueva pestaña, color e identidad de archivo, seleccionándola. La primera conserva solo la parte anterior al corte; otros tramos del GPX no cambian. El punto de corte queda en ambos extremos y no se pierden los puntos anteriores. «Guardar ruta» añade un GPX nuevo a la biblioteca de rutas; «Guardar segmento» guarda el trazado activo en segmentos. Ambas son copias y no sustituyen originales ni cierran la edición. La × cierra solo la ruta separada y deja la primera recortada; deshacer permite recuperar el cierre o revertir el corte.
- Deshacer/rehacer: botones y Ctrl/⌘ Z, Ctrl/⌘ Mayús Z. Un arrastre equivale a una operación, no a una por movimiento.
- Unir trazados (cadena): selecciona el primer archivo en la barra inferior y añade otros con Ctrl/⌘ + clic. Los seleccionados quedan resaltados y numerados. La cadena los fusiona en ese orden y sentido en una única ruta/trazado; cada GPX multitramos aporta todos sus tramos en orden. Los extremos iguales no necesitan conexión. Los huecos siguen el perfil shortest de BRouter con permiso visible por sesión, sin recalcular los tracks existentes ni usar rectas como alternativa ante un fallo. Se pueden guardar los resultados como ruta o segmento, cerrar y deshacer/rehacer. Un clic sin modificador vuelve a selección única; Ctrl/⌘ + clic sobre uno seleccionado lo quita de la selección.
- Mover mapa: desactiva la modificación por clic. «Terminar dibujo» y Escape activan este modo. Pulsar el lápiz permite seguir editando.
- La barra flota sobre el mapa sin añadir filas de cabecera. Sus opciones se minimizan con «−». El panel de biblioteca sigue siendo ocultable sin perder el borrador.

## Reglas técnicas que deben conservarse

1. Mantener los puntos GPX reales: el muestreo de anclas solo limita los controles dibujados, no simplifica geometría almacenada. Más zoom permite mostrar más detalle.
2. Previsualizar el arrastre dentro del componente y confirmar solo al soltar, para mantener un historial útil y evitar cientos de escrituras por gesto.
3. Suprimir el clic residual del arrastre antes de procesar clics de extensión; un icono que cambia o desaparece al soltar puede hacer que Leaflet entregue ese clic al mapa.
4. Centrar sin animación al abrir una copia evita que los controles se desplacen debajo del puntero durante la edición.
5. Clampar rangos a dos puntos como mínimo, incluso al pulsar el extremo derecho del perfil sin arrastrar. El borrador sí admite elementos incompletos fuera de la herramienta de recorte.
6. No modificar originales ni referencias al guardar selecciones; copiar puntos y conservar procedencia disponible.
7. Mantener el indicador de guardado ligado a la revisión más reciente, no a la última promesa que termine. En móvil puede estar oculto visualmente; las pruebas deben comprobar su texto, no su visibilidad.

## Límites

El cálculo depende de la disponibilidad del servidor público BRouter y de los datos OSM. No hay todavía motor sin conexión, unión avanzada, edición de puntos de interés ni el conjunto completo de herramientas de gpx.studio. Los GPX muy grandes no tienen aún optimización integral.

Pruebas de interacción y geometría libre: tests/editor.spec.js. Pruebas BRouter: tests/routing.spec.js, con peticiones reales para los cuatro perfiles, dibujo por clics, edición de copia, GPX exportable y recarga. Los escenarios de fallo/cancelación sí interceptan la red de forma explícita, separados de las comprobaciones reales. Se mantienen las pruebas de originales, persistencia, exportación, cartografías, panel plegable y disposición.
