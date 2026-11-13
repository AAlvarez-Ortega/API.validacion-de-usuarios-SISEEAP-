import { requireAdmin, rpc, mensajeError } from "./panel-api.js?v=1.24.0-576d56b72d26";
import { text, showSession, nombreRol } from "./panel-ui.js?v=1.24.0-576d56b72d26";

function filaPeriodo(periodo, escuela) {
  const fila = document.createElement("li");
  const etiqueta = document.createElement("a");
  const destino = new URL(document.getElementById("irOfertaBandeja").href);
  if (escuela) destino.searchParams.set("escuela", escuela);
  destino.searchParams.set("periodo", periodo.id);
  etiqueta.href = destino.href;
  etiqueta.textContent = periodo.descripcion;
  const estado = document.createElement("span");
  const publicación = periodo.revision ? `Revisión vigente ${periodo.revision}`
    : periodo.escuelas_publicadas ? `${periodo.escuelas_publicadas} planteles con oferta` : "Sin oferta publicada";
  estado.textContent = `${periodo.desde} al ${periodo.hasta} · ${publicación}`;
  fila.append(etiqueta, estado);
  return fila;
}

async function iniciarBandeja(session) {
  const filtro = document.getElementById("escuelaBandeja");
  const lista = document.getElementById("periodosBandeja");
  const indicadores = ["contadorPendientes","contadorAceptados","contadorRechazados","contadorConstancias","contadorCambios"];
  let consulta = 0;
  let filtroPreparado = false;
  async function actualizar(escuela = null) {
    const actual = ++consulta;
    for (const id of indicadores) text(id, "—");
    lista.replaceChildren();
    text("estadoPeriodosBandeja", "Consultando la oferta semestral…");
    text("mensajePanel", "Actualizando la bandeja de trabajo…");
    try {
      const data = await rpc("sisaep_inicio_panel", { p_escuela: escuela });
      if (actual !== consulta) return;
      if (!filtroPreparado && !data.escuela_fija && session.rol === "administrador_aplicacion") {
        for (const plantel of data.escuelas) {
          const option = document.createElement("option");
          option.value = plantel.cct;
          option.textContent = `${plantel.siglas || plantel.nombre} · ${plantel.cct}`;
          filtro.append(option);
        }
        document.getElementById("filtroBandeja").hidden = false;
        filtroPreparado = true;
      }
      const { pendientes, aceptadas, rechazadas } = data.solicitudes;
      text("contadorPendientes", pendientes);
      text("contadorAceptados", aceptadas);
      text("contadorRechazados", rechazadas);
      text("contadorConstancias", data.constancias_pendientes);
      text("contadorCambios", data.cambios_pendientes);
      lista.replaceChildren(...data.periodos.map(p => filaPeriodo(p, data.escuela)));
      text("estadoPeriodosBandeja", data.periodos.length ? "" : "No hay periodos IPN registrados.");
      const plantel = data.escuelas.find(e => e.cct === data.escuela);
      text("mensajePanel", plantel ? `Bandeja actualizada para ${plantel.siglas || plantel.nombre}.` : "Bandeja actualizada de todos los planteles.");
    } catch (error) {
      if (actual !== consulta) return;
      text("estadoPeriodosBandeja", "No se pudo consultar la oferta semestral.");
      text("mensajePanel", mensajeError(error));
    }
  }
  filtro.addEventListener("change", () => void actualizar(filtro.value || null));
  document.getElementById("actualizarBandeja").addEventListener("click", () => void actualizar(filtro.value || null));
  await actualizar();
}

try {
  const session = await requireAdmin();
  showSession(session);
  if (document.getElementById("contadorPendientes")) {
    await iniciarBandeja(session);
  }
  if (document.getElementById("uNombreCompleto")) {
    text("uNombreCompleto", session.nombre);
    text("uCorreo", session.correo);
    text("uRol", nombreRol(session));
    text("uEscuela", session.rol === "administrador_aplicacion" ? "Todas las escuelas" : session.escuela.nombre);
  }
} catch (error) { text("mensajePanel", mensajeError(error)); }
