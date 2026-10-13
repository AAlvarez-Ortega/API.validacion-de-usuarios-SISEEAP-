import { requireAdmin, rpc, mensajeError } from "./panel-api.js";
import { mensajeValidacion, puedeAceptar } from "./validacion-solicitud.js";
import { text, showSession, fecha } from "./panel-ui.js";
const list = document.getElementById("listaSolicitudes");
const detail = document.getElementById("detalleSolicitud");
const check = document.getElementById("revisionManual");
const accept = document.getElementById("btnAceptar");
const reject = document.getElementById("btnRechazar");
const search = document.getElementById("buscadorSolicitudes");
const filter = document.getElementById("filtroEstado");
const refresh = document.getElementById("btnActualizar");
const previous = document.getElementById("btnAnterior");
const next = document.getElementById("btnSiguiente");
const allowedStates = ["Pendiente", "Aceptado", "Rechazado", "Todas"];
const initial = new URLSearchParams(location.search).get("estado");
if (allowedStates.includes(initial)) filter.value = initial;
let items = [], selected = null, offset = 0, total = 0, generation = 0, busy = false;
const limit = 50;
function controls() {
  const pending = selected?.estado === "Pendiente";
  document.getElementById("accionesRevision").hidden = !pending;
  accept.disabled = !puedeAceptar(selected, check.checked, busy);
  reject.disabled = busy || !pending || !check.checked;
  check.disabled = busy;
  filter.disabled = busy;
  search.disabled = busy;
  refresh.disabled = busy;
  previous.disabled = busy || offset === 0;
  next.disabled = busy || offset + limit >= total;
}
function renderDetail(request) {
  selected = request;
  check.checked = false;
  detail.hidden = !request;
  document.getElementById("sinSeleccion").hidden = !!request;
  if (request) {
    text("alumnoNombre", [request.nombre, request.apellido_paterno, request.apellido_materno].join(" "));
    text("alumnoBoleta", request.boleta_o_empleado);
    text("alumnoCorreo", request.correo);
    text("alumnoCurp", request.curp);
    text("alumnoSede", request.escuelas.nombre);
    text("alumnoEstado", request.estado);
    document.getElementById("alumnoEstado").className = `badge ${request.estado.toLowerCase()}`;
    text("creadoEn", fecha(request.creado_en));
    text("revisadoEn", fecha(request.revisado_en));
    text("coincidePadron", mensajeValidacion(request.validacion_padron, "padron"));
    text("cuentaConfirmada", mensajeValidacion(request.validacion_cuenta, "cuenta"));
    text("conflictoAlta", request.conflicto_identidad ? "Existe un registro relacionado con datos diferentes o duplicados. Corrige la identidad antes de aceptar; no se sobrescribirá otra cuenta." : "");
  }
  controls();
}
function renderList() {
  list.replaceChildren();
  if (!items.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No hay solicitudes con estos filtros."; list.append(empty); }
  for (const request of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "solicitudItem";
    button.setAttribute("aria-pressed", String(selected?.id === request.id));
    const name = document.createElement("strong");
    name.textContent = [request.nombre, request.apellido_paterno, request.apellido_materno].join(" ");
    const number = document.createElement("span"); number.textContent = request.boleta_o_empleado;
    const state = document.createElement("span"); state.textContent = request.estado;
    state.className = `badge ${request.estado.toLowerCase()}`;
    button.append(name, number, state);
    button.disabled = busy;
    button.addEventListener("click", () => { renderDetail(request); renderList(); });
    list.append(button);
  }
  text("totalSolicitudes", total);
  text("paginaSolicitudes", total ? `${offset + 1}–${Math.min(offset + limit, total)} de ${total}` : "0 solicitudes");
}
async function load() {
  const current = ++generation;
  text("mensajePanel", "Actualizando solicitudes…");
  try {
    const data = await rpc("sisaep_admin_solicitudes", {
      p_estado: filter.value === "Todas" ? null : filter.value,
      p_busqueda: search.value.trim(), p_offset: offset, p_limite: limit
    });
    if (current !== generation) return;
    items = data.solicitudes; total = data.total;
    renderDetail(items.find(item => item.id === selected?.id) || null);
    renderList(); controls();
    text("mensajePanel", "Lista actualizada.");
  } catch (error) {
    if (current !== generation) return;
    items = []; total = 0; renderDetail(null); renderList();
    text("totalSolicitudes", "—"); text("paginaSolicitudes", "Lista no disponible");
    text("mensajePanel", mensajeError(error));
  }
}
async function review(state) {
  if (busy || selected?.estado !== "Pendiente" || !check.checked) return;
  if (state === "Aceptado" && !puedeAceptar(selected, check.checked, busy)) return;
  const request = selected;
  const accion = state === "Aceptado" ? "Aceptar y validar en el padrón" : "Rechazar";
  const detalle = state === "Aceptado" ? " La aprobación da de alta el padrón; la persona activará su cuenta desde la app si aún no tiene acceso." : "";
  if (!window.confirm(`${accion} la solicitud de ${request.nombre} ${request.apellido_paterno}, boleta/empleado ${request.boleta_o_empleado}?${detalle}`)) return;
  busy = true; ++generation; controls(); renderList();
  text("mensajePanel", "Guardando revisión…");
  let resultMessage;
  try {
    await rpc("sisaep_admin_revisar_version", { p_id: request.id, p_estado: state, p_estado_esperado: "Pendiente", p_version: request.version });
    resultMessage = `Solicitud marcada como ${state.toLowerCase()}.`;
  } catch (error) { resultMessage = mensajeError(error); }
  finally {
    busy = false;
    await load();
    text("mensajePanel", resultMessage);
    controls();
  }
}
accept.addEventListener("click", () => review("Aceptado"));
reject.addEventListener("click", () => review("Rechazado"));
check.addEventListener("change", controls);
let searchTimer;
filter.addEventListener("change", () => { clearTimeout(searchTimer); offset = 0; load(); });
search.addEventListener("input", () => { clearTimeout(searchTimer); offset = 0; searchTimer = setTimeout(load, 300); });
refresh.addEventListener("click", () => { clearTimeout(searchTimer); load(); });
previous.addEventListener("click", () => { offset = Math.max(0, offset - limit); load(); });
next.addEventListener("click", () => { offset += limit; load(); });
try { showSession(await requireAdmin()); await load(); }
catch (error) { text("mensajePanel", mensajeError(error)); }
