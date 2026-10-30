# Despliegue privado en Neon y Vercel

Proyecto Vercel: `jmtuda/tudagpx`. URL estable: https://tudagpx.vercel.app.
Proyecto Neon: `ancient-bar-91390962` (`tudagpx`), rama `production`, PostgreSQL 18, Frankfurt.

El propietario autorizó la publicación y eligió acceso exclusivo de `jmtuda@gmail.com`. Neon Auth está habilitado. El acceso habitual usa correo y contraseña; la confirmación inicial y la recuperación utilizan códigos de correo. La API comprueba en Neon la sesión y el correo verificado en cada lectura/escritura. Contraseñas, códigos y tokens no se devuelven en las respuestas de la API ni se registran. Las cookies son HttpOnly del proveedor, reenviadas con ámbito del dominio de la aplicación. Las operaciones mutables requieren el origen exacto de producción.

## Persistencia

- `api/session.js`: acceso con contraseña, confirmación inicial, recuperación, estado y cierre de sesión. Restringido al correo del propietario.
- `server/private.js`: comprobación de sesión, propietario, origen y cookies.
- `api/workspace.js`: lectura y guardado autenticados. Valida el modelo y conserva originales y versiones de proyectos. Guarda revisiones completas e inmutables en `tudagpx_workspace_versions`, con control optimista para evitar sobrescritura entre dispositivos. El reconocimiento del guardado requiere releer la revisión insertada.
- `migrations/001_workspace.sql`: tabla inicial, aditiva; no elimina ni reemplaza datos.
- `src/utils/cloudStore.js`: cliente de persistencia remota; solo activo en builds con `VITE_CLOUD_ENABLED=true`. La modalidad local sigue funcionando sin cuenta y sin conexión a Neon.
- La aplicación publicada conserva una copia en IndexedDB del mismo navegador como protección adicional. No interpreta el fallo remoto como un guardado correcto. Al recargar, Neon es la fuente de verdad; ante error de lectura no inicializa ni sobrescribe con datos demo.

Variables de producción: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `OWNER_EMAIL`, `VITE_CLOUD_ENABLED`. Las tres primeras están almacenadas como secretos en Vercel; ninguna credencial de base de datos se incorpora al bundle. No añadir `VITE_` a secretos. `.vercelignore` excluye archivos de entorno y contexto local. La vinculación CLI añadió `.vercel` y un archivo de entorno ignorado; no versionarlos.

## Límites de esta primera persistencia remota

El modelo continúa siendo un documento JSON por revisión, no todavía tablas geográficas normalizadas ni consultas PostGIS. Cada revisión añade una copia completa: vigilar almacenamiento. La transferencia se fragmenta tanto al subir como al descargar: partes de 128.000 caracteres y hasta 1.024 partes, sin separar parejas Unicode. `migrations/002_upload_parts.sql` añade almacenamiento temporal; el servidor no confirma ninguna revisión hasta reunir, validar e insertar el documento completo. Solo se eliminan partes temporales de una carga confirmada, nunca originales ni snapshots. Las partes interrumpidas se conservan por ahora. No hay política de borrado automático de versiones. Los conflictos exigen descargar el trabajo local antes de recargar.

`src/utils/workspaceTransfer.js` reconoce respuestas HTTP no JSON, incluidos rechazos 413 de la plataforma. `server/workspaceTransport.js` mantiene comprobaciones de originales/versiones y cargas incompletas. La descarga fija la revisión para no mezclar partes de guardados concurrentes.

Regresión real con `node scripts/test-cloud-transport.mjs`: cliente y manejador de producción, SQL real de Neon, identificador sintético exclusivo y eliminación verificada solo de esos registros de prueba. Documento de 6.183.655 bytes guardado y recuperado íntegro; peticiones y respuestas inferiores a 162 KB en esta prueba, originales exactos. Incluye interrupción, conflicto, inmutabilidad, Unicode y errores no JSON. Esta prueba de integración no sustituye una prueba de acceso con la sesión privada del propietario.

## Migración desde la web local

Los datos locales siguen en el origen `http://127.0.0.1:5173` y no se borran. La web publicada tiene otro origen: no puede leer ese IndexedDB directamente. Utilizar la descarga de copia completa de la aplicación local y la importación aditiva de esa copia tras iniciar sesión en la web publicada. Comparar número de originales, bytes base64, segmentos, borrador y snapshots, y volver a leer desde Neon antes de declarar la migración terminada.

## Verificación realizada y pendiente

- CLI autenticadas y proyectos existentes identificados; no se creó ningún proyecto alternativo.
- Antes de la migración, el esquema público del proyecto Neon no contenía tablas. Tabla nueva creada y releída con cero revisiones.
- Despliegue de producción completado y dominio estable accesible.
- API real sin sesión: 401 tanto en sesión como biblioteca. Solicitud de otro origen: 403. Pantalla de acceso real comprobada y envío de código de Neon confirmado.
- Lint y build correctos; las 44 pruebas existentes de Chrome pasan en la modalidad local.
- El primer código de acceso introducido fue rechazado por Neon (`INVALID_OTP`). Se solicitó otro; el formulario seguro del runtime no pudo abrirse (`supervisor is not active`). Pendiente que el propietario complete el acceso en Chrome para comprobar guardado/recuperación autenticados y transferir los datos locales. No declarar estos dos pasos verificados hasta completarlos.
