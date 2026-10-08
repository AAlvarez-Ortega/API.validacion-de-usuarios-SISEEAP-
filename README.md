# Panel administrativo de App-SISAEP

Sitio HTTPS: https://aalvarez-ortega.github.io/API.validacion-de-usuarios-SISEEAP-/

GitHub Pages publica HTML, CSS y JavaScript desde la rama main. Supabase App-SISAEP mantiene la autenticación, los datos y la autorización administrativa. El cliente contiene únicamente la clave publicable; nunca deben añadirse claves secretas, contraseñas ni tokens administrativos.

El inicio de sesión exige una cuenta de director con alcance administrativo asignado en el servidor. La interfaz permite consultar los conteos de la escuela, filtrar solicitudes, revisar coincidencias, aceptar o rechazar solicitudes pendientes y consultar el perfil. Las revisiones exigen confirmación humana y quedan auditadas en Supabase. No se asignan privilegios desde el navegador.

La configuración _config.yml excluye las páginas de registro y los módulos antiguos del sitio publicado. Los archivos se conservan en Git para mantener el historial. No añadir .nojekyll: desactivaría estas exclusiones.

Los enlaces y módulos son relativos para funcionar dentro de la ruta del repositorio. La sesión utiliza sessionStorage de la pestaña. Las páginas incluyen una política CSP y Referrer-Policy mediante etiquetas meta; GitHub Pages no permite configurar todos los encabezados HTTP del servidor local, incluido frame-ancestors.

La API administrativa y sus reglas de acceso fueron validadas en Supabase. La prueba completa de la interfaz con una cuenta real de director sigue pendiente. No volver a ejecutar las migraciones iniciales sobre el proyecto operativo.
