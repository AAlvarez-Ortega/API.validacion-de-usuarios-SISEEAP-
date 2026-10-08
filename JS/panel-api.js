import { supabase } from "./coneccionSB.js";
export async function rpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}
export function mensajeError(error) {
  if (error?.code === "42501") return "Esta cuenta no tiene acceso administrativo a estas solicitudes.";
  if (error?.code === "40001") return "La solicitud ya fue revisada. Actualiza la lista.";
  if (error?.code === "23514") return "Para aceptar se necesita una cuenta confirmada con datos coincidentes.";
  if (error?.code === "22023") return "Revisa los datos y filtros e intenta de nuevo.";
  return "No se pudo completar la operación. Comprueba la conexión e intenta de nuevo.";
}
let guardPromise;
export function requireAdmin() {
  guardPromise ??= (async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      location.replace("./index.html");
      throw new Error("SESION_REQUERIDA");
    }
    try { return await rpc("sisaep_admin_sesion"); }
    catch (error) {
      sessionStorage.setItem("panel-login-error", mensajeError(error));
      if (error?.code === "42501") await supabase.auth.signOut({ scope: "local" });
      location.replace("./index.html");
      throw error;
    }
  })();
  return guardPromise;
}
