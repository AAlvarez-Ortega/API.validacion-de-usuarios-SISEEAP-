import { supabase } from "./coneccionSB.js";
export function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "—";
}
export function showSession(session) {
  text("nombreUsuario", session.nombre);
  text("rolUsuario", nombreRol(session));
  text("escuelaUsuario", session.rol === "administrador_aplicacion"
    ? "Todas las escuelas" : `${session.escuela.siglas} · ${session.escuela.cct}`);
  text("alcanceSolicitudes", session.rol === "administrador_aplicacion"
    ? "Los conteos corresponden a todas las escuelas. Cada solicitud requiere revisión del responsable antes de cambiar su estado."
    : "Los conteos corresponden a tu escuela. Cada solicitud requiere revisión del responsable antes de cambiar su estado.");
  document.body.dataset.ready = "true";
}
export function nombreRol(session) {
  return session.rol === "administrador_aplicacion"
    ? "Administrador de la aplicación" : "Director de escuela";
}
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  const button = document.getElementById("btnLogout");
  button.disabled = true;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) { text("mensajePanel", "No se pudo cerrar sesión. Intenta de nuevo."); button.disabled = false; return; }
  location.replace("./index.html");
});
export function fecha(value) {
  return value ? new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
