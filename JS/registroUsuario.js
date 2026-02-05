// JS/registroUsuarios.js
import { supabase } from "./coneccionSB.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ registroUsuarios.js cargado");

  // Modal estable
  const modal = crearModal();
  document.body.appendChild(modal.overlay);

  modal.boton.addEventListener("click", () => cerrarModal(modal));
  modal.overlay.addEventListener("click", (e) => {
    if (e.target === modal.overlay) cerrarModal(modal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal(modal);
  });

  // Elementos del formulario
  const formulario = document.getElementById("formRegistro");
  const botonRegistrar = document.getElementById("btnRegistrar");

  // Inputs
  const inputNombre = document.getElementById("nombre");
  const inputApellidoPaterno = document.getElementById("apellidoPaterno");
  const inputApellidoMaterno = document.getElementById("apellidoMaterno");
  const inputFechaNacimiento = document.getElementById("fechaNacimiento");
  const inputTelefono = document.getElementById("telefono");
  const inputCorreo = document.getElementById("correo");
  const inputContrasena = document.getElementById("contrasena");
  const inputConfirmarContrasena = document.getElementById("confirmarContrasena");

  const mensajeFormulario = document.getElementById("mensajeFormulario");

  // Botones ojo
  const btnOjoContrasena = document.getElementById("btnOjoContrasena");
  const btnOjoConfirmar = document.getElementById("btnOjoConfirmar");

  if (!formulario || !botonRegistrar) {
    console.error("❌ No se encontró formRegistro o btnRegistrar. Revisa IDs en el HTML.");
    abrirModal(modal, {
      titulo: "Error",
      mensaje: "No se encontró el formulario o el botón. Revisa IDs en HTML.",
      tipo: "error"
    });
    return;
  }

  // Toggle mostrar/ocultar contraseña
  const alternarOjo = (input, boton) => {
    const esPassword = input.type === "password";
    input.type = esPassword ? "text" : "password";
    boton.setAttribute("aria-label", esPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    boton.classList.toggle("activo", esPassword);
  };

  btnOjoContrasena?.addEventListener("click", () => alternarOjo(inputContrasena, btnOjoContrasena));
  btnOjoConfirmar?.addEventListener("click", () => alternarOjo(inputConfirmarContrasena, btnOjoConfirmar));

  // Test rápido (no bloquea)
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn("⚠️ Supabase auth.getSession error:", error.message);
    else console.log("🔌 Supabase OK (session):", data.session);
  } catch (e) {
    console.warn("⚠️ Supabase no respondió en getSession:", e);
  }

  const setMensaje = (texto, tipo = "") => {
    if (!mensajeFormulario) return;
    mensajeFormulario.textContent = texto;
    mensajeFormulario.className = "form-msg " + tipo;
  };

  // Reglas contraseña:
  // - mínimo 8
  // - al menos 1 mayúscula
  // - al menos 1 símbolo
  const validarContrasena = (valor) => {
    const minimo8 = valor.length >= 8;
    const mayuscula = /[A-ZÁÉÍÓÚÑ]/.test(valor);
    const simbolo = /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(valor); // símbolo o signo
    return minimo8 && mayuscula && simbolo;
  };

  const obtenerEdad = (fechaISO) => {
    // fechaISO: YYYY-MM-DD
    if (!fechaISO) return null;
    const hoy = new Date();
    const nacimiento = new Date(fechaISO + "T00:00:00");
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  };

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("🟢 Submit detectado");

    // Validación HTML
    const campos = [
      { el: inputNombre, etiqueta: "Nombre" },
      { el: inputApellidoPaterno, etiqueta: "Apellido paterno" },
      { el: inputApellidoMaterno, etiqueta: "Apellido materno" },
      { el: inputFechaNacimiento, etiqueta: "Fecha de nacimiento" },
      { el: inputTelefono, etiqueta: "Número telefónico" },
      { el: inputCorreo, etiqueta: "Correo electrónico" },
      { el: inputContrasena, etiqueta: "Contraseña" },
      { el: inputConfirmarContrasena, etiqueta: "Confirmar contraseña" },
    ];

    const primerInvalido = campos.find(c => !c.el || !c.el.checkValidity());
    if (primerInvalido) {
      console.warn("❌ Campo inválido:", primerInvalido.etiqueta, primerInvalido.el?.validationMessage);
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: `Revisa el campo: ${primerInvalido.etiqueta} ⚠️`,
        tipo: "error"
      });
      primerInvalido.el?.focus();
      return;
    }

    // Restricción menor de edad
    const edad = obtenerEdad(inputFechaNacimiento.value);
    if (edad === null) {
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: "Selecciona tu fecha de nacimiento ⚠️",
        tipo: "error"
      });
      inputFechaNacimiento.focus();
      return;
    }
    if (edad < 18) {
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: "Debes ser mayor de edad (18+) para registrarte ❌",
        tipo: "error"
      });
      inputFechaNacimiento.focus();
      return;
    }

    // Validación teléfono
    const telefonoValor = inputTelefono.value.trim();
    if (!/^\d{10,15}$/.test(telefonoValor)) {
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: "El teléfono debe tener solo números (10 a 15 dígitos).",
        tipo: "error"
      });
      inputTelefono.focus();
      return;
    }

    // Validación contraseña avanzada
    const contrasenaValor = inputContrasena.value;
    if (!validarContrasena(contrasenaValor)) {
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: "La contraseña debe tener mínimo 8 caracteres, 1 mayúscula y 1 símbolo (ej. !@#?).",
        tipo: "error"
      });
      inputContrasena.focus();
      return;
    }

    // Confirmación contraseña
    if (inputContrasena.value !== inputConfirmarContrasena.value) {
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: "Las contraseñas no coinciden ❌",
        tipo: "error"
      });
      inputConfirmarContrasena.focus();
      return;
    }

    // UI
    botonRegistrar.disabled = true;
    const textoOriginal = botonRegistrar.textContent;
    botonRegistrar.textContent = "Creando cuenta…";
    setMensaje("Creando cuenta…", "");

    // Redirect robusto
    const urlBase = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "/");
    const redireccionCorreo = urlBase;

    console.log("📤 Enviando a Supabase signUp...", {
      correo: inputCorreo.value.trim(),
      redireccionCorreo
    });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: inputCorreo.value.trim(),
        password: contrasenaValor,
        options: {
          emailRedirectTo: redireccionCorreo,
          data: {
            nombre: inputNombre.value.trim(),
            apellidoPaterno: inputApellidoPaterno.value.trim(),
            apellidoMaterno: inputApellidoMaterno.value.trim(),
            fechaNacimiento: inputFechaNacimiento.value,
            telefono: telefonoValor
          }
        }
      });

      console.log("📦 Respuesta Supabase:", { data, error });

      if (error) {
        abrirModal(modal, {
          titulo: "Registro fallido",
          mensaje: error.message || "No se pudo registrar ❌",
          tipo: "error"
        });
        setMensaje(error.message || "No se pudo registrar ❌", "error");
        return;
      }

      abrirModal(modal, {
        titulo: "Registro exitoso ✅",
        mensaje: data?.session
          ? "Cuenta creada y sesión iniciada."
          : "Cuenta creada. Revisa tu correo para confirmar 📩",
        tipo: "ok"
      });

      setMensaje("Registro completado ✅", "ok");
      formulario.reset();
    } catch (err) {
      console.error("🚨 Error inesperado en signUp:", err);
      abrirModal(modal, {
        titulo: "Registro fallido",
        mensaje: "Error inesperado. Intenta de nuevo.",
        tipo: "error"
      });
      setMensaje("Error inesperado ❌", "error");
    } finally {
      botonRegistrar.disabled = false;
      botonRegistrar.textContent = textoOriginal;
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

