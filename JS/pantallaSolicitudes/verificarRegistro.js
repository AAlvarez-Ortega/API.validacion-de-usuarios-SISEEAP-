// ./JS/pantallaSolicitudes/verificarRegistro.js
import { supabaseApp } from "../coneccionSB_App.js"; // App-SISAEP (validación + Auth)
import { supabase } from "../coneccionSB.js"; // ✅ SISAP (donde vive solicitudes)

/** Normaliza para comparar texto */
function norm(s = "") {
  return String(s).trim().toUpperCase();
}

/** Genera contraseña aleatoria */
function genPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  let out = "";
  for (let i = 0; i < length; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Determina tipo usuario por longitud (10 alumno, 8/9 profesor) */
function getTipoUsuario(boletaOEmpleado) {
  const digits = String(boletaOEmpleado || "").replace(/[^\d]/g, "");
  if (digits.length === 10) return "alumno";
  if (digits.length === 8 || digits.length === 9) return "profesor";
  return "desconocido";
}

/** Valida igualdad estricta de datos */
function datosCoinciden(solicitud, padron) {
  return (
    norm(solicitud?.nombre) === norm(padron?.nombre) &&
    norm(solicitud?.apellido_paterno) === norm(padron?.apellido_paterno) &&
    norm(solicitud?.apellido_materno) === norm(padron?.apellido_materno) &&
    norm(solicitud?.curp) === norm(padron?.curp) &&
    norm(solicitud?.correo) === norm(padron?.correo) &&
    String(solicitud?.boleta_o_empleado || "").trim() ===
      String(padron?.boleta_o_empleado || "").trim()
  );
}

function getFallbackLinkMessage() {
  return (
    "Si el botón no funciona, copia y pega el enlace de confirmación que viene debajo del botón en el correo. " +
    "Es un link de este estilo:\n" +
    "https://TU-PROYECTO.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=..."
  );
}

export async function verificarRegistro(solicitud) {
  try {
    const cct = solicitud?.escuelas?.cct || solicitud?.escuela_cct || null;
    const boletaOEmpleado = String(
      solicitud?.boleta_o_empleado || ""
    ).trim();
    const email = String(solicitud?.correo || "")
      .trim()
      .toLowerCase();

    if (!cct || !boletaOEmpleado || !email) {
      return {
        ok: false,
        reason: "AUTH_ERROR",
        error: "Datos incompletos en la solicitud.",
      };
    }

    const tipoUsuario = getTipoUsuario(boletaOEmpleado);
    if (tipoUsuario === "desconocido") {
      return {
        ok: false,
        reason: "AUTH_ERROR",
        error:
          "boleta_o_empleado debe tener 10 dígitos (alumno) o 8/9 dígitos (profesor).",
      };
    }

    // 1️⃣ Buscar en padrón
    const { data: padron, error: padronErr } = await supabaseApp
      .from("App_Solicitudes")
      .select(
        "id, nombre, apellido_paterno, apellido_materno, boleta_o_empleado, correo, curp, escuela_cct"
      )
      .eq("boleta_o_empleado", boletaOEmpleado)
      .eq("escuela_cct", cct)
      .limit(1)
      .maybeSingle();

    if (padronErr) {
      console.error("Error consultando App_Solicitudes:", padronErr);
      return { ok: false, reason: "AUTH_ERROR" };
    }

    if (!padron) return { ok: false, reason: "NO_EXISTE_PADRON" };

    if (!datosCoinciden(solicitud, padron)) {
      return { ok: false, reason: "DATOS_NO_COINCIDEN" };
    }

    // 2️⃣ Crear usuario en Auth
    const password = genPassword(12);

    const redirectUrl =
      "https://aalvarez-ortega.github.io/API.validacion-de-usuarios-SISEEAP-/Bienvenido.html";

    const { data: signUpData, error: signUpErr } =
      await supabaseApp.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            temp_password: password,
            nombre: solicitud.nombre,
            apellido_paterno: solicitud.apellido_paterno,
            apellido_materno: solicitud.apellido_materno,
            boleta_o_empleado: boletaOEmpleado,
            curp: solicitud.curp,
            escuela_cct: cct,
            tipo_usuario: tipoUsuario,
          },
        },
      });

    if (signUpErr) {
      console.error("Error signUp:", signUpErr);
      const msg = (signUpErr.message || "").toLowerCase();
      if (msg.includes("already"))
        return { ok: false, reason: "EMAIL_YA_EXISTE" };

      return { ok: false, reason: "AUTH_ERROR" };
    }

    const authUid = signUpData?.user?.id || null;
    if (!authUid) {
      return {
        ok: false,
        reason: "AUTH_ERROR",
        error: "No se recibió UID.",
      };
    }

    // ✅ 3️⃣ ACTUALIZAR ESTADO A "Aceptado" EN SISAP
    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update({ estado: "Aceptado" })
      .eq("id", solicitud.id);

    if (updateErr) {
      console.error("Error actualizando estado:", updateErr);
      return {
        ok: false,
        reason: "AUTH_ERROR",
        error: "Usuario creado pero no se pudo actualizar estado.",
      };
    }

    return {
      ok: true,
      email,
      password,
      userId: authUid,
      tipo_usuario: tipoUsuario,
      escuela_cct: cct,
      redirectUrl,
      fallbackLinkHint: getFallbackLinkMessage(),
    };
  } catch (e) {
    console.error("verificarRegistro() catch:", e);
    return {
      ok: false,
      reason: "AUTH_ERROR",
      error: e?.message || "Error desconocido.",
    };
  }
}