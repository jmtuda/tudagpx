# Progreso

## Estado actual únicamente y borrado definitivo (política vigente)

El propietario confirmó eliminar definitivamente 4 rutas y 6 segmentos marcados como borrados y aplicar en adelante una política sin papelera ni historial automático oculto. Migración 004 instalada con readback exacto de funciones: cada guardado mantiene un único head con versión monotónica, borrado explícito por id, inmutabilidad de los originales supervivientes y rechazo de clientes antiguos sin policy=current-only-v1. Los fragmentos completados se eliminan y los abandonados caducan por última actividad de su grupo.

Transición propietaria ejecutada con guardas: 8/15 registros previos, 4/6 tombstones exactos, 4/9 visibles y 0 proyectos. La revisión 202 pasó a 203; solo queda una revisión con 4 rutas y 9 segmentos. Hash de todo el estado esperado comprobado dentro de PostgreSQL antes/después y tras compactar: originales conservados y trabajo abierto intactos. JSON actual 12.251.845 B, tabla app 2.179.072 B y base 10.649.600 B al terminar. No se descargó el payload del propietario para esta operación.

Aplicación local: borrado confirmado físico sin deletedAt, cachés históricas internas purgadas, pendientes de edición protegidos y copias antiguas recuperadas como trabajo visible, nunca projects ocultos. Confirmaciones de sincronización actualizan cachés confirmadas antiguas. Descarga de JSON solo del estado actual; los archivos que el usuario haya descargado a su ordenador no se modifican. La retención de recuperación propia del proveedor Neon es independiente de las tablas de la aplicación.

Verificación: 106 pruebas Chrome, 25 Node, lint/build y pruebas pequeñas con Neon real correctas, incluidas eliminación explícita, conflictos, una sola fila tras varios commits, geometría/bytes inmutables de los supervivientes, multipart y limpieza sintética. Readback de las seis definiciones SQL vigentes. Un aviso aislado de profundidad de actualización en la batería no se reprodujo en seis repeticiones focales posteriores.

## Compactación puntual autorizada de Neon

El propietario confirmó expresamente borrar las 201 revisiones automáticas anteriores, conservar solo la actual, limpiar cargas temporales antiguas y compactar. Ejecutado mediante scripts/compact-cloud-storage.mjs con contador esperado 202, transacción y bloqueo breve de tablas. Eliminadas 201 revisiones y 5.640 fragmentos de 216 cargas incompletas de más de 24 h. Conservada íntegra la revisión 202, sin renumerarla: hash del payload completo comprobado antes/después y tras VACUUM FULL. Biblioteca actual intacta: 8 rutas, 15 segmentos, 0 proyectos; JSON 13.202.196 B.

Tamaño total de base medido: 517.767.168 B antes y 10.903.552 B después de compactar ambas tablas. Un 97,9 % menos. Solo queda una revisión y cero fragmentos pendientes al terminar. La inspección posterior confirmó funciones de sincronización exactas, conteos y contenido actual. Esta autorización es puntual, no una política de retención: no activar borrado automático ni repetir el script sin una nueva confirmación. Los nuevos guardados siguen creando revisiones. La cuota mensual de transferencia ya consumida no se recupera.

## Reducción de transferencia Neon

Verificación final: lint/build, 103 pruebas Chrome y 18 pruebas Node correctas; integración pequeña contra Neon real y readback exacto de las tres funciones de migración. Pendientes aislados entre pestañas y recuperados también tras cerrar/reabrir una pestaña; confirmación de caché condicionada en transacción para no pisar ediciones nuevas.

Sincronización por patch de campos/registros, sin reenviar biblioteca/originales al editar. Guardado local inmediato; red agrupada tras 3 s, máximo 15 s y sin cola de estados intermedios. Caché confirmada por cuenta y pendientes por pestaña, recuperación tras recarga y rechazo seguro de conflictos. Recarga sin cambios consulta solo metadata; la hidratación no genera guardado.

Backend calcula y protege dentro de PostgreSQL, incluso para clientes antiguos: sin descargar a Vercel el estado previo ni los chunks subidos. Migración 003 aditiva aplicada y verificada, sin tocar biblioteca/historial del propietario. Se conservan snapshots completos internos, no se promete reducción del almacenamiento ya ocupado ni devolución de cuota consumida. Dispositivo nuevo o versión remota distinta todavía descarga el estado completo una vez.

Prueba real con estado sintético de 18.601 B: renombrar envía 81 B; editar borrador 125 B; cada commit devuelve 192 B desde Neon y 13 B al cliente (cuerpos HTTP, sin cabeceras/TLS). Transporte frontend real contra Neon: renombrado 90 B y recarga en caliente solo metadata (313 B Neon). Pruebas verifican originales/proyectos inmutables, Unicode, multipart incompleto, concurrencia y limpieza exclusiva de datos sintéticos. Inspección agregada sin descargar contenido: estado real 13.202.196 B, 8 rutas, 15 segmentos, 202 snapshots; almacenamiento físico 357.277.696 B en el momento de la inspección. No son métricas del consumo mensual.

## Fichas sin bajada y acciones solo al seleccionar

Las fichas de rutas y segmentos del visor muestran nombre, distancia y desnivel positivo, sin bajada. Enviar al editor aparece únicamente al seleccionar, en la misma fila que editar nombre, borrar y descargar GPX. Sin selección no se reserva fila de acciones. Envío por popup conservado. Verificado con lint/build y 102 pruebas Chrome, incluidas selección/deselección, alineación móvil/escritorio, copias independientes y conservación de originales.

## Nombres y referencias sobre PNOA

Verificación final: lint/build correctos y 102 pruebas Chrome aprobadas, incluidas cartografías reales y conservación de originales.

Añadida superposición oficial IGNBaseOrto (PNG transparente) sin sustituir las ortofotos PNOA. Activada inicialmente, con casilla Mostrar nombres y referencias en el selector del mapa y preferencia conservada al recargar. Compartida por visor/editor, solo sobre PNOA y debajo de rutas y anclas. Conserva atribución IGN y advierte errores de referencias por separado. Control desplegado por encima de la diana, sin interferir con dibujo o selección. Pruebas Chrome con teselas reales en escritorio/móvil: activar/desactivar, recarga, otras bases, teclado y biblioteca/borrador intactos; capturas revisadas. Sin cambios de datos ni migraciones.

## Filtros del visor en una sola apertura

Buscar y filtrar rutas/segmentos muestra de una vez nombre y límites mínimo/máximo de distancia y desnivel, sin un segundo desplegable. Retirados el selector de tipo de recorrido, la opción de limitar al mapa visible y su leyenda inferior. Limpiar filtros y selección independiente conservados. Sin cambios de datos ni originales. Verificado con lint/build, 100 pruebas Chrome y revisión visual del panel expandido; cobertura de apertura única en escritorio/móvil y segmentos.

## Inicio en visor y GPX externos del editor

Al abrir o recargar se inicia siempre en Ver rutas, ignorando la preferencia anterior de pestaña y sin borrar el trabajo previo. Al volver a Editar se recupera el borrador.

Arrastrar uno o varios GPX sobre el editor abre copias agrupadas por archivo solo en draft. No añade originales ni segmentos a biblioteca, no crea sourceRouteId/sourceId inexistentes y no modifica el archivo del ordenador. Se añade al trabajo existente en una operación deshacible. Guardado automático protege ese trabajo sin catalogarlo; Guardar ruta/segmento lo incorpora expresamente tras validar y nombrar. El botón Importar GPX y el drop del visor conservan su importación a biblioteca. Aviso de drop diferencia ambos destinos; errores conservan datos y un lote mixto abre solo archivos válidos.

Verificado con lint/build y 100 pruebas Chrome correctas. Incluye arranque pese a antigua preferencia Editar, recuperación tras recargar, múltiples GPX/tramos sin catalogar ni recalcular por BRouter al abrir, conservación del trabajo previo, deshacer/rehacer del lote, archivos inválidos/lotes mixtos y guardado explícito como ruta/segmento. Bytes del archivo de prueba intactos; capturas móvil/escritorio del editor revisadas.

## Biblioteca fija del visor y transferencia única

La biblioteca de Ver rutas queda fija con selector Rutas/Segmentos; en móvil permanece visible debajo del mapa. Retirados dock/hover/fijación/cierre y botones de centrar/quitar selección. Un botón de diana en el mapa encuadra toda la selección, independiente de categoría y filtros. Rutas y segmentos comparten representación, perfiles y colores en el visor.

Todas las fichas ofrecen Enviar al editor; seleccionadas añaden Editar nombre, Borrar y descarga GPX como icono en una línea. El popup de ambas clases también ofrece envío. El editor no tiene barra lateral ni carga originales por clic en referencias: solo recibe copias explícitas desde el visor. Cada envío crea una identidad independiente. Importación por botón/drop desde cualquier módulo añade originales y abre el visor, nunca carga copias automáticamente. Recuperación de borradores/JSON y dibujo nuevo se conservan; sin migraciones ni cambios de originales.

Verificación: lint/build y 95 pruebas Chrome correctas. Incluye fichas alineadas, transferencia desde fichas y popup de ambas clases, envíos repetidos independientes, recarga, selección mixta y centrado real, importación sin carga, panel fijo táctil/escritorio, editor a todo el ancho, cartografías reales, edición/routing/recorte y originales/snapshots intactos. Descarga de segmento comprobada mediante GPX parseado con puntos exactos y estado sin cambios; Leaflet conserva su nodo al cambiar de módulo. Capturas móvil/escritorio revisadas.

## Extremos unificados entre visor y editor

Rutas y segmentos del editor usan exactamente la misma fábrica de iconos que Ver rutas: inicio verde con play blanco y final rojo. Las anclas de los extremos siguen siendo arrastrables y mantienen el menú de puntos, sin ocultar el símbolo con un círculo de edición. El recorte también usa los iconos compartidos, sin textos permanentes Inicio/Final. Se mantiene la separación de extremos coincidentes en circulares. Iconos arrastrables memoizados para que las vistas previas no reinicien el gesto.

## Guardado automático y simplificación final de controles

En el visor, fichas sin botones si no están seleccionadas; al seleccionar solo Editar nombre, Borrar y Descargar GPX en una línea. Transferencia al editor conservada en el popup del mapa. Descarga conserva los bytes originales.

Barra: nuevo trazado primero; retirados abrir biblioteca, información y salir. Limpiar antes del grupo de guardados y separador vertical inmediato a Guardar ruta. Cuadro editar con solo Seguir caminos; desmarcar retira permiso y cancela cálculo, marcar permite calcular. Ayuda BRouter en el control. Cuadro recorte con Inicio/Final, sin nombre; perfil y métricas inferiores siguen mostrando solo la selección. Todos los trazados continuos, incluidas copias inactivas. Inicio cuadrado verde con play blanco, similar al final rojo.

Guardar ruta/segmento valida automáticamente geometría y round-trip GPX antes de pedir nombre. Solo los errores bloquean; sin error, abre el nombre y guarda una entrada nueva. Cancelar no modifica biblioteca ni trabajo. Los avisos no interrumpen el guardado; exportación conserva su revisión y aceptación de advertencias. Aplicado también al guardado de selección y creación de segmentos desde rutas.

Verificación: lint/build y 83 pruebas Chrome correctas. Incluye selección y acciones en una línea en móvil/escritorio, descarga byte a byte, nombres/cancelación, errores antes del nombre, guardados sin confirmación de avisos, recorte, trazados sólidos, marcadores, snapshots y originales intactos. Revisión visual de escritorio/móvil.

## Barra de iconos y perfiles compartidos

Una sola barra de herramientas: guardar ruta/segmento, exportar GPX y limpiar aparecen como iconos SVG a continuación de las herramientas existentes, con etiquetas accesibles y ayuda. Invertir y aplicar/cancelar recorte también se realizan arriba. El cuadro de dibujo/edición conserva solo nombre y Seguir caminos; el de recorte solo el nombre nuevo. Información de BRouter y retirada de permiso accesibles desde el icono de información.

Perfil inferior en visor y editor, sin el antiguo pie del visor. Las rutas activas del visor superponen perfiles con ejes comunes de distancia real y altitud; sus nombres, distancias y subidas acumuladas aparecen arriba a la derecha con los mismos colores del mapa. El editor muestra el archivo activo; al recortar, el gráfico y las métricas corresponden exclusivamente a la selección. Inicio/Final y franja de selección están abajo; el dominio completo de la franja evita desplazamientos al repetir gestos. Se respetan tramos separados y altitudes ausentes. Minimización mediante chevron sin texto visible. Botones de archivos sólidos sobre contenedor transparente.

Verificado: lint/build y 77 pruebas Chrome correctas, incluidos colores exactos mapa/perfil/métricas, superposición, recorte estable, guardados validados y originales intactos. Revisado en escritorio, móvil y ventana baja.

## Fichas, guardado validado y perfil del editor

Botones Editar nombre y Borrar en cada ficha de ruta/segmento. Nombre de catálogo independiente del GPX original. Confirmación antes de todo borrado; deletedAt retira el registro de listas y mapas, conservando bytes, geometría, snapshots y copias abiertas. Validación del marcador y protección del servidor contra cambios en tracks de rutas y points de segmentos.

Guardar ruta, Guardar segmento y Exportar a GPX en la barra superior. Guardados de biblioteca y exportaciones comparten comprobaciones de coordenadas, puntos mínimos, recorrido no nulo, elevación, huecos y duplicados, además de serialización GPX y relectura con recuento de puntos/tramos. Errores bloquean; avisos requieren aceptación. Sin incidencias, guardar crea una entrada nueva directamente. El trabajo en curso se sigue guardando automáticamente aunque esté incompleto.

Perfil de altitud minimizable del archivo activo completo, con ejes de distancia/altura e inspección por puntero, toque y teclado sincronizada con marcador en mapa. No conecta tramos separados ni interpola elevaciones ausentes. Selector de archivos sobre fondo transparente. Popup al primer clic izquierdo en una ruta del visor, con transferencia explícita de una copia a Editar. No incorpora pendiente, zoom ni selección avanzada del gráfico de gpx.studio.

Verificación: lint/build correctos y 71 pruebas Chrome aprobadas, con escritorio, móvil y ventana de poca altura. Se corrigió el solapamiento de opciones del editor con el perfil en ventanas bajas. Integración real con Neon y propietario sintético: renombrado/borrado lógico guardados y releídos exactamente, cambios de geometría original rechazados, bytes intactos. Solo se eliminan registros del propietario sintético al terminar; ausencia comprobada.

## Flujo único de edición sobre el mapa

Barra horizontal superior siempre disponible en Editar, independientemente de la sección de biblioteca. Incluye abrir rutas/segmentos, dibujar y acciones permanentes para guardar como ruta, como segmento y limpiar. Los guardados usan el archivo o tramo activo y crean registros nuevos sin reemplazar originales. Limpiar cancela cálculos, vacía todas las copias/referencias del editor y admite deshacer; biblioteca y proyectos se conservan. No elimina el borrador al recargar o cambiar de módulo.

BRouter y permiso de cálculo activados inicialmente por petición expresa del propietario; no hace falta pulsar Permitir. Modo libre y retirada de permiso conservados. Nueva preferencia caminos/libre tudagpx-routing-mode-v3, ignorando preferencias previas. Perfil propio all-paths registrado en el mismo servidor BRouter, cacheado temporalmente en memoria: mismo coste de distancia para asfalto, tierra, grava, pistas y senderos, sin penalización de firme ni desnivel, con pequeño coste de giro para evitar zigzags innecesarios. Incluye accesos peatonales y ciclistas; no garantiza ciclabilidad ni sigue líneas de PNOA desconocidas por OSM. Dibujo, edición y conexiones de la unión usan el mismo perfil; errores/cancelaciones conservan las copias, sin sustituir por rectas.

Biblioteca del editor limitada a Segmentos/Rutas, sin «Segmentos de la zona», sus instrucciones ni pestañas Borrador/Proyectos. Retirado el botón Mover mapa: el lápiz es conmutador; Escape/Terminar dibujo siguen disponibles. El nombre del tramo se edita en las opciones del mapa. Copias completas JSON trasladadas a «Copias de seguridad» al pie de biblioteca; restauración aditiva abre las copias recuperadas en el editor y remapea también sus identidades de archivo. No borra borradores, originales ni snapshots previos.

Verificado con lint, build y 59 pruebas Chrome correctas. Cálculo real desde navegador sobre asfalto, pista de tierra y sendero de grava; etiquetas OSM y coste por distancia uniforme comprobados en respuestas BRouter. Incluye permiso inicial sin pulsar Permitir, retirada de permiso, registro/cancelación del perfil, geometría y originales intactos ante fallos, edición/dibujo/unión, navegación solo Segmentos/Rutas en escritorio y móvil, snapshots anteriores conservados y copias JSON aditivas editables. Revisión visual con PNOA real.

Clic en un segmento del mapa abre una copia editable en lugar de ocultarlo; si ya está abierto lo selecciona sin duplicarlo. Las referencias de segmentos ya abiertos no se dibujan dos veces. La selección del tramo activo se recupera también con la biblioteca abierta tras recargar. El selector de cartografía detiene eventos nativos de Leaflet para evitar dibujar puntos al cambiar de mapa.

## Nombres de segmentos, panel compacto y avisos temporales

Crear segmentos desde una ruta o guardar un trazado como segmento abre un formulario con un nombre editable por segmento. Guardar confirma copias independientes; Cancelar/Escape no modifica biblioteca, originales ni borrador. No admite nombres vacíos o solo espacios. El recorte mantiene su campo de nombre existente y guarda sin un segundo formulario.

Filtros plegados y botones de fijación/cierre comparten la primera fila en visor y editor. Retirados encabezados redundantes y reducido el margen antes de las fichas. La fila del editor queda en Segmentos/Rutas; las fichas de rutas comparten aspecto compacto y métricas de subida/bajada sin perfil automático.

Los avisos flotantes desaparecen cinco segundos después de cada acción, incluso si se repite el mismo texto. Se conserva × para cerrar de inmediato. El estado de persistencia no se oculta.

## Importación arrastrando y referencias en el visor

Se pueden soltar uno o varios GPX sobre el mapa, con aviso visual de destino. Reutiliza la lectura y validación existentes, conserva bytes originales y procesa cada archivo de manera independiente. En el visor quedan seleccionados; en el editor se añaden copias agrupadas por archivo a las pestañas inferiores sin alterar la selección del visor. Importación por botón conservada.

El visor muestra atenuadas todas las rutas de biblioteca que intersectan el rectángulo visible, incluso sin vértices interiores. Clic en línea alterna selección/resaltado; color estable y coincidente con la ficha. Selección independiente de filtros y vista. «Quitar selección» devuelve las rutas a referencias atenuadas. No se dibuja esta capa en el editor: cerrarlo todo sigue dejando solo el mapa base.

Extremos de rutas/segmentos solo con iconos ▶ verde y ■ rojo, sin rótulos Inicio/Final. Nombres accesibles conservados; en circulares los iconos se separan horizontalmente para no ocultarse. Recorte conserva controles propios.

Validado: lint, build y batería de 47 pruebas Chrome, con nuevas pruebas de drop simple/múltiple, archivo inválido, originales exactos, selección sobre la línea y aislamiento visor/editor; regresión de extremos en escritorio y móvil. Revisión visual con PNOA real.

## Interfaz recogida y panel tipo dock

PNOA máxima actualidad por defecto, con teselas reales comprobadas. El selector de mapas muestra solo un icono; al pulsarlo abre la lista con nombres y se recoge al elegir, perder el foco o pulsar Escape. Conserva IGN Base, MTN, PNOA y OSM con atribuciones.

Biblioteca inicialmente oculta tanto en visor como editor. Se despliega al acercar el cursor al borde izquierdo y se recoge al salir; el borde también permite apertura táctil/teclado. Chincheta independiente por módulo para mantenerla fija durante la sesión; el botón lateral permite ocultarla expresamente. Emergente superpuesto al mapa sin remontar Leaflet; al fijarlo reserva espacio, en móvil debajo del mapa para conservar herramientas utilizables.

Visor simplificado: sin título de exploración, cabecera de biblioteca, instrucciones ni perfiles por ruta. Búsqueda y filtros recogidos tras flecha; las fichas muestran nombre, distancia y desniveles positivos/negativos acumulados, con aviso si faltan elevaciones. Acciones solo en fichas seleccionadas. Se añade cálculo de descenso a stats sin sumar saltos entre tramos.

Verificado: lint, build y 44 pruebas Chrome correctas. Pruebas del dock en escritorio y móvil, apertura táctil, fijación, filtros, fichas, conservación del borrador y carga real/decodificada de las cuatro cartografías. Revisión visual adicional con PNOA y panel emergente. La interfaz local queda terminada; publicación y migración a los proyectos existentes «tudagpx» de Vercel y Neon autorizadas por el usuario y pendientes de ejecutar después de esta entrega, sin cambios remotos realizados aún.

## Inicio y final visibles

Marcadores y etiquetas permanentes «▶ Inicio» (verde/círculo) y «■ Final» (rojo/cuadrado) en los trazados seleccionados del editor, incluso en modo Mover mapa, con herramientas minimizadas o selección múltiple. Etiquetas arriba/abajo para distinguir extremos coincidentes de rutas circulares. Se actualizan al invertir y durante previsualización de arrastre; no interceptan gestos de edición. También se muestran en las rutas superpuestas del visor y en segmentos seleccionados de biblioteca. Recorte conserva sus indicadores específicos. Al cerrar todo desaparecen los marcadores.

Verificado con lint/build, 12 regresiones del editor y dos pruebas nuevas en escritorio/móvil (visibilidad, inversión, circular y cierre), más revisión visual real.

## Unir rutas o segmentos del borrador

Nueva selección múltiple de archivos en la barra inferior con Ctrl/⌘ + clic, resaltado y numeración del orden. Botón de cadena «Unir trazados» en la barra de edición, habilitado con dos o más archivos seleccionados. Concatena en ese orden, conserva el sentido y todos los puntos existentes y reemplaza las copias seleccionadas por una ruta con una sola pestaña; los archivos no seleccionados y la biblioteca original no cambian. Un GPX multitramos seleccionado aporta sus tramos en el orden actual del borrador.

Extremos exactamente coincidentes se unen sin red ni duplicar la coordenada de unión. Los huecos se calculan con el perfil oficial BRouter shortest (comprobado en el directorio público y con peticiones reales desde Chrome), incluso si el lápiz estaba en modo libre. Consentimiento visible por sesión: solo extremos de los enlaces. No se recalculan los tracks originales, no se invierte el sentido ni se buscan órdenes automáticamente. La proximidad a la red conserva el límite de 100 m del cliente; revisar visualmente los enlaces de extremos fuera de un camino. Operación atómica, cancelable y deshacible: un fallo no fusiona parcialmente ni sustituye por una recta.

Verificado: lint, build y 19 pruebas Chrome del editor. Incluyen unión de dos y tres archivos, Ctrl y ⌘, deselección, conservación de archivos ajenos y originales, coincidencias sin red, conexiones shortest reales, permiso previo, fallo/cancelación, deshacer/rehacer, persistencia y GPX resultante con un solo tramo. Revisión visual del resaltado, numeración y permiso.

## Dividir en rutas independientes

Las tijeras ahora separan la segunda parte con un solo clic sobre el trazado activo, asignándole nueva identidad de archivo, pestaña y color. Queda seleccionada y se puede cerrar sin retirar la primera parte ni otros tramos del GPX. Añadido «Guardar ruta» en las opciones del mapa y «Guardar como nueva ruta» en el panel: genera un GPX nuevo con bytes conservados en la biblioteca, sin reemplazar el original. Se mantiene el guardado como segmento. Corte y cierre admiten deshacer/rehacer.

Verificado con lint, build y pruebas Chrome: 12 regresiones del editor y dos nuevas pruebas de corte por un solo clic en escritorio/móvil, guardado independiente como ruta y segmento, cierre de la segunda parte, originales intactos, deshacer/rehacer y persistencia de las dos pestañas tras recargar.

## Colores y cierre de rutas del editor

Corregido el trazado residual al cerrar: los segmentos de biblioteca que cruzan la vista ya no se dibujan automáticamente, solo los seleccionados expresamente. Cerrar la última ruta limpia también esas referencias. La prueba comprueba ahora todas las líneas y controles del mapa (no solo draft-line), antes/después de recargar y al alternar módulos: cero trazados tras cerrar todo. Lint, build y las 12 pruebas del editor correctos.

Cada archivo cargado usa un color de la misma paleta del visor, compartido por todos sus tramos y su indicador en la barra inferior. La selección y el recorte conservan ese color. Añadido botón × independiente junto a cada título: cierra todos los tramos de esa copia, sin borrar originales ni alterar el visor, y permite deshacer. Al cerrar la activa se selecciona otra disponible; cerrar la última deja el editor vacío y el cambio se conserva tras recargar.

Verificado: lint y build, 12 pruebas del editor en Chrome (incluidas comprobaciones de colores, cierre y deshacer en escritorio/móvil) y revisión visual de la barra inferior.

## Carga manual entre módulos y selección de archivos en el editor

Corregida la separación real de capas: las rutas superpuestas del visor ya no se dibujan en el editor. Se añade «Enviar al editor» en cada ficha, que crea una copia editable mediante acción explícita. Importar desde el editor no activa superposiciones del visor y su biblioteca de originales no ofrece casillas que modifiquen el visor. Importar desde el visor no cambia la pestaña interna del editor.

Revisadas la app gpx.studio y su guía files-and-stats. Implementada barra permanente de rutas cargadas al pie del mapa: selección resaltada, desplazamiento horizontal y navegación por teclado; funciona con panel oculto y opciones minimizadas. Las nuevas copias de GPX multitramos se agrupan en una pestaña por archivo, sin unir geometría. El selector de trazado mantiene acceso a sus partes. Pulsar una ruta inactiva la selecciona antes de aplicar operaciones de edición o tijeras.

Verificado con lint y build; 34 pruebas Chrome correctas, incluidas tres nuevas de transferencia manual, independencia en ambos sentidos, selección entre archivos en escritorio/móvil, edición exclusiva de la copia elegida, originales intactos y agrupación persistida tras recarga. Revisión visual adicional de la barra. Se conserva la biblioteca original común y todos los borradores previos; sin publicar ni tocar main.

## Separación entre visualizar y editar

Dos pestañas principales en la cabecera compacta: «Ver rutas» y «Editar». El visor solo muestra rutas seleccionadas, sin segmentos, borrador, anclas, clasificación editable ni herramientas de edición/exportación. Filtros combinables por nombre, ciclismo, distancia mínima/máxima, desnivel mínimo/máximo y cruce con la zona visible; las superposiciones no dependen de esos filtros. Añadidos centrar superpuestas, ocultar todas, colores identificables y limpiar filtros.

El editor conserva Rutas, Segmentos, Borrador y Proyectos para cargar copias y GPX, sin modificar originales. Cambiar de espacio cancela cálculos pendientes pero conserva geometría, historial, selección, filtros y mapa de la sesión. La pestaña principal se recuerda en localStorage; biblioteca/borrador siguen en IndexedDB. Filtros y superposiciones siguen siendo estado de sesión, no se promete restaurarlos tras recarga.

Verificado: lint y build correctos, 31/31 pruebas Chrome. Nuevas pruebas de ambos espacios en escritorio y móvil, filtros, cruce de líneas sin vértices interiores, selección independiente, carga de rutas y segmentos, ocultación de panel y recuperación del borrador. Revisión visual de ambas pestañas; cabecera de 52 px y pie del visor de 46 px. No se publica ni se modifica main.

## Seguir caminos al crear y editar

Implementado el nuevo requisito prioritario: seguir la red vial OSM por defecto, con modo libre opcional. Cliente BRouter sin claves ni dependencias nuevas; perfiles Gravel, Carretera, MTB y Cicloturismo comprobados con respuestas reales desde Chrome. Consentimiento explícito por sesión antes de enviar las coordenadas de las anclas, revocable. No se envían originales ni nombres.

Crear/extender calcula desde el extremo; mover/insertar/eliminar anclas interiores recalcula la parte local entre vecinas, conservando la geometría exterior y el original. Indicador de cálculo y cancelación, límite de tiempo, validación de respuesta y rechazo si no hay camino a menos de 100 m. Fallos conservan el trazado; sin fallback automático a rectas. Deshacer revierte cada cálculo completo.

Verificación: batería de 28 pruebas correcta, incluidas respuestas BRouter reales, dibujo con clics, arrastre de una copia importada, originales intactos, exportación GPX y recuperación tras recarga. Pruebas de error/cancelación con interceptación separadas de las reales. Revisión visual de los controles y consentimiento. El servicio público requiere internet; no hay motor offline y no garantiza transitabilidad. Se conserva la arquitectura local y no se publica nada.

## Entrega 1: aplicación local tangible

Rama: desarrollo/primera-version-local. Base original: a25f6a7. main intacta.

Auditoría: aplicación original compilaba y pasaba lint, pero requería una sesión Supabase. Se conservó el código anterior; la nueva entrada local reutiliza React, Leaflet y MapaBase.jsx. npm ci detectó cuatro vulnerabilidades de dependencias; se aplicaron actualizaciones compatibles con npm audit fix, sin cambio de framework.

Implementado:
- Interfaz de panel izquierdo y mapa con cuatro cartografías, atribuciones y aviso de fallo de teselas.
- GPX real de tracks y rutas, con namespaces, varios archivos, varios tramos y originales conservados.
- Biblioteca y superposición de rutas, clasificación, búsqueda, distancias, desnivel y perfiles iniciales.
- Segmentos de la zona visible, colores, hover, selección persistente al desplazar el mapa, ocultar y añadir copias al borrador.
- Biblioteca de demostración expresamente sintética, no apta para seguirla en campo.
- Dibujo libre, arrastre del punto activo, eliminación, recorte, división, inversión, reordenación y duplicación. Deshacer/rehacer del borrador.
- Guardado automático IndexedDB, snapshots de proyectos incompletos, recuperación al recargar y copias JSON que se añaden sin destruir datos.
- Revisión y descarga GPX 1.1, marcadores de avisos y aceptación explícita de advertencias.

Verificación inicial:
- Compilación de producción correcta; bundle local menor que el anterior y sin cargar Supabase.
- Diez pruebas Playwright pasaron en Chrome real: carga de las cuatro cartografías desde internet, selección, importación multitramos, original descargado idéntico, superposición, arrastre, operaciones de edición, versiones, exportación parseable, dibujo, copia recuperable, geometría, rechazo de entradas inválidas y pantalla móvil. También se verificaron el cambio geográfico con selección fuera de vista, la recuperación de borradores vacíos y el bloqueo de exportación incompleta.
- Se encontró y corrigió un aviso que tapaba el botón de exportación.
- Revisión visual de la interfaz y mapa IGN realizada en navegador.
- Conservación byte a byte comprobada también para originales UTF-8 con BOM y UTF-16. Se guarda base64 junto al texto interpretado para que las copias JSON conserven esos bytes.
- Verificación final: npm run lint sin avisos; npm run build correcto; npm test, 10/10; npm audit --omit=dev, cero vulnerabilidades detectadas. El arranque de doble clic se ejecutó contra el servidor activo y abrió el navegador.

Pendiente tras esta entrega:
1. Completar editor: insertar puntos en trazados existentes, unión explícita, variantes y herramientas más cómodas de selección.
2. Mejorar comparación: eje por distancia acumulada y perfiles superpuestos, coincidencias y variantes.
3. Versionado formal y dependencias; adaptación selectiva de rutas sin sobrescribir versiones.
4. Validación de solapamientos parciales, saltos internos y ayuda de sentido/orden; comprobación exhaustiva de GPX.
5. PostgreSQL/PostGIS local, migraciones e importación de los datos provisionales; Neon/Vercel solo con autorización.
6. Pruebas de volumen, accesibilidad más completa y mejora incremental del diseño.

Limitaciones y decisiones: docs/ARQUITECTURA.md. Uso: README.md. El guardado es local a este navegador y dirección; conviene descargar copias. No hay publicación, push ni conexiones de producción.

## Ajuste visual: prioridad al mapa

Cabecera reducida a 52 px (48 en móvil), eliminada la barra «Explora. Selecciona. Conecta.» y pie del borrador reducido a 46 px (44 en móvil). Se conserva el acceso al borrador en el panel izquierdo y el botón de revisión/exportación en el pie. Sin cambios en datos ni edición.

Verificado con lint, compilación y tres pruebas de disposición en Chrome (1280×577, 1440×950 y 390×844), incluidos acceso al borrador y revisión. Revisión visual adicional en navegador: mapa de 479 px de altura en una ventana de 577 px.

## Panel de biblioteca plegable

Botón permanente «☰» en la cabecera para ocultar y volver a mostrar el panel. El mapa ocupa todo el ancho disponible; en móvil recupera además el espacio vertical del panel. La selección, pestaña activa y borrador se mantienen. ResizeObserver actualiza el tamaño de Leaflet sin remontar el mapa.

Verificado: lint y compilación correctos; cinco pruebas de interfaz en Chrome, incluidas ocultación y reapertura en escritorio y móvil sin perder selección ni borrador. Revisión visual: mapa de 1280 px en ventana de 1280 px con panel oculto.

## Editor visual inspirado en gpx.studio

Corrección posterior: al reabrir el editor después de recargar, el borrador se conservaba pero no había tramo activo y no aparecían anclas. «Editar rutas» selecciona ahora el tramo activo válido o el primero, lo centra y abandona la revisión si estaba abierta. Prueba de regresión con GPX importado, recarga, reapertura y arrastre sin alterar el original. Lint, build y nueve pruebas del editor correctos.

Revisadas la aplicación real y las guías oficiales de edición, recorte y unión. Sustituido el flujo principal basado en índices por herramientas sobre el mapa: anclas arrastrables, inserción entre puntos, menú contextual, tijeras y recorte previo mediante perfil y controles Inicio/Final. «Editar copia» abre directamente una ruta importada sin modificar su original. Guardar una selección crea un segmento sin recortar el borrador. Modo «Mover mapa» y Escape evitan prolongaciones involuntarias al terminar el dibujo.

Corregidos el clic residual tras arrastrar y el indicador de persistencia de revisiones pendientes. Los controles muestreados según zoom no simplifican los puntos GPS almacenados. El dibujo y las modificaciones siguen siendo geométricos, sin ajuste automático a caminos: no se afirma equivalencia completa con gpx.studio.

Verificación final: npm run lint y npm run build correctos; npm test, 23/23 pruebas en Chrome, incluidas edición táctil, arrastre, inserción, un paso de deshacer por gesto, recorte, creación de segmento, división, originales byte a byte, guardado/recarga y cartografías reales. Revisión visual adicional del editor y recorte en navegador. Uso y límites: docs/EDITOR_VISUAL.md. Sin publicación ni push.
