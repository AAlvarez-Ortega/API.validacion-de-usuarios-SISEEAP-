El panel requiere la migración `008-corregir-solicitudes.sql` sobre App-SISAEP con las migraciones previas de registro, panel, seguridad y cuatro roles ya instaladas.

La migración permite corregir solicitudes pendientes y reenviar rechazadas usando el comprobante privado del dispositivo. Una solicitud aceptada conserva su identidad. Las correcciones y revisiones se guardan en tablas privadas; boleta, correo y CURP son únicos entre solicitudes activas. El rechazo permite un nuevo intento.

El listado devuelve diagnósticos separados para padrón y cuenta: registro faltante, datos diferentes (solo nombres de campos), múltiples candidatos, correo sin confirmar o perfil faltante. No devuelve valores de otros registros. La aprobación sigue requiriendo una cuenta confirmada coincidente; esta migración no crea cuentas.

El panel revisa la versión que mostró al responsable. Un cambio posterior devuelve HTTP 409 y exige actualizar la lista. Los clientes anteriores solo pueden revisar la primera versión de una solicitud.

Pruebas SQL: ejecutar `tests/correcciones.sql` desde una sesión administrativa; terminan con ROLLBACK. Pruebas de mensajes del panel: `node --test tests/validacion-solicitud.test.mjs`.
