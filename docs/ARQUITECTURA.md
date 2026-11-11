# Arquitectura de la primera versión local

## Ficha, metadatos, ordenación y waypoints

Rutas/segmentos admiten `completed?: boolean` y `description?: string`, con valores visuales por defecto false/vacío en legacy, sin migrar los originales. La edición de ficha solo escribe esos campos y el diff incremental no retransmite GPX, geometrías ni waypoints. La descripción se lee de trk/rte.desc o metadata.desc al importar; al guardar una ruta editada se exporta como trk.desc. La descarga del original permanece exacta. Nuevos guardados empiezan pendientes, sin asumir que una copia de un recorrido realizado también lo esté.

Pulsar el cuerpo/nombre de una tarjeta abre RouteDetails dentro de Ver rutas y restringe únicamente las capas/perfil de presentación, conservando selección/filtros/borrador y el mismo Leaflet. Hash privado `#recorrido/id`, navegación history y retorno a la vista general. Los checkbox y acciones de tarjeta no abren detalle. Ordenación exclusivamente derivada en libraryOrder.js, cuatro modos con Intl.Collator español estable y numérico. La posición en el array persistido es el orden de inclusión, también para registros sin fecha. Preferencias locales por categoría; no se reordenan registros guardados ni índices que asignan colores. Menú fijo recolocado arriba/abajo dentro del viewport para ser utilizable con filtros abiertos en móvil.

`waypoints?: [{id,lat,lon,ele?,name,description}]` en biblioteca y borrador. Validación de tipos, coordenadas, elevación finita e IDs únicos por array. En editor, agrupación por editorRouteId || id; escritura canónica solo en el primer elemento del archivo. Copias generan IDs nuevos; upsert/remove son inmutables y entran en el historial de sesión. Restaurar JSON remapea IDs por archivo preservando referencias repetidas internas. Exportación deduplica por grupo+ID, no entre archivos independientes que compartan un ID. WaypointLayer dibuja marcadores accesibles/readOnly en visor, y activa colocación sin editar trackpoints ni utilizar enrutamiento. Los clics de las líneas se propagan al mapa solo en ese modo. Popup con espacio reservado a la barra de herramientas; diálogo exige descripción y confirma borrado a través del padre.

Parser/serializador usan wpt raíz, name/desc escapados y elevación solo cuando existe. El GPX generado se vuelve a parsear y comprueba número de tramos, puntos y waypoints. Recortar conserva anotaciones de archivo; dividir copia las del grupo; unir recoge las de los grupos seleccionados. No se eliminan anotaciones automáticamente por distancia al trazado. Legacy sin campo waypoints/description puede recuperar esos datos del XML original solo para mostrar/copiar, sin escrituras de migración ni cambios a sus bytes.

Migración 005 añade validación metadata/waypoints y extiende inmutabilidad de originales conservados a todo su array de waypoints (incluidos nombre/descripción). Cambiar estos puntos exige nueva identidad. Mantiene current-only-v1, un head, remove explícito, bloqueo por owner, versión optimista y ensamblado/validación íntegros en PostgreSQL. Solo definiciones: no rellena defaults ni cambia payloads actuales. `scripts/test-metadata-cloud.mjs` prueba fixtures pequeñas reales y limpia solo sus registros sintéticos; sin --migrate verifica las definiciones vigentes y no las reinstala. No reaplicar 003/004 encima de 005. Inspección agregada vigente: `scripts/inspect-cloud-size.mjs` verifica las siete funciones efectivas.

## Política vigente: solo estado actual

Por confirmación expresa del propietario, se conserva únicamente la biblioteca visible y el trabajo abierto del editor. Borrado de biblioteca físico con confirmación, sin deletedAt/papelera. Originales conservados siguen inmutables; el protocolo permite eliminaciones explícitas por id con patch.remove, pero no alterar geometrías de otros registros. Cada guardado remoto conserva solo el último estado, manteniendo versión monotónica y control de conflictos. No se crean proyectos/snapshots ocultos. Las copias JSON antiguas recuperan esos proyectos como trabajo visible adicional.

Migración local limpia tombstones, backups internos cloud-before-incremental y cachés confirmadas de la política anterior; conserva pendientes recuperables y expone proyectos antiguos en el editor. Al confirmar una sincronización se actualizan las cachés confirmadas antiguas en lugar de guardar estados históricos. policy=current-only-v1 impide que clientes antiguos reintroduzcan historial/papelera. Las descargas por partes reintentan si una escritura concurrente sustituye la revisión leída. La nueva política sustituye las referencias históricas a append-only/borrado lógico que figuran más abajo.

## Sincronización privada incremental

La web mantiene una base confirmada y trabajo pendiente en IndexedDB, ligados al owner autenticado. Los pendientes se aíslan por pestaña; una confirmación de otra pestaña no los pisa. No se archivan copias internas anteriores. En una recarga se consulta metadata (versión/owner/partes); si la versión no cambia se reutiliza la caché, sin descargar la biblioteca. Un conflicto conserva el trabajo exportable y bloquea la sobreescritura, sin mezcla silenciosa.

workspacePatch.js compara campos y envía solo cambios de registros por id y/o draft/draftName; no reenvía originales intactos ni snapshots previos. syncScheduler.js agrupa durante 3 s de pausa, con plazo máximo de 15 s, una petición en curso y solo el último estado pendiente. Guardado local inmediato independiente de la red; estado pendiente no equivale a Guardado en Neon. No se escribe al hidratar sin cambios.

Las migraciones 003/004 mantienen ensamblado multipart, validación, comparación de originales y commit dentro de PostgreSQL. Bloqueo por owner y revisión optimista; retorna solo la versión confirmada, conservando una sola revisión. No se descargan payload anterior ni fragmentos al servidor al guardar. La primera apertura en un dispositivo sin caché, o una revisión remota nueva, todavía necesita descargar el estado completo por partes; no hay descarga diferencial entre dispositivos en esta entrega.

Verificación: node --test scripts/test-sync-client.mjs server/incrementalSync.test.js; node scripts/test-incremental-cloud.mjs (fixture sintética pequeña real); scripts/inspect-cloud-size.mjs solo retorna agregados y verifica definiciones SQL exactas. No ejecutar el antiguo test grande contra producción para revisar este ahorro. Ninguna prueba nueva descarga la biblioteca propietaria.

## Reutilización

Se mantienen React, Vite, Leaflet y react-leaflet. MapaBase.jsx conserva los cuatro servicios de teselas originales y las atribuciones. Se han corregido el selector accesible, una propiedad de estilo y el sobrezoom.

PNOA incorpora la capa PNG transparente IGNBaseOrto del WMTS oficial de IGN Base, por encima de la fotografía pero debajo de rutas/anclas. Mostrar nombres y referencias está activado inicialmente y se puede desactivar desde el selector; preferencia local tudagpx-pnoa-references. No se aplica a las otras bases. No modifica la ortofoto, los GPX ni el almacenamiento de biblioteca/borrador. Los errores de referencias se avisan por separado sin retirar las fotos.

La implementación anterior de Supabase sigue en src/App.jsx, src/components y src/utils/gpxParser.js, recuperable también en main. No se ejecuta desde main.jsx: evita cuentas, llamadas al backend anterior y cambios sobre datos existentes. No se han consultado credenciales ni conectado servicios de producción.

## Aplicación local

- LocalApp.jsx: biblioteca, selección, historial del borrador, importación, comparación básica, proyectos y revisión.
- components/WorkspaceMap.jsx: capas de rutas/segmentos/borrador, límites de vista y coordinación del mapa.
- components/DirectTrace.jsx: anclas visibles según zoom, previsualización del arrastre, inserción y menú de puntos.
- components/ViewerLibrary.jsx y utils/viewerLibrary.js: biblioteca fija exclusiva del visor con Rutas/Segmentos; fichas, mapa y perfiles comparten identidades, tracks y colores sin cambiar el modelo persistido.
- components/EditorTools.jsx: barra única de iconos y cuadros mínimos: Seguir caminos o sliders de recorte; sin biblioteca del editor.
- components/ElevationProfile.jsx: perfil compartido visor/editor, superposición por distancia real, métricas y colores por ruta, inspección y selección de recorte inferior. No une tracks ni inventa cotas ausentes.
- utils/editorGeometry.js: muestreo visual, proyección sobre aristas, división y distancias acumuladas del perfil de recorte.
- utils/routing.js: cliente BRouter sin claves, perfiles comprobados en el servidor oficial y sustitución local de geometría entre anclas vecinas.
- utils/workspace.js: geometría, métricas, parser GPX, serialización GPX, revisión y validación de copias.
- utils/localStore.js: IndexedDB y descargas.
- utils/gpxFiles.js: lectura de codificación XML y conservación de bytes originales en base64, incluidos BOM y UTF-16.
- workspace.css: interfaz adaptativa. index.css conserva estilos anteriores.

## Datos e invariantes

Una base IndexedDB, tudagpx-local-v1, almacena un documento schema=1 mediante transacciones atómicas. Contiene rutas con trazados separados, segmentos, borrador, nombre y snapshots de proyectos. El guardado de revisiones se encola para evitar escrituras fuera de orden. La interfaz muestra fallos; si la lectura o validación inicial falla, no reemplaza los datos por demostraciones.

Cada ruta importada conserva los bytes originales en base64 (también en las copias JSON), el XML interpretado como texto, nombre del archivo y fecha. Los puntos usados por biblioteca y editor se copian: no se comparten como objetos mutables. Los puntos sin elevación usan null, no cero. Los tracks y rutas GPX mantienen sus límites; las métricas no suman saltos entre tramos. No se hacen llamadas de geocodificación ni se envían GPX a servidores.

La biblioteca está fija en el visor y ofrece Rutas/Segmentos. El editor no tiene biblioteca. Enviar al editor desde ficha/popup carga copias con nueva identidad y procedencia sourceRouteId/sourceId. El botón Importar GPX y drop del visor añaden originales a la biblioteca. El drop del editor usa la misma lectura validada, pero solo añade copias a draft, agrupadas por archivo y sin referencias a originales inexistentes en la biblioteca. Nunca modifica routes/segments ni el archivo del ordenador. Su guardado en biblioteca requiere la acción explícita Guardar ruta/segmento. La página arranca siempre en view, sin leer/escribir la preferencia anterior de pestaña. El borrador se recupera al abrir Editar y se guarda automáticamente incluso incompleto. Restaurar JSON sigue siendo aditivo, con remapeo de identidades, sin sustituir trabajo actual ni snapshots. No hay borrado físico de originales ni de versiones.

## Geografía y edición

El visor muestra rutas y segmentos que cruzan el rectángulo visible incluso si no hay vértices dentro. La selección unificada es independiente de filtros y categoría y se comparte con los perfiles y el botón de centrar sobre el mapa. Referencias grises; seleccionadas, de colores. El editor dibuja solo copias del trabajo abierto; todas las líneas son continuas, también las inactivas. No hay referencias de biblioteca que se carguen al pulsarlas en el editor.

El editor no exige continuidad entre elementos separados. Seguir caminos es el modo inicial; el modo libre opcional genera rectas y mover un punto elimina su elevación anterior. El cálculo BRouter se hace al confirmar el gesto, no en cada movimiento: extensión desde el extremo o recálculo local entre las anclas visibles vecinas al mover/insertar/eliminar un ancla interior. No se recalcula el GPX entero al abrirlo. Los puntos ajenos a la ventana editada se conservan, así como los originales. Los puntos de geometría calculada llevan routeSample para no convertir cada muestra en una ancla; las anclas de paso se conservan separadas de esas muestras. La elevación del servicio se usa solo si está disponible.

Cada cálculo tiene AbortController, tiempo máximo por petición y comprobación de geometría y proximidad de extremos (100 m). Mientras calcula no se aceptan nuevos arrastres/clics de extensión. Cancelar, cambiar modo/perfil, retirar permiso o modificar datos invalida el trabajo pendiente; una respuesta tardía no sustituye el borrador. Un cálculo completado equivale a una operación de deshacer. Los errores conservan el trazado, sin fallback silencioso a rectas.

La edición visual replica patrones documentados de gpx.studio con implementación propia: anclas arrastrables, puntos de inserción, menú contextual, tijeras y recorte con selección previa. El muestreo de anclas en pantalla no simplifica los puntos almacenados. Cada gesto de arrastre es una sola operación de historial; la vista previa es local al componente. Se suprime el clic residual al soltar para no añadir puntos accidentales. El recorte no escribe hasta confirmar; guardar su selección crea un segmento nuevo sin modificar el borrador. El perfil de recorte sí usa distancia acumulada; los perfiles comparativos anteriores siguen usando índice de puntos. Decisiones y referencias: docs/EDITOR_VISUAL.md.

El estado «Guardando…» se establece al solicitar un cambio y la revisión se invalida inmediatamente, antes de esperar al efecto de persistencia. Así una escritura anterior no puede mostrar «Guardado» para un cambio nuevo todavía pendiente.

## Revisión y exportación

Las comprobaciones detectan borrador vacío, tramos con menos de dos puntos, coordenadas inválidas, huecos mayores de 30 m entre elementos, elevación ausente y aristas iguales a seis decimales, también invertidas. Los avisos geográficos se marcan en el mapa. Las advertencias requieren aceptación; los errores bloquean exportación. Se serializa GPX 1.1 con escape XML y un trkseg por elemento; se vuelve a parsear antes de descargar. Nunca se trazan conectores automáticamente.

No es todavía un validador exhaustivo: solapamientos parciales, saltos dentro de un tramo y sentido/orden incorrectos requieren revisión visual. El perfil comparativo usa distancia geodésica acumulada, ejes comunes y colores idénticos a las líneas del mapa; no añade distancia entre tracks ni subida a través de datos de elevación ausentes. En recorte el gráfico y las métricas usan exclusivamente la selección, con una franja de dominio completo estable para modificar sus extremos.

## Privacidad y límites

Los mapas IGN/OSM conocen las teselas solicitadas. El cálculo por caminos utiliza https://brouter.de/brouter, permitido por defecto por autorización expresa del propietario y revocable durante la sesión: envía solo coordenadas de las anclas y perfil, sin archivo GPX, nombres, cookies ni referrer. Registra un perfil propio sin datos personales mediante POST /brouter/profile; caché de ID en memoria durante 15 minutos. Perfil genérico sin penalizaciones de firme ni desnivel, compartido por dibujo/edición/unión; puede usar pasos peatonales, no garantiza ciclabilidad. Registro y cálculo comparten señal de cancelación y límite temporal; fallos preservan el trabajo. El modo libre no llama a BRouter y sigue disponible sin internet. El servidor local escucha exclusivamente en loopback. Los datos locales pertenecen al origen http://127.0.0.1:5173; localhost o un puerto distinto tienen otro almacenamiento. La preferencia caminos/libre se conserva en tudagpx-routing-mode-v3; el permiso empieza autorizado al recargar. La publicación privada y Neon se documentan en docs/DESPLIEGUE.md.

La importación admite varios archivos de hasta 25 MB cada uno; no se ha optimizado aún el rendimiento de trazados enormes. No hay autenticación porque es un usuario local. No debe publicarse esta modalidad como aplicación multiusuario.

## Evolución sin migración prematura

El modelo está separado del proveedor de almacenamiento. La siguiente persistencia será una API privada y PostgreSQL/PostGIS con geometría indexada, migraciones versionadas y originales inmutables. Neon se conectará únicamente desde servidor con secretos privados y autorización del propietario. Vercel es el destino futuro, no se ha desplegado nada. No se ha instalado Docker ni desplegado una base innecesaria para esta primera prueba visual.

El versionado avanzado deberá registrar identidades estables, revisiones y referencias explícitas ruta–versión de segmento; avisar dependencias y adaptar selectivamente creando nuevas versiones. Los snapshots actuales son conservación local, no sustituyen ese sistema completo.
