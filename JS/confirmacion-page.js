// El enlace ya fue verificado por Supabase. Esta página no conserva sus tokens.
const params = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
const error = params.has("error") || query.has("error");
const confirmado = params.has("access_token") && !error;
history.replaceState(null, "", location.pathname);
if (error) document.getElementById("confirmacionMensaje").textContent = "No se pudo confirmar el correo: el enlace puede haber caducado o haberse usado. Solicita una nueva confirmación y vuelve a intentarlo.";
else if (confirmado) document.getElementById("confirmacionMensaje").textContent = "Correo confirmado. Abre App-SISAEP e inicia sesión con la contraseña que elegiste.";
