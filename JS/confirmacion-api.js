const authUrl = "https://wdgsvdjojwjebjrpgopn.supabase.co/auth/v1";
const publishableKey = "sb_publishable_TxHT2AsKDXlxYRGh0VgRMw_5VozTQ_p";

async function request(path, body, accessToken) {
  const response = await fetch(`${authUrl}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { apikey: publishableKey, ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000), credentials: "omit", cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("CONFIRMACION_NO_COMPLETADA");
    error.code = data.code || data.error_code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function verificarCodigo(correo, codigo) {
  const email = correo.trim().toLowerCase();
  const token = codigo.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9]{6,10}$/.test(token)) {
    const error = new Error("DATOS_INVALIDOS"); error.code = "datos_invalidos"; throw error;
  }
  const data = await request("verify", { email, token, type: "email" });
  if (!data.user?.email_confirmed_at || data.user.email?.toLowerCase() !== email) {
    throw new Error("CORREO_NO_CONFIRMADO");
  }
  // Auth emite una sesión al verificar; esta página sólo conserva el resultado booleano.
  return true;
}

export async function comprobarEnlace(accessToken) {
  const user = await request("user", undefined, accessToken);
  return !!user.email_confirmed_at;
}

export async function reenviarCodigo(correo) {
  const email = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("CORREO_INVALIDO"); error.code = "datos_invalidos"; throw error;
  }
  await request("resend", { email, type: "signup" });
}

export function mensajeErrorConfirmacion(error) {
  if (error?.code === "datos_invalidos") return "Escribe el correo de tu cuenta y el código numérico completo que recibiste.";
  if (["otp_expired", "otp_disabled", "invalid_credentials"].includes(error?.code)) return "El código o enlace venció, ya fue usado o no corresponde a este correo. Si ya confirmaste tu correo, abre la app e inicia sesión. Si aún está pendiente, reenvía la confirmación y usa sólo el código más reciente.";
  if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(error?.code) || error?.status === 429) return "Se alcanzó el límite temporal de correos. Espera antes de solicitar otro código; tu aprobación se conserva.";
  if (error?.code === "email_address_not_authorized") return "El envío a esta dirección requiere configurar SMTP en Supabase. Tu solicitud aprobada se conserva.";
  return "No se pudo completar la confirmación. Comprueba la conexión. Si ya habías confirmado tu correo, puedes iniciar sesión en la app.";
}
