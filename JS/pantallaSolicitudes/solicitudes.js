// ./JS/pantallaSolicitudes/solicitudes.js
import { supabase } from "../coneccionSB.js";

/**
 * Requiere en el HTML:
 *  - #listaSolicitudes
 *  - #totalSolicitudes
 *  - #alumnoNombre, #alumnoBoleta, #alumnoCorreo, #alumnoSede
 *  - #btnVerificarRegistro, #btnEliminarPreregistro
 */

const $lista = document.getElementById("listaSolicitudes");
const $contador = document.getElementById("totalSolicitudes");

const $dNombre = document.getElementById("alumnoNombre");
const $dBoleta = document.getElementById("alumnoBoleta");
const $dCorreo = document.getElementById("alumnoCorreo");
const $dSede = document.getElementById("alumnoSede");

const $btnVerificar = document.getElementById("btnVerificarRegistro");
const $btnEliminar = document.getElementById("btnEliminarPreregistro");

let solicitudesCache = [];
let solicitudSeleccionada = null;
let escuelaFiltroId = null;

function escapeHTML(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fullName(s) {
  return `${s.nombre ?? ""} ${s.apellido_paterno ?? ""} ${s.apellido_materno ?? ""}`.trim();
}
function setBotonesVisible(visible) {
  console.log("si se esta activando", visible);
  if ($btnVerificar) $btnVerificar.classList.toggle("hidden", !visible);
  if ($btnEliminar) $btnEliminar.classList.toggle("hidden", !visible);
}


function resetDetalle() {
  if ($dNombre) $dNombre.textContent = "Selecciona una solicitud";
  if ($dBoleta) $dBoleta.textContent = "—";
  if ($dCorreo) $dCorreo.textContent = "—";
  if ($dSede) $dSede.textContent = "—";
  setBotonesVisible(false);
}

function renderDetalle(s) {
  if (!$dNombre || !$dBoleta || !$dCorreo || !$dSede) return;

  const nombreCompleto = fullName(s);

  const escuelaSiglas = s.escuelas?.siglas || "—";
  const escuelaNombre = s.escuelas?.nombre || "";
  const sedeTxt = escuelaNombre ? `${escuelaSiglas} — ${escuelaNombre}` : escuelaSiglas;

  $dNombre.textContent = nombreCompleto || "—";
  $dBoleta.textContent = s.numero_boleta || "—";
  $dCorreo.textContent = s.correo || "—";
  $dSede.textContent = sedeTxt || "—";

  setBotonesVisible(true);
}

function renderListaSolicitudes(items) {
  if (!$lista) return;

  if (!items.length) {
    $lista.innerHTML = `<div style="padding:12px;opacity:.7;">No hay solicitudes.</div>`;
    return;
  }

  $lista.innerHTML = items
    .map((s) => {
      const id = escapeHTML(s.id);
      const nombre = escapeHTML(fullName(s));
      const boleta = escapeHTML(s.numero_boleta || "");
      const activeClass = solicitudSeleccionada?.id === s.id ? " is-active" : "";

      return `
        <button class="solicitudItem${activeClass}" type="button" data-solicitud-id="${id}">
          <div class="solicitudItem__logo">
            <img src="./img/Upiicsa.png" alt="" />
          </div>
          <div class="solicitudItem__meta">
            <div class="solicitudItem__name">${nombre}</div>
            <div class="solicitudItem__sub">${boleta}</div>
          </div>
        </button>
      `;
    })
    .join("");

  $lista.querySelectorAll(".solicitudItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-solicitud-id");
      solicitudSeleccionada = solicitudesCache.find((x) => x.id === id);

      renderListaSolicitudes(solicitudesCache);
      if (solicitudSeleccionada) renderDetalle(solicitudSeleccionada);
    });
  });
}

export async function cargarSolicitudes({ escuelaId = null } = {}) {
  if (!$lista) return;

  solicitudSeleccionada = null;
  escuelaFiltroId = escuelaId;

  resetDetalle();
  $lista.innerHTML = `<div style="padding:12px;opacity:.7;">Cargando solicitudes...</div>`;

  // ✅ ORDEN: más antigua -> más nueva
  let query = supabase
    .from("solicitudes")
    .select(
      `
        id,
        nombre,
        apellido_paterno,
        apellido_materno,
        numero_boleta,
        correo,
        curp,
        escuela_id,
        creado_en,
        escuelas ( id, nombre, siglas )
      `,
      { count: "exact" }
    )
    .order("creado_en", { ascending: true });

  if (escuelaId) query = query.eq("escuela_id", escuelaId);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error cargando solicitudes:", error);
    $lista.innerHTML = `<div style="padding:12px;color:#b00020;">Error al cargar solicitudes.</div>`;
    if ($contador) $contador.textContent = "0";
    return;
  }

  solicitudesCache = data || [];

  if ($contador) $contador.textContent = String(count ?? solicitudesCache.length);

  renderListaSolicitudes(solicitudesCache);

  // auto-seleccionar la primera (la más antigua)
  if (solicitudesCache.length) {
    solicitudSeleccionada = solicitudesCache[0];
    renderListaSolicitudes(solicitudesCache);
    renderDetalle(solicitudSeleccionada);
  } else {
    resetDetalle();
  }
}

function setupBotones() {
  resetDetalle();

  // ✅ Botón verificar (lógica pendiente)
  if ($btnVerificar) {
    $btnVerificar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      // TODO: aquí después vas a mover/crear usuario, actualizar estado, etc.
      console.log("Verificar (pendiente):", solicitudSeleccionada);

      alert("✅ Verificar solicitud (pendiente de lógica). Revisa consola.");
    });
  }

  // ✅ Botón eliminar (ya funcional)
  if ($btnEliminar) {
    $btnEliminar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      const nombre = fullName(solicitudSeleccionada);
      const boleta = solicitudSeleccionada.numero_boleta || "";

      const ok = confirm(`¿Eliminar la solicitud de:\n${nombre}\nBoleta: ${boleta}?`);
      if (!ok) return;

      const { error } = await supabase
        .from("solicitudes")
        .delete()
        .eq("id", solicitudSeleccionada.id);

      if (error) {
        console.error("Error eliminando solicitud:", error);
        alert("❌ No se pudo eliminar la solicitud. Revisa consola.");
        return;
      }

      // recargar lista manteniendo filtro
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
    });
  }
}

// Escucha la escuela seleccionada desde escuelas.js para filtrar
window.addEventListener("escuela:seleccionada", async (ev) => {
  const escuelaId = ev.detail?.escuelaId || null;
  await cargarSolicitudes({ escuelaId });
});

document.addEventListener("DOMContentLoaded", async () => {
  setupBotones();
  await cargarSolicitudes();
});
