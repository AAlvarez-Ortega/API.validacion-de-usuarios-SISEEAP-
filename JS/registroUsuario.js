import { supabase } from "./coneccionSB.js";

document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("formRegistro");
  const btnRegistrar = document.getElementById("btnRegistrar");
  const mensajeFormulario = document.getElementById("mensajeFormulario");

  const modal = crearModal();
  document.body.appendChild(modal.overlay);

  const setMensaje = (texto, tipo = "") => {
    mensajeFormulario.textContent = texto;
    mensajeFormulario.className = "form-msg " + tipo;
  };

  function mostrarModal({ titulo, mensaje, tipo = "ok" }) {
    modal.titulo.textContent = titulo;
    modal.mensaje.textContent = mensaje;

    modal.caja.classList.remove("ok", "error");
    modal.caja.classList.add(tipo === "error" ? "error" : "ok");

    modal.overlay.classList.add("open");
    modal.btnCerrar.focus();
  }

  function cerrarModal() {
    modal.overlay.classList.remove("open");
  }

  modal.btnCerrar.addEventListener("click", cerrarModal);
  modal.overlay.addEventListener("click", (e) => {
    if (e.target === modal.overlay) cerrarModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
  });

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const apellidoPaterno = document.getElementById("apellidoPaterno").value.trim();
    const apellidoMaterno = document.getElementById("apellidoMaterno").value.trim();
    const fechaNacimiento = document.getElementById("fechaNacimiento").value;
    const telefono = document.getElementById("telefono").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const contrasena = document.getElementById("contrasena").value;
    const confirmarContrasena = document.getElementById("confirmarContrasena").value;

    if (!formulario.checkValidity()) {
      mostrarModal({
        titulo: "Registro fallido",
        mensaje: "Revisa los campos requeridos ⚠️",
        tipo: "error"
      });
      return;
    }

    if (contrasena !== confirmarContrasena) {
      mostrarModal({
        titulo: "Registro fallido",
        mensaje: "Las contraseñas no coinciden ❌",
        tipo: "error"
      });
      return;
    }

    btnRegistrar.disabled = true;
    btnRegistrar.textContent = "Creando cuenta…";
    setMensaje("Creando cuenta…", "");

    // ✅ Redirect robusto para GitHub Pages
    // Devuelve a la carpeta donde está el HTML actual
    const urlBase = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "/");
    const redireccionCorreo = urlBase;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password: contrasena,
        options: {
          emailRedirectTo: redireccionCorreo,
          data: {
            nombre,
            apellidoPaterno,
            apellidoMaterno,
            fechaNacimiento,
            telefono
          }
        }
      });

      if (error) {
        mostrarModal({
          titulo: "Registro fallido",
          mensaje: error.message || "No se pudo registrar ❌",
          tipo: "error"
        });
        setMensaje(error.message || "No se pudo registrar ❌", "error");
        return;
      }

      // Con confirmación por correo, session puede ser null
      if (data?.session) {
        mostrarModal({
          titulo: "Registro exitoso ✅",
          mensaje: "Tu cuenta fue creada y la sesión quedó iniciada.",
          tipo: "ok"
        });
      } else {
        mostrarModal({
          titulo: "Registro exitoso ✅",
          mensaje: "Tu cuenta fue creada. Revisa tu correo para confirmar el registro.",
          tipo: "ok"
        });
      }

      setMensaje("Registro completado ✅", "ok");
      formulario.reset();
    } catch (err) {
      console.error(err);
      mostrarModal({
        titulo: "Registro fallido",
        mensaje: "Ocurrió un error inesperado. Intenta de nuevo.",
        tipo: "error"
      });
      setMensaje("Error inesperado ❌", "error");
    } finally {
      btnRegistrar.disabled = false;
      btnRegistrar.textContent = "Crear cuenta";
    }
  });
});

/* ===================== MODAL ===================== */
function crearModal() {
  const overlay = document.createElement("div");
  overlay.className = "sb-modal-overlay";
  overlay.innerHTML = `
    <div class="sb-modal" role="dialog" aria-modal="true" aria-labelledby="sbModalTitulo">
      <h3 id="sbModalTitulo" class="sb-modal-title">Título</h3>
      <p class="sb-modal-message">Mensaje</p>
      <button type="button" class="sb-modal-btn">Aceptar</button>
    </div>
  `;

  const caja = overlay.querySelector(".sb-modal");
  const titulo = overlay.querySelector(".sb-modal-title");
  const mensaje = overlay.querySelector(".sb-modal-message");
  const btnCerrar = overlay.querySelector(".sb-modal-btn");

  // CSS embebido (solo para modal)
  const estilo = document.createElement("style");
  estilo.textContent = `
    .sb-modal-overlay{
      position:fixed; inset:0;
      display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,.45);
      opacity:0; pointer-events:none;
      transition: opacity .18s ease;
      z-index:9999;
      padding:16px;
    }
    .sb-modal-overlay.open{
      opacity:1; pointer-events:auto;
    }
    .sb-modal{
      width:min(460px, 92vw);
      background: rgba(255,255,255,.92);
      backdrop-filter: blur(10px);
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,.30);
      padding: 18px 18px 14px;
      transform: translateY(6px) scale(.98);
      transition: transform .18s ease;
    }
    .sb-modal-overlay.open .sb-modal{
      transform: translateY(0) scale(1);
    }
    .sb-modal-title{
      margin:0 0 10px;
      font-size:18px;
      font-weight:800;
      color:#0b2b18;
    }
    .sb-modal-message{
      margin:0 0 14px;
      color:#333;
      line-height:1.35;
      font-size:14px;
    }
    .sb-modal-btn{
      width:100%;
      border:0;
      border-radius: 999px;
      padding: 11px 14px;
      font-weight: 700;
      cursor:pointer;
      background:#0d7a32;
      color:#fff;
    }
    .sb-modal.ok .sb-modal-btn{ background:#0d7a32; }
    .sb-modal.error .sb-modal-btn{ background:#8b1a1a; }
  `;
  document.head.appendChild(estilo);

  return { overlay, caja, titulo, mensaje, btnCerrar };
}
