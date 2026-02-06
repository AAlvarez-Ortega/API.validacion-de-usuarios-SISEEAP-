import { supabase } from "../coneccionSB.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ inicioSesion.js cargado");

  // Elementos
  const formulario = document.getElementById("formInicioSesion");
  const inputCorreo = document.getElementById("correo");
  const inputContrasena = document.getElementById("contrasena");
  const btnIniciarSesion = document.getElementById("btnIniciarSesion");
  const mensajeFormulario = document.getElementById("mensajeFormulario");
  const btnOjoContrasena = document.getElementById("btnOjoContrasena");

  const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setMensaje = (texto, tipo = "") => {
    if (!mensajeFormulario) return;
    mensajeFormulario.textContent = texto;
    mensajeFormulario.className = "form-msg " + tipo;
  };

  const limpiarEstados = () => {
    inputCorreo?.classList.remove("input-error", "input-ok");
    inputContrasena?.classList.remove("input-error", "input-ok");
  };

  const marcarError = (input) => {
    input?.classList.remove("input-ok");
    input?.classList.add("input-error");
  };

  const marcarOk = (input) => {
    input?.classList.remove("input-error");
    input?.classList.add("input-ok");
  };

  const limpiarAlEscribir = () => {
    limpiarEstados();
    setMensaje("", "");
  };

  // Limpia mensajes/estilos cuando el usuario corrige
  inputCorreo?.addEventListener("input", limpiarAlEscribir);
  inputContrasena?.addEventListener("input", limpiarAlEscribir);

  // Ojo: mostrar/ocultar contraseña
  btnOjoContrasena?.addEventListener("click", () => {
    const esPassword = inputContrasena.type === "password";
    inputContrasena.type = esPassword ? "text" : "password";

    btnOjoContrasena.setAttribute(
      "aria-label",
      esPassword ? "Ocultar contraseña" : "Mostrar contraseña"
    );
    btnOjoContrasena.classList.toggle("activo", esPassword);
  });

  // Si ya hay sesión, redirige
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      console.log("Sesión existente, redirigiendo a inicio.html...");
      window.location.href = "./inicio.html";
      return;
    }
  } catch (e) {
    console.warn("No se pudo leer la sesión:", e);
  }

  // Submit login
  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarEstados();

    const correo = (inputCorreo?.value || "").trim();
    const contrasena = inputContrasena?.value || "";

    // Validaciones front
    if (!correo) {
      setMensaje("Crreo electrónico ", "error");
      marcarError(inputCorreo);
      inputCorreo?.focus();
      return;
    }

    if (!correoRegex.test(correo)) {
      setMensaje("correo no válido.", "error");
      marcarError(inputCorreo);
      inputCorreo?.focus();
      return;
    }

    if (!contrasena) {
      setMensaje("Escribe tu contraseña ", "error");
      marcarError(inputContrasena);
      inputContrasena?.focus();
      return;
    }

    if (contrasena.length < 8) {
      setMensaje("La contraseña debe tener al menos 8 caracteres", "error");
      marcarError(inputContrasena);
      inputContrasena?.focus();
      return;
    }

    // Estado cargando
    btnIniciarSesion.disabled = true;
    const textoOriginal = btnIniciarSesion.textContent;
    btnIniciarSesion.textContent = "Iniciando…";
    setMensaje("Validando credenciales…", "");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });

      if (error) {
        console.error("❌ signInWithPassword:", error);

        // Mensaje amigable (sin filtrar si existe o no el usuario)
        const msg =
          (error.message || "").toLowerCase().includes("email not confirmed")
            ? "Tu correo aún no está confirmado Revisa tu bandeja y confirma el registro."
            : "Correo o contraseña incorrectos Intenta de nuevo.";

        setMensaje(msg, "error");
        marcarError(inputCorreo);
        marcarError(inputContrasena);
        inputCorreo?.focus();
        return;
      }

      if (!data?.session) {
        setMensaje("No se pudo iniciar sesión. Intenta nuevamente", "error");
        marcarError(inputCorreo);
        marcarError(inputContrasena);
        return;
      }

      // OK
      marcarOk(inputCorreo);
      marcarOk(inputContrasena);
      setMensaje("Redirigiendo…", "ok");

      setTimeout(() => {
        window.location.href = "./inicio.html";
      }, 450);

    } catch (err) {
      console.error("🚨 Error inesperado:", err);
      setMensaje("Ocurrió un error inesperado Intenta de nuevo.", "error");
    } finally {
      btnIniciarSesion.disabled = false;
      btnIniciarSesion.textContent = textoOriginal;
    }
  });
});
