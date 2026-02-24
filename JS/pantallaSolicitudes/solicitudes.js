
import { supabase } from "..//coneccionSB.js";
import { verificarRegistro } from "../pantallaSolicitudes/verificarRegistro.js";

/**s
 * Requiere en el HTML:
 *  - #listaSolicitudes
 *  - #totalSolicitudes
 *  - #alumnoNombre, #alumnoBoleta, #alumnoCorreo, #alumnoSede, #alumnoEstado (nuevo)
 *  - #btnVerificarRegistro, #btnEliminarPreregistro
 *  - #buscadorSolicitudes
 *  - #btnClearSolicitudes (opcional)
 *  - #btnMostrarTodas (ya existe)
 *  - #btnVerAceptados (nuevo)
 *  - #btnVerRechazados (nuevo)
 */

const $lista = document.getElementById("listaSolicitudes");
const $contador = document.getElementById("totalSolicitudes");

const $dNombre = document.getElementById("alumnoNombre");
const $dBoleta = document.getElementById("alumnoBoleta");
const $dCorreo = document.getElementById("alumnoCorreo");
const $dSede = document.getElementById("alumnoSede");
const $dEstado = document.getElementById("alumnoEstado"); // ✅ NUEVO

const $btnVerificar = document.getElementById("btnVerificarRegistro");
const $btnEliminar = document.getElementById("btnEliminarPreregistro");

const $buscador = document.getElementById("buscadorSolicitudes");
const $btnClear = document.getElementById("btnClearSolicitudes");

// ✅ Botones de filtro por estado
const $btnTodas = document.getElementById("btnMostrarTodas");
const $btnAceptados = document.getElementById("btnVerAceptados");
const $btnRechazados = document.getElementById("btnVerRechazados");

let solicitudesCache = [];
let solicitudSeleccionada = null;
let escuelaFiltroId = null;

let filtroBoleta = "";
let estadoFiltro = "Pendiente"; // ✅ por defecto

function escapeHTML(str = "") {
  return String(str)
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
  if ($btnVerificar) $btnVerificar.classList.toggle("hidden", !visible);
  if ($btnEliminar) $btnEliminar.classList.toggle("hidden", !visible);
}

function resetDetalle() {
  if ($dNombre) $dNombre.textContent = "Selecciona una solicitud";
  if ($dBoleta) $dBoleta.textContent = "—";
  if ($dCorreo) $dCorreo.textContent = "—";
  if ($dSede) $dSede.textContent = "—";
  if ($dEstado) $dEstado.textContent = "—"; // ✅ NUEVO
  setBotonesVisible(false);
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
  $dEstado.textContent = s.estado || "—"; // ✅ NUEVO

  setBotonesVisible(true);
}

/* 🔎 aplica filtro por boleta sobre el cache */
function getSolicitudesFiltradas() {
  const q = (filtroBoleta || "").trim();
  if (!q) return solicitudesCache;

  // solo dígitos por si pegan espacios/guiones
  const qDigits = q.replace(/[^\d]/g, "");
  if (!qDigits) return solicitudesCache;

  return solicitudesCache.filter((s) => String(s.boleta_o_empleado ?? "").includes(qDigits));
}

/* 🔎 render principal */
function renderUI() {
  const filtradas = getSolicitudesFiltradas();

  // contador: muestra cuántas se ven
  if ($contador) {
    $contador.textContent = String(filtradas.length);
    $contador.title = `Mostrando ${filtradas.length} de ${solicitudesCache.length}`;
  }

  renderListaSolicitudes(filtradas);

  // Si la seleccionada ya no existe en el filtro, resetea detalle
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

  // ✅ ORDEN: más antigua -> más nueva
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

  // ✅ FILTRO POR ESTADO (por defecto Pendiente)
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

  // auto-seleccionar la primera (solo al cargar SIN filtro de boleta)
  const filtradas = getSolicitudesFiltradas();
  if (!filtroBoleta && filtradas.length) {
    solicitudSeleccionada = filtradas[0];
    renderUI();
  } else if (!filtradas.length) {
    resetDetalle();
  }
}

function setupBotones() {
  resetDetalle();

  // ✅ Botón verificar (lógica pendiente - no la tocamos)
  if ($btnVerificar) {
    $btnVerificar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      try {
        $btnVerificar.disabled = true;
        const oldText = $btnVerificar.textContent;
        $btnVerificar.textContent = "Verificando.";

        const res = await verificarRegistro(solicitudSeleccionada);

        if (!res.ok) {
          const map = {
            NO_EXISTE_PADRON: "❌ No existe en el padrón (App_Solicitudes).",
            DATOS_NO_COINCIDEN: "❌ Los datos no coinciden con el padrón.",
            AUTH_ERROR: `❌ Error creando usuario: ${res.error || "desconocido"}`,
            EMAIL_YA_EXISTE: "⚠️ El correo ya está registrado en Auth.",
          };
          alert(map[res.reason] || "❌ No se pudo verificar.");
          return;
        }

        alert(
          `✅ Registro verificado.\n\n` +
            `Se creó el usuario en Auth (App-SISAEP).\n` +
            `Correo: ${res.email}\n` +
            `Contraseña temporal: ${res.password}\n\n` +
            `Se enviará correo de confirmación con las credenciales.`
        );

        // ✅ más adelante: aquí marcaremos estado = 'Aceptado' si quieres
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

  // ✅ Botón "Eliminar" => ahora rechaza (NO borra)
  if ($btnEliminar) {
    $btnEliminar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      const nombre = fullName(solicitudSeleccionada);
      const boleta = solicitudSeleccionada.boleta_o_empleado || "";

      const ok = confirm(
        `¿Rechazar la solicitud de:\n${nombre}\nBoleta/Empleado: ${boleta}?`
      );
      if (!ok) return;

      const { error } = await supabase
        .from("solicitudes")
        .update({ estado: "Rechazado" })
        .eq("id", solicitudSeleccionada.id);

      if (error) {
        console.error("Error rechazando solicitud:", error);
        alert("❌ No se pudo rechazar la solicitud. Revisa consola.");
        return;
      }

      // recargar lista manteniendo filtro de escuela y estado actual
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
    });
  }
}

/* 🔎 setup del buscador por boleta */
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

/* ✅ Filtros por estado */
function setupFiltrosEstado() {
  // Mostrar todas => realmente Pendientes (por requerimiento)
  if ($btnTodas) {
    $btnTodas.addEventListener("click", async () => {
      estadoFiltro = "Pendiente";
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
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

// Escucha la escuela seleccionada desde escuelas.js para filtrar
window.addEventListener("escuela:seleccionada", async (ev) => {
  const escuelaId = ev.detail?.escuelaId || null;
  await cargarSolicitudes({ escuelaId });
});

document.addEventListener("DOMContentLoaded", async () => {
  setupBotones();
  setupBuscador();
  setupFiltrosEstado();

  // ✅ carga inicial: Pendientes
  estadoFiltro = "Pendiente";
  await cargarSolicitudes();
});