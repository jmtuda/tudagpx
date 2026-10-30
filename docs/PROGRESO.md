# Progreso

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
