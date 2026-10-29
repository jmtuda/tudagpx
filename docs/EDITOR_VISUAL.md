# Editor visual sobre el mapa

## Referencia de producto

Se revisó la aplicación real https://gpx.studio/app y su documentación oficial:
- https://gpx.studio/help/toolbar/routing — anclas, arrastre, inserción, detalle según zoom y menú de puntos.
- https://gpx.studio/help/toolbar/scissors — selección previa con sliders/perfil y división sobre la línea.
- https://gpx.studio/help/toolbar/merge — conexión explícita frente a conservación de trazados separados, pendiente de implementar.

Se replica el modelo de interacción, no la marca ni el código de gpx.studio. La implementación es propia en React y Leaflet. No se ha añadido un servicio de enrutamiento: el editor trabaja sobre geometría libre y lo indica expresamente.

## Flujo principal

Importar GPX → Rutas → Editar copia. No hace falta crear antes segmentos intermedios. Alternativamente, añadir una referencia de la biblioteca al borrador o abrir «Editar rutas» sobre el mapa.

- Lápiz: anclas blancas arrastrables, puntos pequeños «+» para insertar mediante arrastre o pulsación y clic sobre la línea para insertar. Pulsar el mapa prolonga el trazado activo; si está vacío, crea uno.
- Punto: pulsación o clic derecho abre acciones para eliminarlo, dividir o marcar extremos del recorte. Mayús + clic elimina el punto. El menú no exige escribir índices.
- Recorte: controles Inicio/Final y selección arrastrada sobre el perfil, con distancia acumulada. Se previsualizan el tramo elegido y los extremos en el mapa. Cancelar no modifica datos.
- Guardar selección como segmento: añade una copia nueva a la biblioteca, con nombre propio, sin recortar el borrador. Aplicar recorte al borrador es otra acción, reversible.
- Tijeras: al pasar sobre la línea se señala la posición; pulsar divide en dos elementos del mismo borrador. El punto de corte queda en ambos extremos y no se pierden los puntos anteriores.
- Deshacer/rehacer: botones y Ctrl/⌘ Z, Ctrl/⌘ Mayús Z. Un arrastre equivale a una operación, no a una por movimiento.
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

No hay cálculo de caminos entre anclas ni rerouting por actividad. Al mover una ancla se mueve un punto GPS, no se recalculan los puntos vecinos mediante una red vial. No hay todavía unión avanzada, edición de puntos de interés ni el conjunto completo de herramientas de gpx.studio. Los GPX muy grandes no tienen aún optimización integral.

Pruebas de interacción y geometría: tests/editor.spec.js. Se mantienen además las pruebas de originales, persistencia, exportación, cartografías, panel plegable y disposición.
