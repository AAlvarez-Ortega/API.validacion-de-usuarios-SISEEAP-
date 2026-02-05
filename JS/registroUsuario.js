// js/registroUsuarios.js
import { supabase } from "./conexionSB.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const msg  = document.getElementById("formMsg");
  const btn  = document.getElementById("submitBtn");

  const setMsg = (text, type="") => {
    msg.textContent = text;
    msg.className = "form-msg " + type;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const first_name   = document.getElementById("first_name").value.trim();
    const last_name_p  = document.getElementById("last_name_p").value.trim();
    const last_name_m  = document.getElementById("last_name_m").value.trim();
    const birth_date   = document.getElementById("birth_date").value; // YYYY-MM-DD
    const phone        = document.getElementById("phone").value.trim();
    const email        = document.getElementById("email").value.trim();
    const password     = document.getElementById("password").value;
    const confirm      = document.getElementById("password_confirm").value;

    if (!form.checkValidity()) {
      setMsg("Revisa los campos requeridos ⚠️", "error");
      return;
    }
    if (password !== confirm) {
      setMsg("Las contraseñas no coinciden ❌", "error");
      return;
    }

    btn.disabled = true;
    setMsg("Creando cuenta…", "");

    // ✅ Ajusta la URL a tu dominio de GitHub Pages (en producción)
    // Para local puedes usar: window.location.origin + "/"
    const emailRedirectTo = window.location.origin + "/";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          first_name,
          last_name_p,
          last_name_m,
          birth_date,
          phone
        }
      }
    });

    btn.disabled = false;

    if (error) {
      setMsg(error.message || "No se pudo registrar ❌", "error");
      return;
    }

    // Con email confirmation, a veces NO hay sesión inmediatamente (session=null)
    if (data?.session) {
      setMsg("Cuenta creada ✅ (sesión iniciada).", "ok");
    } else {
      setMsg("Cuenta creada ✅ Revisa tu correo para confirmar el registro.", "ok");
    }

    form.reset();
  });
});

