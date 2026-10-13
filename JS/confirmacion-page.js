import { verificarCodigo, comprobarEnlace, reenviarCodigo, mensajeErrorConfirmacion } from "./confirmacion-api.js";
// Los enlaces anteriores siguen funcionando. Se borran sus tokens antes de cualquier consulta.
const params = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
const error = params.has("error") || query.has("error");
let accessToken = params.get("access_token");
const errorCode = params.get("error_code") || query.get("error_code");
history.replaceState(null, "", location.pathname);
for (const key of ["access_token", "refresh_token", "provider_token", "provider_refresh_token"]) params.delete(key);
const message = document.getElementById("confirmacionMensaje");
const form = document.getElementById("confirmacionForm");
const email = document.getElementById("confirmacionCorreo");
const code = document.getElementById("confirmacionCodigo");
const verify = document.getElementById("btnConfirmarCorreo");
const resend = document.getElementById("btnReenviarCodigo");
let busy = false, confirmed = false, nextResend = 0, timer;
function controls() {
  email.disabled = busy || confirmed;
  code.disabled = busy || confirmed;
  verify.disabled = busy || confirmed;
  const seconds = Math.max(0, Math.ceil((nextResend - Date.now()) / 1000));
  resend.disabled = busy || confirmed || seconds > 0;
  resend.textContent = seconds ? `Reenviar código en ${seconds} s` : "Reenviar código";
  if (!seconds && timer) { clearInterval(timer); timer = undefined; }
}
function success() {
  confirmed = true;
  code.value = "";
  document.getElementById("confirmacionTitulo").textContent = "Correo confirmado";
  message.textContent = "Abre App-SISAEP e inicia sesión con la contraseña que elegiste. No necesitas volver a abrir el enlace ni usar el código otra vez.";
  form.hidden = true;
  controls();
}
if (error) message.textContent = mensajeErrorConfirmacion({ code: errorCode || "otp_expired" });
else if (accessToken) {
  busy = true; controls(); message.textContent = "Comprobando la confirmación…";
  try { if (await comprobarEnlace(accessToken)) success(); else throw Error("CORREO_NO_CONFIRMADO"); }
  catch (e) { message.textContent = mensajeErrorConfirmacion(e); }
  finally { accessToken = null; busy = false; controls(); }
}
form.addEventListener("submit", async event => {
  event.preventDefault(); if (busy || confirmed) return;
  busy = true; controls(); message.textContent = "Verificando el código…";
  try { await verificarCodigo(email.value, code.value); success(); }
  catch (e) { message.textContent = mensajeErrorConfirmacion(e); }
  finally { code.value = ""; busy = false; controls(); }
});
resend.addEventListener("click", async () => {
  if (busy || confirmed || Date.now() < nextResend) return;
  busy = true; controls(); message.textContent = "Solicitando confirmación…";
  try {
    await reenviarCodigo(email.value);
    code.value = ""; nextResend = Date.now() + 60000;
    timer = setInterval(controls, 1000);
    message.textContent = "Si la cuenta está pendiente de confirmación, recibirás un código nuevo. Usa sólo el más reciente. Si ya confirmaste tu correo, inicia sesión en la app.";
  } catch (e) { message.textContent = mensajeErrorConfirmacion(e); }
  finally { busy = false; controls(); }
});
window.addEventListener("pagehide", () => { clearInterval(timer); code.value = ""; });
controls();
