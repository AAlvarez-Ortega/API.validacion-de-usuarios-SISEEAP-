import { supabase } from "./coneccionSB.js";

document.addEventListener("DOMContentLoaded", () => {

  /* =============================
     LOGOUT
  ==============================*/
  const btnLogout = document.getElementById("btnLogout");

  btnLogout?.addEventListener("click", async () => {

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("❌ Error cerrando sesión:", error);
        return;
      }

      console.log("🔐 Sesión cerrada");

      // Redirigir al login
      window.location.href = "./index.html";

    } catch (err) {
      console.error("🚨 Error inesperado:", err);
    }

  });


  /* =============================
     MARCAR NAV ACTIVA
  ==============================*/
  const ruta = window.location.pathname.split("/").pop();

  if (ruta === "inicio.html") {
    document.getElementById("navInicio")?.classList.add("active");
  }

  if (ruta === "registro.html") {
    document.getElementById("navRegistros")?.classList.add("active");
  }

});
