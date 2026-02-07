import { supabase } from "../coneccionSB.js";

/**
 * Requiere en el HTML:
 * - Panel lista solicitudes:  #listaSolicitudes (contenedor)
 * - Contador:                #totalSolicitudes
 * - Detalle:
 *    #alumnoNombre
 *    #alumnoBoleta
 *    #alumnoCorreo
 *    #alumnoSede   (aquí ponemos siglas/nombre escuela)
 *
 * - Botones (pueden ser id o clase; aquí uso ID):
 *    #btnVerificarRegistro
 *    #btnEliminarPreregistro
 *
 * Recomendación: que los botones inicien ocultos en CSS:
 *   display:none;
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
  if ($btnVerificar) $btnVerificar.style.display = visible ? "" : "none";
  if ($btnEliminar) $btnEliminar.style.display = visible ? "" : "none";
}

function renderDetalle(s) {
  if (!$dNombre || !$dBoleta || !$dCorreo || !$dSede) return;

  const nombreCompleto = fullName(s);
  const escuelaSiglas = s.escuelas?.siglas || "—";
  const escuelaNombre = s.escuelas?.nombre || "";

  $dNombre.innerHTML = escapeHTML(nombreCompleto).replaceAll(" ", " ");
  $dBoleta.textContent = s.numero_boleta || "—";
  $dCorreo.textContent = s.correo || "—";

  // Sede tipo imagen: "UPIICSA — Nombre completo..."
  const sedeTxt = escuelaNombre
    ? `${escuelaSiglas} — ${escuelaNombre}`
    : `${escuelaSiglas}`;

  $dSede.textContent = sedeTxt;

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

  // click seleccionar
  $lista.querySelectorAll(".solicitudItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-solicitud-id");
      solicitudSeleccionada = solicitudesCache.find((x) => x.id === id);

      // Re-render para marcar activo
      renderListaSolicitudes(solicitudesCache);

      if (solicitudSeleccionada) renderDetalle(solicitudSeleccionada);
    });
  });
}

export async function cargarSolicitudes({ escuelaId = null } = {}) {
  if (!$lista) return;

  setBotonesVisible(false);
  solicitudSeleccionada = null;
  escuelaFiltroId = escuelaId;

  $lista.innerHTML = `<div style="padding:12px;opacity:.7;">Cargando solicitudes...</div>`;

  // Trae solicitudes + join de escuelas (relación por FK escuela_id -> escuelas.id)
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
    .order("creado_en", { ascending: false });

  if (escuelaId) query = query.eq("escuela_id", escuelaId);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error cargando solicitudes:", error);
    $lista.innerHTML = `<div style="padding:12px;color:#b00020;">Error al cargar solicitudes.</div>`;
    if ($contador) $contador.textContent = "0";
    return;
  }

  solicitudesCache = data || [];

  // contador
  if ($contador) $contador.textContent = String(count ?? solicitudesCache.length);

  renderListaSolicitudes(solicitudesCache);

  // Si hay elementos, auto-selecciona el primero (opcional, como demo)
  if (solicitudesCache.length) {
    solicitudSeleccionada = solicitudesCache[0];
    renderListaSolicitudes(solicitudesCache);
    renderDetalle(solicitudSeleccionada);
  }
}

function setupBotones() {
  // Botones visibles solo cuando hay selección
  setBotonesVisible(false);

  if ($btnVerificar) {
    $btnVerificar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      // Aquí tu lógica real (ej: actualizar estado, mover a usuarios, etc.)
      console.log("Verificar registro:", solicitudSeleccionada);
      alert(`Verificar registro: ${fullName(solicitudSeleccionada)} (${solicitudSeleccionada.numero_boleta})`);
    });
  }

  if ($btnEliminar) {
    $btnEliminar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      const ok = confirm(`¿Seguro que deseas eliminar el preregistro de ${fullName(solicitudSeleccionada)}?`);
      if (!ok) return;

      const { error } = await supabase
        .from("solicitudes")
        .delete()
        .eq("id", solicitudSeleccionada.id);

      if (error) {
        console.error("Error eliminando:", error);
        alert("No se pudo eliminar. Revisa consola.");
        return;
      }

      // Recargar lista (respeta filtro)
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
    });
  }
}

// Escucha selección de escuela desde escuelas.js
window.addEventListener("escuela:seleccionada", async (ev) => {
  const escuelaId = ev.detail?.escuelaId || null;
  await cargarSolicitudes({ escuelaId });
});

document.addEventListener("DOMContentLoaded", async () => {
  setupBotones();
  await cargarSolicitudes(); // carga todas al inicio
});
