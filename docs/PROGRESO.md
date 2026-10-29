# Progreso

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
