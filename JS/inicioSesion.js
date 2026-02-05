import { supabase } from "./coneccionSB.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ inisioSesion.js cargado");

  const modal = crearModal();
  document.body.appendChild(modal.overlay);

  modal.boton.addEventListener("click", () => cerrarModal(modal));
  modal.overlay.addEventListener("click", (e) => {
    if (e.target === modal.overlay) cerrarModal(modal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal(modal);
  });

  const formulario = document.getElementById("formInicioSesion");
  const inputCorreo = document.getElementById("correo");
  const inputContrasena = document.getElementById("contrasena");
  const btnIniciarSesion = document.getElementById("btnIniciarSesion");
  const mensajeFormulario = document.getElementById("mensajeFormulario");

  const btnOjoContrasena = document.getElementById("btnOjoContrasena");

  const setMensaje = (texto, tipo = "") => {
    if (!mensajeFormulario) return;
    mensajeFormulario.textContent = texto;
    mensajeFormulario.className = "form-msg " + tipo;
  };

  // Ojo: mostrar/ocultar
  btnOjoContrasena?.addEventListener("click", () => {
    const esPassword = inputContrasena.type === "password";
    inputContrasena.type = esPassword ? "text" : "password";
    btnOjoContrasena.setAttribute("aria-label", esPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    btnOjoContrasena.classList.toggle("activo", esPassword);
  });

  // ✅ Si ya hay sesión, manda directo a inicio.html
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      console.log("🔐 Sesión existente, redirigiendo...");
      window.location.href = "./inicio.html";
      return;
    }
  } catch (e) {
    console.warn("⚠️ No se pudo leer la sesión:", e);
  }

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!formulario.checkValidity()) {
      abrirModal(modal, {
        titulo: "Inicio fallido",
        mensaje: "Revisa tu correo y contraseña ⚠️",
        tipo: "error"
      });
      return;
    }

    const correo = inputCorreo.value.trim();
    const contrasena = inputContrasena.value;

    btnIniciarSesion.disabled = true;
    const textoOriginal = btnIniciarSesion.textContent;
    btnIniciarSesion.textContent = "Iniciando…";
    setMensaje("Iniciando sesión…", "");

    console.log("📤 Intentando login con Supabase:", correo);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena
      });

      console.log("📦 Respuesta login:", { data, error });

      if (error) {
        // Mensajes comunes:
        // "Invalid login credentials" o "Email not confirmed"
        abrirModal(modal, {
          titulo: "Inicio fallido",
          mensaje: error.message || "Credenciales inválidas ❌",
          tipo: "error"
        });
        setMensaje(error.message || "No se pudo iniciar sesión ❌", "error");
        return;
      }

      abrirModal(modal, {
        titulo: "Inicio exitoso ✅",
        mensaje: "Bienvenido(a). Redirigiendo…",
        tipo: "ok"
      });
      setMensaje("Inicio exitoso ✅", "ok");

      // Redirige
      setTimeout(() => {
        window.location.href = "./inicio.html";
      }, 700);

    } catch (err) {
      console.error("🚨 Error inesperado:", err);
      abrirModal(modal, {
        titulo: "Inicio fallido",
        mensaje: "Ocurrió un error inesperado. Intenta de nuevo.",
        tipo: "error"
      });
      setMensaje("Error inesperado ❌", "error");
    } finally {
      btnIniciarSesion.disabled = false;
      btnIniciarSesion.textContent = textoOriginal;
    }
  });
});

/* ===================== MODAL ESTABLE ===================== */
function crearModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="modalTitulo">
      <h3 id="modalTitulo" class="modal-titulo">Título</h3>
      <p class="modal-mensaje">Mensaje</p>
      <button type="button" class="modal-boton">Aceptar</button>
    </div>
  `;

  const caja = overlay.querySelector(".modal-caja");
  const titulo = overlay.querySelector(".modal-titulo");
  const mensaje = overlay.querySelector(".modal-mensaje");
  const boton = overlay.querySelector(".modal-boton");

  const estilo = document.createElement("style");
  estilo.textContent = `
    .modal-overlay{
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      display: grid !important;
      place-items: center !important;
      background: rgba(0,0,0,.55) !important;
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease;
      z-index: 999999 !important;
      padding: 16px;
    }
    .modal-overlay.abierto{ opacity: 1; pointer-events: auto; }
    .modal-caja{
      width: min(520px, 94vw);
      background: rgba(255,255,255,.96);
      border-radius: 18px;
      box-shadow: 0 25px 70px rgba(0,0,0,.35);
      padding: 18px 18px 14px;
      transform: translateY(8px) scale(.98);
      transition: transform .18s ease;
    }
    .modal-overlay.abierto .modal-caja{ transform: translateY(0) scale(1); }
    .modal-titulo{ margin:0 0 10px; font-size:18px; font-weight:800; color:#0b2b18; }
    .modal-mensaje{ margin:0 0 14px; color:#333; line-height:1.35; font-size:14px; word-break:break-word; }
    .modal-boton{
      width:100%; border:0; border-radius:999px;
      padding:11px 14px; font-weight:700; cursor:pointer;
      background:#0d7a32; color:#fff;
    }
    .modal-caja.error .modal-boton{ background:#8b1a1a; }
  `;
  document.head.appendChild(estilo);

  return { overlay, caja, titulo, mensaje, boton };
}

function abrirModal(modal, { titulo, mensaje, tipo = "ok" }) {
  modal.titulo.textContent = titulo;
  modal.mensaje.textContent = mensaje;
  modal.caja.classList.toggle("error", tipo === "error");

  if (!document.body.contains(modal.overlay)) document.body.appendChild(modal.overlay);

  modal.overlay.classList.add("abierto");
  modal.overlay.setAttribute("aria-hidden", "false");

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  modal.boton.focus();
}

function cerrarModal(modal) {
  modal.overlay.classList.remove("abierto");
  modal.overlay.setAttribute("aria-hidden", "true");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
