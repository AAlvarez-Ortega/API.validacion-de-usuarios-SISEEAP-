import { supabase } from "./coneccionSB.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ recuperarContrasenaModal.js cargado");

  const linkOlvideContrasena = document.getElementById("linkOlvideContrasena");
  const inputCorreoLogin = document.getElementById("correo");

  const modal = crearModalRecuperacion();
  document.body.appendChild(modal.overlay);
  conectarCierreModalRecuperacion(modal);

  linkOlvideContrasena?.addEventListener("click", (e) => {
    e.preventDefault();

    // precargar correo si ya escribió algo
    modal.inputCorreo.value = (inputCorreoLogin?.value || "").trim();

    abrirModal(modal);
    setTimeout(() => modal.inputCorreo.focus(), 50);
  });

  modal.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const correo = modal.inputCorreo.value.trim();

    if (!correo) return setModalMsg(modal, "Introduce tu correo electrónico ⚠️", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return setModalMsg(modal, "Correo inválido. Verifica el formato ⚠️", "error");
    }

    modal.btn.disabled = true;
    modal.btn.textContent = "Enviando…";
    setModalMsg(modal, "Enviando instrucciones…", "ok");

    // ✅ redirección a la pantalla para actualizar contraseña
    const base = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "/");
    const redirectTo = base + "recuperarContrasena.html";

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo });

      // Por seguridad, Supabase normalmente no confirma si existe o no
      if (error) console.error("resetPasswordForEmail:", error);

      setModalMsg(
        modal,
        "Si el correo existe, se han enviado instrucciones para restablecer la contraseña 📩",
        "ok"
      );
    } catch (err) {
      console.error(err);
      setModalMsg(
        modal,
        "Si el correo existe, se han enviado instrucciones para restablecer la contraseña 📩",
        "ok"
      );
    } finally {
      modal.btn.disabled = false;
      modal.btn.textContent = "Aceptar";
    }
  });
});

/* ===================== MODAL RECUPERACIÓN ===================== */

function crearModalRecuperacion() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="tituloRecuperacion">
      <h3 id="tituloRecuperacion" class="modal-titulo">Restablecer contraseña</h3>
      <p class="modal-mensaje">Introduce tu correo electrónico.</p>

      <form id="formRecuperacion" novalidate>
        <div class="field" style="margin-top:12px;">
          <label class="label" for="correoRecuperacion">Correo electrónico</label>
          <input class="input" id="correoRecuperacion" type="email" autocomplete="email" required />
        </div>

        <div class="actions" style="margin-top:18px;">
          <button class="btn" type="submit" id="btnEnviarRecuperacion">Aceptar</button>
        </div>
      </form>
    </div>
  `;

  const caja = overlay.querySelector(".modal-caja");
  const mensaje = overlay.querySelector(".modal-mensaje");
  const form = overlay.querySelector("#formRecuperacion");
  const inputCorreo = overlay.querySelector("#correoRecuperacion");
  const btn = overlay.querySelector("#btnEnviarRecuperacion");

  inyectarCssModal();

  return { overlay, caja, mensaje, form, inputCorreo, btn };
}

function abrirModal(modal) {
  modal.overlay.classList.add("abierto");
  modal.overlay.setAttribute("aria-hidden", "false");
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function cerrarModal(modal) {
  modal.overlay.classList.remove("abierto");
  modal.overlay.setAttribute("aria-hidden", "true");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

function conectarCierreModalRecuperacion(modal) {
  modal.overlay.addEventListener("click", (e) => {
    if (e.target === modal.overlay) cerrarModal(modal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.overlay.classList.contains("abierto")) cerrarModal(modal);
  });
}

function setModalMsg(modal, texto, tipo) {
  modal.mensaje.textContent = texto;
  modal.mensaje.classList.toggle("error-text", tipo === "error");
  modal.mensaje.classList.toggle("ok-text", tipo !== "error");
}

let cssModalInyectado = false;
function inyectarCssModal() {
  if (cssModalInyectado) return;
  cssModalInyectado = true;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .modal-overlay{
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(0,0,0,.55);
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease;
      z-index: 999999;
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
    .modal-mensaje{ margin:0 0 12px; color:#333; line-height:1.35; font-size:14px; word-break:break-word; }
    .error-text{ color:#8b1a1a; }
    .ok-text{ color:#0b672b; }
  `;
  document.head.appendChild(estilo);
}
