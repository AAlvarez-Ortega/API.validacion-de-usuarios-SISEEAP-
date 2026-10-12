import { requireAdmin, rpc, mensajeError } from "./panel-api.js";
import { text, showSession, nombreRol } from "./panel-ui.js";
try {
  const session = await requireAdmin();
  showSession(session);
  if (document.getElementById("contadorPendientes")) {
    const data = await rpc("sisaep_admin_solicitudes", { p_estado: null, p_limite: 1 });
    text("contadorPendientes", data.totales.pendientes);
    text("contadorAceptados", data.totales.aceptados);
    text("contadorRechazados", data.totales.rechazados);
    text("mensajePanel", session.rol === "administrador_aplicacion"
      ? "Solicitudes actualizadas de todas las escuelas." : "Solicitudes actualizadas de tu escuela.");
  }
  if (document.getElementById("uNombreCompleto")) {
    text("uNombreCompleto", session.nombre);
    text("uCorreo", session.correo);
    text("uRol", nombreRol(session));
    text("uEscuela", session.rol === "administrador_aplicacion" ? "Todas las escuelas" : session.escuela.nombre);
  }
} catch (error) { text("mensajePanel", mensajeError(error)); }
