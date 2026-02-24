import { supabase } from "../coneccionSB.js";
import { verificarRegistro } from "../pantallaSolicitudes/verificarRegistro.js";

/**
 * Requiere en el HTML:
 *  - #listaSolicitudes
 *  - #totalSolicitudes
 *  - #alumnoNombre, #alumnoBoleta, #alumnoCorreo, #alumnoSede, #alumnoEstado
 *  - #btnVerificarRegistro, #btnEliminarPreregistro
 *  - #buscadorSolicitudes, #btnClearSolicitudes
 *  - #btnMostrarTodas, #btnVerAceptados, #btnVerRechazados
 */

const $lista = document.getElementById("listaSolicitudes");
const $contador = document.getElementById("totalSolicitudes");

const $dNombre = document.getElementById("alumnoNombre");
const $dBoleta = document.getElementById("alumnoBoleta");
const $dCorreo = document.getElementById("alumnoCorreo");
const $dSede = document.getElementById("alumnoSede");
const $dEstado = document.getElementById("alumnoEstado");

const $btnVerificar = document.getElementById("btnVerificarRegistro");
const $btnEliminar = document.getElementById("btnEliminarPreregistro");

const $buscador = document.getElementById("buscadorSolicitudes");
const $btnClear = document.getElementById("btnClearSolicitudes");

// Botones de filtro por estado
const $btnTodas = document.getElementById("btnMostrarTodas");
const $btnAceptados = document.getElementById("btnVerAceptados");
const $btnRechazados = document.getElementById("btnVerRechazados");

let solicitudesCache = [];
let solicitudSeleccionada = null;
let escuelaFiltroId = null;

let filtroBoleta = "";
let estadoFiltro = "Pendiente"; // por defecto

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEstado(e) {
  const x = String(e || "").trim().toLowerCase();
  if (x === "aceptado") return "Aceptado";
  if (x === "rechazado") return "Rechazado";
  return "Pendiente";
}

function badgeClass(estado) {
  const e = normalizeEstado(estado);
  if (e === "Aceptado") return "badge-estado badge-estado--aceptado";
  if (e === "Rechazado") return "badge-estado badge-estado--rechazado";
  return "badge-estado badge-estado--pendiente";
}

function fullName(s) {
  return `${s.nombre ?? ""} ${s.apellido_paterno ?? ""} ${s.apellido_materno ?? ""}`.trim();
}

function resetDetalle() {
  if ($dNombre) $dNombre.textContent = "Selecciona una solicitud";
  if ($dBoleta) $dBoleta.textContent = "—";
  if ($dCorreo) $dCorreo.textContent = "—";
  if ($dSede) $dSede.textContent = "—";
  if ($dEstado) {
    $dEstado.textContent = "—";
    $dEstado.className = "badge-estado";
  }
  if ($btnVerificar) $btnVerificar.classList.add("hidden");
  if ($btnEliminar) $btnEliminar.classList.add("hidden");
}

function setBotonesByEstado(s) {
  const estado = normalizeEstado(s?.estado);

  // Verificar SOLO si está Pendiente
  if ($btnVerificar) $btnVerificar.classList.toggle("hidden", estado !== "Pendiente");

  // Botón “Eliminar” (rechazar) visible siempre que haya selección
  if ($btnEliminar) $btnEliminar.classList.remove("hidden");
}

function renderDetalle(s) {
  if (!$dNombre || !$dBoleta || !$dCorreo || !$dSede || !$dEstado) return;

  const nombreCompleto = fullName(s);

  const escuelaSiglas = s.escuelas?.siglas || "—";
  const escuelaNombre = s.escuelas?.nombre || "";
  const sedeTxt = escuelaNombre ? `${escuelaSiglas} — ${escuelaNombre}` : escuelaSiglas;

  $dNombre.textContent = nombreCompleto || "—";
  $dBoleta.textContent = s.boleta_o_empleado || "—";
  $dCorreo.textContent = s.correo || "—";
  $dSede.textContent = sedeTxt || "—";

  const estado = normalizeEstado(s.estado);
  $dEstado.textContent = estado;
  $dEstado.className = badgeClass(estado);

  // ✅ AQUÍ estaba el bug: setBotonesVisible no existe
  setBotonesByEstado(s);
}

/* aplica filtro por boleta sobre el cache */
function getSolicitudesFiltradas() {
  const q = (filtroBoleta || "").trim();
  if (!q) return solicitudesCache;

  const qDigits = q.replace(/[^\d]/g, "");
  if (!qDigits) return solicitudesCache;

  return solicitudesCache.filter((s) => String(s.boleta_o_empleado ?? "").includes(qDigits));
}

/* render principal */
function renderUI() {
  const filtradas = getSolicitudesFiltradas();

  if ($contador) {
    $contador.textContent = String(filtradas.length);
    $contador.title = `Mostrando ${filtradas.length} de ${solicitudesCache.length}`;
  }

  renderListaSolicitudes(filtradas);

  if (solicitudSeleccionada) {
    const sigueVisible = filtradas.some((x) => x.id === solicitudSeleccionada.id);
    if (!sigueVisible) {
      solicitudSeleccionada = null;
      resetDetalle();
    } else {
      renderDetalle(solicitudSeleccionada);
    }
  }
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
      const boleta = escapeHTML(s.boleta_o_empleado || "");
      const estadoTxt = escapeHTML(normalizeEstado(s.estado));
      const activeClass = solicitudSeleccionada?.id === s.id ? " is-active" : "";

      return `
        <button class="solicitudItem${activeClass}" type="button" data-solicitud-id="${id}">
          <div class="solicitudItem__logo">
            <img src="./img/Upiicsa.png" alt="" />
          </div>
          <div class="solicitudItem__meta">
            <div class="solicitudItem__nameRow">
              <div class="solicitudItem__name">${nombre}</div>
              <span class="${badgeClass(s.estado)}">${estadoTxt}</span>
            </div>
            <div class="solicitudItem__sub">${boleta}</div>
          </div>
        </button>
      `;
    })
    .join("");

  $lista.querySelectorAll(".solicitudItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-solicitud-id");
      solicitudSeleccionada = solicitudesCache.find((x) => x.id === id) || null;
      renderUI();
    });
  });
}

export async function cargarSolicitudes({ escuelaId = null } = {}) {
  if (!$lista) return;

  solicitudSeleccionada = null;
  escuelaFiltroId = escuelaId;

  resetDetalle();
  $lista.innerHTML = `<div style="padding:12px;opacity:.7;">Cargando solicitudes.</div>`;

  let query = supabase
    .from("solicitudes")
    .select(
      `
        id,
        nombre,
        apellido_paterno,
        apellido_materno,
        boleta_o_empleado,
        correo,
        curp,
        escuela_id,
        creado_en,
        estado,
        escuelas ( id, nombre, siglas, cct )
      `,
      { count: "exact" }
    )
    .order("creado_en", { ascending: true });

  if (escuelaId) query = query.eq("escuela_id", escuelaId);
  if (estadoFiltro) query = query.eq("estado", estadoFiltro);

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando solicitudes:", error);
    $lista.innerHTML = `<div style="padding:12px;color:#b00020;">Error al cargar solicitudes.</div>`;
    if ($contador) $contador.textContent = "0";
    return;
  }

  solicitudesCache = data || [];
  renderUI();

  const filtradas = getSolicitudesFiltradas();
  if (!filtroBoleta && filtradas.length) {
    solicitudSeleccionada = filtradas[0];
    renderUI();
  } else if (!filtradas.length) {
    resetDetalle();
  }
}

/** ✅ Actualiza estado en cache + quita de lista si aplica (sin recargar toda la pantalla) */
function aplicarCambioEstadoLocal(id, nuevoEstado) {
  const idx = solicitudesCache.findIndex((x) => x.id === id);
  if (idx >= 0) solicitudesCache[idx] = { ...solicitudesCache[idx], estado: nuevoEstado };

  // Si estamos viendo Pendientes y cambió a Aceptado/Rechazado, debe salir de la lista
  if (estadoFiltro === "Pendiente") {
    solicitudesCache = solicitudesCache.filter((x) => x.id !== id);
    solicitudSeleccionada = null;
    resetDetalle();
  } else {
    // Si estamos en Aceptados/Rechazados, refresca el detalle si sigue seleccionado
    if (solicitudSeleccionada?.id === id) {
      solicitudSeleccionada = solicitudesCache.find((x) => x.id === id) || null;
      if (solicitudSeleccionada) renderDetalle(solicitudSeleccionada);
    }
  }

  renderUI();
}

function setupBotones() {
  resetDetalle();

  if ($btnVerificar) {
    $btnVerificar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      const id = solicitudSeleccionada.id;

      try {
        $btnVerificar.disabled = true;
        const oldText = $btnVerificar.textContent;
        $btnVerificar.textContent = "Verificando...";

        const res = await verificarRegistro(solicitudSeleccionada);

        if (!res.ok) {
          const map = {
            NO_EXISTE_PADRON: "❌ No existe en el padrón (App_Solicitudes).",
            DATOS_NO_COINCIDEN: "❌ Los datos no coinciden con el padrón.",
            AUTH_ERROR: `❌ Error creando usuario: ${res.error || "desconocido"}`,
            EMAIL_YA_EXISTE: "⚠️ El correo ya está registrado en Auth.",
          };
          alert(map[res.reason] || "❌ No se pudo verificar.");
          $btnVerificar.textContent = oldText;
          return;
        }

        alert(
          `✅ Registro verificado.\n\n` +
            `Se creó el usuario en Auth (App-SISAEP).\n` +
            `Correo: ${res.email}\n` +
            `Contraseña temporal: ${res.password}\n\n` +
            `Se enviará correo de confirmación con las credenciales.`
        );

        // ✅ UI instantánea: marcar aceptado y quitar de pendientes sin recargar
        aplicarCambioEstadoLocal(id, "Aceptado");

        $btnVerificar.textContent = oldText;
      } catch (e) {
        console.error(e);
        alert(`❌ ${e.message || "Error verificando"}`);
      } finally {
        $btnVerificar.disabled = false;
        $btnVerificar.textContent = "Verificar Registro";
      }
    });
  }

  if ($btnEliminar) {
    $btnEliminar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      const id = solicitudSeleccionada.id;
      const nombre = fullName(solicitudSeleccionada);
      const boleta = solicitudSeleccionada.boleta_o_empleado || "";

      const ok = confirm(`¿Rechazar la solicitud de:\n${nombre}\nBoleta/Empleado: ${boleta}?`);
      if (!ok) return;

      const { error } = await supabase
        .from("solicitudes")
        .update({ estado: "Rechazado" })
        .eq("id", id);

      if (error) {
        console.error("Error rechazando solicitud:", error);
        alert("❌ No se pudo rechazar la solicitud. Revisa consola.");
        return;
      }

      // ✅ UI instantánea: marcar rechazado y quitar de pendientes sin recargar
      aplicarCambioEstadoLocal(id, "Rechazado");
    });
  }
}

function setupBuscador() {
  if (!$buscador) return;

  $buscador.addEventListener("input", () => {
    filtroBoleta = $buscador.value;
    renderUI();
  });

  if ($btnClear) {
    $btnClear.addEventListener("click", () => {
      filtroBoleta = "";
      $buscador.value = "";
      renderUI();
      $buscador.focus();
    });
  }
}

function setupFiltrosEstado() {
  // Mostrar todas => Pendientes (por tu requerimiento)
  if ($btnTodas) {
    $btnTodas.addEventListener("click", async () => {
      estadoFiltro = "Pendiente";
      escuelaFiltroId = null;
      await cargarSolicitudes({ escuelaId: null });
    });
  }

  if ($btnAceptados) {
    $btnAceptados.addEventListener("click", async () => {
      estadoFiltro = "Aceptado";
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
    });
  }

  if ($btnRechazados) {
    $btnRechazados.addEventListener("click", async () => {
      estadoFiltro = "Rechazado";
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
    });
  }
}

// Escucha la escuela seleccionada desde escuelas.js
window.addEventListener("escuela:seleccionada", async (ev) => {
  const escuelaId = ev.detail?.escuelaId || null;
  escuelaFiltroId = escuelaId;
  await cargarSolicitudes({ escuelaId });
});

document.addEventListener("DOMContentLoaded", async () => {
  setupBotones();
  setupBuscador();
  setupFiltrosEstado();

  // carga inicial: Pendientes
  estadoFiltro = "Pendiente";
  await cargarSolicitudes({ escuelaId: null });
});