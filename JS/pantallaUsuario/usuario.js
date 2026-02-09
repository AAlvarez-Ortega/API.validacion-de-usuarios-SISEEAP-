// ./JS/pantallaUsuario/usuario.js
import { supabase } from "../coneccionSB.js";

/**
 * Tabla esperada: usuarios
 * Columnas: user_id (uuid), nombre (text), telefono (text), fecha_nacimiento (date)
 */

const $uNombre = document.getElementById("uNombre");
const $uEmail = document.getElementById("uEmail");
const $uRol = document.getElementById("uRol");

const $uNombreCompleto = document.getElementById("uNombreCompleto");
const $uCorreo = document.getElementById("uCorreo");
const $uTelefono = document.getElementById("uTelefono");
const $uNacimiento = document.getElementById("uNacimiento");
const $uEstado = document.getElementById("uEstado");

const $btnCopiarEmail = document.getElementById("btnCopiarEmail");
const $btnEditarPerfil = document.getElementById("btnEditarPerfil");

const $editPanel = document.getElementById("editPanel");
const $btnCerrarPanel = document.getElementById("btnCerrarPanel");
const $cancelarPerfil = document.getElementById("cancelarPerfil");
const $guardarPerfil = document.getElementById("guardarPerfil");
const $editEstado = document.getElementById("editEstado");

const $editNombre = document.getElementById("editNombre");
const $editNacimiento = document.getElementById("editNacimiento");
const $editTelefono = document.getElementById("editTelefono");

const $uFoto = document.getElementById("uFoto");
const $uAvatarFallback = document.getElementById("uAvatarFallback");

let authUser = null;
let perfilDB = null;

// ---------- helpers ----------
function setEstado(el, msg) {
  if (!el) return;
  el.textContent = msg;
}

function toISODate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatFechaLarga(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

function openEditPanel() {
  if (!$editPanel) return;
  $editPanel.classList.remove("hidden");
}

function closeEditPanel() {
  if (!$editPanel) return;
  $editPanel.classList.add("hidden");
  if ($editEstado) $editEstado.textContent = "—";
}

function logSupabaseError(prefix, error) {
  // Supabase error suele tener: message, details, hint, code
  console.error(prefix, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    raw: error,
  });
}

// ---------- render ----------
function renderPerfil() {
  const email = authUser?.email ?? "—";
  const nombre = (perfilDB?.nombre ?? "").toString().trim();
  const tel = (perfilDB?.telefono ?? "").toString().trim();
  const nac = perfilDB?.fecha_nacimiento ?? null;

  if ($uNombre) $uNombre.textContent = nombre || "Usuario";
  if ($uEmail) $uEmail.textContent = email;
  if ($uRol) $uRol.textContent = "Sesión activa";

  if ($uNombreCompleto) $uNombreCompleto.textContent = nombre || "—";
  if ($uCorreo) $uCorreo.textContent = email;
  if ($uTelefono) $uTelefono.textContent = tel || "—";
  if ($uNacimiento) $uNacimiento.textContent = formatFechaLarga(nac);

  // Precarga inputs (NO abre panel)
  if ($editNombre) $editNombre.value = nombre || "";
  if ($editTelefono) $editTelefono.value = tel || "";
  if ($editNacimiento) $editNacimiento.value = toISODate(nac);

  setEstado($uEstado, "Perfil cargado correctamente.");
}

function renderFallbackSoloAuth() {
  const email = authUser?.email ?? "—";
  const metaName =
    (authUser?.user_metadata?.name ||
      authUser?.user_metadata?.full_name ||
      "Usuario").toString().trim();

  perfilDB = perfilDB ?? { nombre: metaName, telefono: "", fecha_nacimiento: null };

  if ($uNombre) $uNombre.textContent = metaName || "Usuario";
  if ($uEmail) $uEmail.textContent = email;
  if ($uRol) $uRol.textContent = "Sesión activa";

  if ($uNombreCompleto) $uNombreCompleto.textContent = metaName || "—";
  if ($uCorreo) $uCorreo.textContent = email;
  if ($uTelefono) $uTelefono.textContent = "—";
  if ($uNacimiento) $uNacimiento.textContent = "—";

  if ($editNombre) $editNombre.value = metaName || "";
  if ($editTelefono) $editTelefono.value = "";
  if ($editNacimiento) $editNacimiento.value = "";

  setEstado($uEstado, "⚠️ No se pudo leer tu perfil en BD (revisa RLS/tabla).");
}

// ---------- data ----------
async function cargarPerfil() {
  setEstado($uEstado, "Cargando perfil...");

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    logSupabaseError("Error obteniendo usuario Auth:", authErr);
    setEstado($uEstado, "No hay sesión activa.");
    return;
  }

  authUser = authData.user;

  // Leer perfil (BD)
  const { data, error } = await supabase
    .from("usuarios")
    .select("user_id, nombre, telefono, fecha_nacimiento")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (error) {
    logSupabaseError("Error leyendo perfil en usuarios:", error);
    renderFallbackSoloAuth();
    return;
  }

  // Si no existe registro, intentamos crearlo
  if (!data) {
    const nombreAuto =
      (authUser.user_metadata?.name ||
        authUser.user_metadata?.full_name ||
        "Usuario").toString().trim();

    const payloadInicial = {
      user_id: authUser.id,
      nombre: nombreAuto || "Usuario",
      telefono: null,
      fecha_nacimiento: null,
    };

    const { data: creado, error: errCrear } = await supabase
      .from("usuarios")
      .insert(payloadInicial)
      .select("user_id, nombre, telefono, fecha_nacimiento")
      .single();

    if (errCrear) {
      logSupabaseError("Error creando perfil inicial en usuarios:", errCrear);
      // Aun así pintamos con fallback para no dejarlo vacío
      perfilDB = { nombre: payloadInicial.nombre, telefono: "", fecha_nacimiento: null };
      renderFallbackSoloAuth();
      return;
    }

    perfilDB = creado;
    renderPerfil();
    return;
  }

  perfilDB = data;
  renderPerfil();
}

// ---------- actions ----------
function setupEventos() {
  // ✅ SIEMPRE cerrado al entrar
  closeEditPanel();

  // Avatar fallback (404 no rompe nada)
  if ($uFoto) {
    $uFoto.addEventListener("error", () => {
      $uFoto.style.display = "none";
      if ($uAvatarFallback) $uAvatarFallback.style.display = "grid";
    });
  }

  // Copiar correo
  if ($btnCopiarEmail) {
    $btnCopiarEmail.addEventListener("click", async () => {
      const email = authUser?.email ?? "";
      if (!email) return;

      try {
        await navigator.clipboard.writeText(email);
        setEstado($uEstado, "✅ Correo copiado al portapapeles.");
      } catch {
        const tmp = document.createElement("input");
        tmp.value = email;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        tmp.remove();
        setEstado($uEstado, "✅ Correo copiado.");
      }
    });
  }

  // Abrir panel edición (solo click)
  if ($btnEditarPerfil) {
    $btnEditarPerfil.addEventListener("click", () => {
      if ($editNombre) $editNombre.value = (perfilDB?.nombre ?? "") || "";
      if ($editTelefono) $editTelefono.value = (perfilDB?.telefono ?? "") || "";
      if ($editNacimiento) $editNacimiento.value = toISODate(perfilDB?.fecha_nacimiento);
      if ($editEstado) $editEstado.textContent = "—";
      openEditPanel();
    });
  }

  // Cerrar panel
  if ($btnCerrarPanel) $btnCerrarPanel.addEventListener("click", closeEditPanel);
  if ($cancelarPerfil) $cancelarPerfil.addEventListener("click", closeEditPanel);

  // Guardar cambios
  if ($guardarPerfil) {
    $guardarPerfil.addEventListener("click", async () => {
      if (!authUser) return;

      const nombre = ($editNombre?.value ?? "").trim();
      const telefono = ($editTelefono?.value ?? "").trim();
      const nacimiento = $editNacimiento?.value ? $editNacimiento.value : null;

      if (!nombre) {
        if ($editEstado) $editEstado.textContent = "⚠️ El nombre no puede ir vacío.";
        return;
      }

      const telNormalizado = telefono ? telefono.replace(/[^\d]/g, "") : "";
      if (telNormalizado && telNormalizado.length < 8) {
        if ($editEstado) $editEstado.textContent = "⚠️ Teléfono inválido.";
        return;
      }

      if ($editEstado) $editEstado.textContent = "Guardando...";

      const payload = {
        nombre,
        telefono: telNormalizado || null,
        fecha_nacimiento: nacimiento,
      };

      const { data, error } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("user_id", authUser.id)
        .select("user_id, nombre, telefono, fecha_nacimiento")
        .single();

      if (error) {
        logSupabaseError("Error actualizando perfil en usuarios:", error);
        if ($editEstado) $editEstado.textContent = "❌ No se pudo guardar (revisa RLS).";
        setEstado($uEstado, "❌ No se pudo guardar tu perfil.");
        return;
      }

      perfilDB = data;
      renderPerfil();
      if ($editEstado) $editEstado.textContent = "✅ Cambios guardados.";
      closeEditPanel();
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupEventos();
  await cargarPerfil();
});
