// ./JS/pantallaSolicitudes/verificarRegistro.js
import { supabaseApp } from "../coneccionSB_App.js"; // ✅ App-SISAEP (validación + Auth)

function norm(s = "") {
  return String(s).trim().toUpperCase();
}

function genPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function datosCoinciden(solicitud, padron) {
  return (
    norm(solicitud.nombre) === norm(padron.nombre) &&
    norm(solicitud.apellido_paterno) === norm(padron.apellido_paterno) &&
    norm(solicitud.apellido_materno) === norm(padron.apellido_materno) &&
    norm(solicitud.curp) === norm(padron.curp) &&
    norm(solicitud.correo) === norm(padron.correo) &&
    String(solicitud.boleta_o_empleado || "").trim() === String(padron.boleta_o_empleado || "").trim()
  );
}

/**
 * solicitud viene desde SISAP.solicitudes con join escuelas(cct)
 */
export async function verificarRegistro(solicitud) {
  const cct = solicitud?.escuelas?.cct;
  const boletaOEmpleado = String(solicitud?.boleta_o_empleado || "").trim();
  const email = String(solicitud?.correo || "").trim().toLowerCase();

  if (!cct) return { ok: false, reason: "AUTH_ERROR", error: "Falta CCT en la solicitud (incluye escuelas.cct en el select)." };
  if (!boletaOEmpleado) return { ok: false, reason: "AUTH_ERROR", error: "Falta boleta_o_empleado en la solicitud." };
  if (!email) return { ok: false, reason: "AUTH_ERROR", error: "Falta correo en la solicitud." };

  // 1) Buscar en padrón (App-SISAEP.App_Solicitudes)
  const { data: padron, error: padronErr } = await supabaseApp
    .from("App_Solicitudes")
    .select("id, nombre, apellido_paterno, apellido_materno, boleta_o_empleado, correo, curp, escuela_cct")
    .eq("boleta_o_empleado", boletaOEmpleado)
    .eq("escuela_cct", cct)
    .limit(1)
    .maybeSingle();

  if (padronErr) {
    console.error(padronErr);
    return { ok: false, reason: "AUTH_ERROR", error: "Error consultando App_Solicitudes." };
  }

  if (!padron) return { ok: false, reason: "NO_EXISTE_PADRON" };

  // 2) Comparar datos
  if (!datosCoinciden(solicitud, padron)) {
    return { ok: false, reason: "DATOS_NO_COINCIDEN" };
  }

  // 3) Crear usuario en Auth (App-SISAEP)
  const password = genPassword(12);

  const { data: signUpData, error: signUpErr } = await supabaseApp.auth.signUp({
    email,
    password,
    options: {
      // ✅ Esto viaja a la plantilla del correo (Email Template)
      data: {
        temp_password: password,
        mensaje: "Credenciales de acceso. Sugerencia: se recomienda cambiar contraseña.",
        nombre: solicitud.nombre,
        apellido_paterno: solicitud.apellido_paterno,
        apellido_materno: solicitud.apellido_materno,
        boleta_o_empleado: boletaOEmpleado,
        curp: solicitud.curp,
        escuela_cct: cct
      }
    }
  });

  if (signUpErr) {
    console.error(signUpErr);

    // típico: "User already registered"
    if ((signUpErr.message || "").toLowerCase().includes("already")) {
      return { ok: false, reason: "EMAIL_YA_EXISTE" };
    }
    return { ok: false, reason: "AUTH_ERROR", error: signUpErr.message };
  }

  return {
    ok: true,
    email,
    password,
    userId: signUpData?.user?.id || null
  };
}
