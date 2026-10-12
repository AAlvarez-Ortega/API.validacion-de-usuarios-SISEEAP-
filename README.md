# Panel administrativo de App-SISAEP

Sitio HTTPS: https://aalvarez-ortega.github.io/API.validacion-de-usuarios-SISEEAP-/

GitHub Pages publica HTML, CSS y JavaScript desde la rama main. Supabase App-SISAEP mantiene la autenticación, los datos y la autorización administrativa. El cliente contiene únicamente la clave publicable; nunca deben añadirse claves secretas, contraseñas ni tokens administrativos.

Hay cuatro roles: administrador de la aplicación (4), director de escuela (3), maestro (2) y alumno (1). El panel admite solamente administradores de la aplicación y directores con permisos asignados en el servidor. El administrador consulta todas las escuelas; el director consulta su escuela. La interfaz muestra el rol y el alcance, permite filtrar solicitudes, revisar coincidencias, aceptar o rechazar pendientes y consultar el perfil. Las revisiones exigen confirmación humana y quedan auditadas en Supabase. Maestro y alumno no acceden al panel; los privilegios se asignan exclusivamente en el servidor.

La configuración _config.yml excluye las páginas de registro y los módulos antiguos del sitio publicado. Los archivos se conservan en Git para mantener el historial. No añadir .nojekyll: desactivaría estas exclusiones.

Los enlaces y módulos son relativos para funcionar dentro de la ruta del repositorio. La sesión utiliza sessionStorage de la pestaña. Las páginas incluyen una política CSP y Referrer-Policy mediante etiquetas meta; GitHub Pages no permite configurar todos los encabezados HTTP del servidor local, incluido frame-ancestors.

La API administrativa y sus reglas de acceso fueron validadas en Supabase. La migración incremental de cuatro roles incluye 14 pruebas con ROLLBACK para verificar alcance global, aislamiento escolar, auditoría, concurrencia y bloqueo de autoascenso. No volver a ejecutar las migraciones iniciales sobre el proyecto operativo.
