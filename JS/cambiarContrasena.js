import { supabase } from "./coneccionSB.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ recuperarContrasena.js cargado");

  const form = document.getElementById("formRecuperarContrasena");
  const inputNueva = document.getElementById("nuevaContrasena");
  const inputConfirmar = document.getElementById("confirmarContrasena");
  const btnActualizar = document.getElementById("btnActualizar");
  const mensaje = document.getElementById("mensajeFormulario");

  const btnOjoNueva = document.getElementById("btnOjoNueva");
  const btnOjoConfirmar = document.getElementById("btnOjoConfirmar");

  const setMensaje = (texto, tipo = "") => {
    mensaje.textContent = texto;
    mensaje.className = "form-msg " + tipo;
  };

  const toggleOjo = (btn, input) => {
    btn?.addEventListener("click", () => {
      const esPassword = input.type === "password";
      input.type = esPassword ? "text" : "password";
      btn.setAttribute("aria-label", esPassword ? "Ocultar contraseña" : "Mostrar contraseña");
      btn.classList.toggle("activo", esPassword);
    });
  };

  toggleOjo(btnOjoNueva, inputNueva);
  toggleOjo(btnOjoConfirmar, inputConfirmar);

  // ✅ Verifica que el usuario venga desde el link (sesión temporal de recovery)
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      setMensaje("El enlace no es válido o expiró. Vuelve a solicitarlo desde 'Olvidé mi contraseña'.", "error");
      btnActualizar.disabled = true;
      return;
    }
  } catch (e) {
    console.warn("⚠️ No se pudo leer la sesión:", e);
  }

  // ✅ Reglas: mínimo 8, 1 mayúscula, 1 símbolo
  const cumpleReglas = (contrasena) => {
    const min8 = contrasena.length >= 8;
    const mayus = /[A-ZÁÉÍÓÚÑ]/.test(contrasena);
    const simbolo = /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(contrasena);
    return min8 && mayus && simbolo;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nueva = inputNueva.value;
    const confirmar = inputConfirmar.value;

    if (!nueva || !confirmar) {
      setMensaje("Completa ambos campos ⚠️", "error");
      return;
    }
    if (nueva !== confirmar) {
      setMensaje("Las contraseñas no coinciden ❌", "error");
      return;
    }
    if (!cumpleReglas(nueva)) {
      setMensaje("La contraseña debe tener mínimo 8 caracteres, 1 mayúscula y 1 símbolo ⚠️", "error");
      return;
    }

    btnActualizar.disabled = true;
    const txt = btnActualizar.textContent;
    btnActualizar.textContent = "Actualizando…";
    setMensaje("Actualizando contraseña…", "");

    try {
      const { error } = await supabase.auth.updateUser({ password: nueva });

      if (error) {
        console.error("❌ updateUser error:", error);
        setMensaje(error.message || "No se pudo actualizar la contraseña ❌", "error");
        return;
      }

      setMensaje("Contraseña actualizada ✅ Ya puedes iniciar sesión.", "ok");

      // opcional: cerrar sesión recovery y mandar al login
      await supabase.auth.signOut();
      setTimeout(() => (window.location.href = "./index.html"), 900);

    } catch (err) {
      console.error("🚨 Error inesperado:", err);
      setMensaje("Ocurrió un error inesperado ❌", "error");
    } finally {
      btnActualizar.disabled = false;
      btnActualizar.textContent = txt;
    }
  });
});
