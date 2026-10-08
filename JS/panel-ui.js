import { supabase } from "./coneccionSB.js";
export function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "—";
}
export function showSession(session) {
  text("nombreUsuario", session.nombre);
  text("escuelaUsuario", `${session.escuela.siglas} · ${session.escuela.cct}`);
  document.body.dataset.ready = "true";
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
