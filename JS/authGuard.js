// ./JS/authGuard.js
import { supabase } from "./coneccionSB.js";
// 👆 Ajusta si tu coneccionSB.js está en otra carpeta (puede ser ./JS/coneccionSB.js)

const DEFAULTS = {
  loginPage: "./index.html", // o "./inicioSesion.html"
  allowPublic: ["index.html", "inicioSesion.html", "recuperarContrasena.html"],
};

/**
 * Protege una página. Si no hay sesión, redirige a login.
 * @param {Object} opts
 * @param {string} opts.loginPage ruta a la página de login
 * @param {string[]} opts.allowPublic lista de páginas públicas
 */
export async function requireAuth(opts = {}) {
  const { loginPage, allowPublic } = { ...DEFAULTS, ...opts };

  // Si estás en una página pública, no bloquees
  const current = (location.pathname.split("/").pop() || "").toLowerCase();
  if (allowPublic.map(x => x.toLowerCase()).includes(current)) return;

  // Revisar sesión
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) console.warn("authGuard getSession error:", error);

  if (!session) {
    // Guarda a dónde quería ir (para redirigir después del login)
    sessionStorage.setItem("redirectAfterLogin", location.href);
    location.replace(loginPage);
    return;
  }

  // Opcional: si quieres refrescar UI con user
  return session.user;
}
