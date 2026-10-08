import { supabase } from "./coneccionSB.js";
import { rpc, mensajeError } from "./panel-api.js";
const form = document.getElementById("formInicioSesion");
const message = document.getElementById("mensajeFormulario");
const button = document.getElementById("btnIniciarSesion");
const password = document.getElementById("contrasena");
message.textContent = sessionStorage.getItem("panel-login-error") || "";
sessionStorage.removeItem("panel-login-error");
document.getElementById("btnOjoContrasena").addEventListener("click", event => {
  password.type = password.type === "password" ? "text" : "password";
  event.currentTarget.textContent = password.type === "password" ? "Mostrar" : "Ocultar";
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  button.disabled = true;
  message.textContent = "Validando acceso…";
  let signedIn = false;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: document.getElementById("correo").value.trim(), password: password.value
    });
    if (error) { message.textContent = "No se pudo iniciar sesión. Revisa el correo, la contraseña y la conexión."; return; }
    signedIn = true;
    await rpc("sisaep_admin_sesion");
    password.value = "";
    location.assign("./inicio.html");
  } catch (error) {
    message.textContent = mensajeError(error);
    if (signedIn) await supabase.auth.signOut({ scope: "local" });
  } finally { button.disabled = false; }
});
