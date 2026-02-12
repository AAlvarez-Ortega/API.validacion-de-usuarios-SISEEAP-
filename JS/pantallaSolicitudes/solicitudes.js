// ./JS/pantallaSolicitudes/solicitudes.js
import { supabase } from "../coneccionSB.js";
import { verificarRegistro } from "../pantallaSolicitudes/verificarRegistro.js";


/**
 * Requiere en el HTML:
 *  - #listaSolicitudes
 *  - #totalSolicitudes
 *  - #alumnoNombre, #alumnoBoleta, #alumnoCorreo, #alumnoSede
 *  - #btnVerificarRegistro, #btnEliminarPreregistro
 *  - #buscadorSolicitudes (nuevo)
 *  - #btnClearSolicitudes (opcional)
 */

const $lista = document.getElementById("listaSolicitudes");
const $contador = document.getElementById("totalSolicitudes");

const $dNombre = document.getElementById("alumnoNombre");
const $dBoleta = document.getElementById("alumnoBoleta");
const $dCorreo = document.getElementById("alumnoCorreo");
const $dSede = document.getElementById("alumnoSede");

const $btnVerificar = document.getElementById("btnVerificarRegistro");
const $btnEliminar = document.getElementById("btnEliminarPreregistro");

const $buscador = document.getElementById("buscadorSolicitudes");
const $btnClear = document.getElementById("btnClearSolicitudes");

let solicitudesCache = [];
let solicitudSeleccionada = null;
let escuelaFiltroId = null;


let filtroBoleta = "";

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
  // ✅ CAMBIO: ahora se llama boleta_o_empleado
  $dBoleta.textContent = s.boleta_o_empleado || "—";
  $dCorreo.textContent = s.correo || "—";
  $dSede.textContent = sedeTxt || "—";

  setBotonesVisible(true);
}

/* 🔎 NUEVO: aplica filtro por boleta sobre el cache */
function getSolicitudesFiltradas() {
  const q = (filtroBoleta || "").trim();
  if (!q) return solicitudesCache;

  // solo dígitos por si pegan espacios/guiones
  const qDigits = q.replace(/[^\d]/g, "");
  if (!qDigits) return solicitudesCache;

  // ✅ CAMBIO: filtrar por boleta_o_empleado
  return solicitudesCache.filter((s) =>
    String(s.boleta_o_empleado ?? "").includes(qDigits)
  );
}

/* 🔎 NUEVO: render "principal" que respeta el filtro */
function renderUI() {
  const filtradas = getSolicitudesFiltradas();

  // contador: muestra cuántas se ven (y guarda total en title)
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
      // mantiene selección en lista y detalle
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
      // ✅ CAMBIO: mostrar boleta_o_empleado
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
      // Ojo: la selección siempre debe venir del cache completo
      solicitudSeleccionada = solicitudesCache.find((x) => x.id === id);

      // re-render respetando filtro y marcando active
      renderUI();
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
              boleta_o_empleado,
              correo,
              curp,
              escuela_id,
              creado_en,
              escuelas ( id, nombre, siglas, cct )
            `,
            { count: "exact" }
          )

    .order("creado_en", { ascending: true });

  if (escuelaId) query = query.eq("escuela_id", escuelaId);

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando solicitudes:", error);
    $lista.innerHTML = `<div style="padding:12px;color:#b00020;">Error al cargar solicitudes.</div>`;
    if ($contador) $contador.textContent = "0";
    return;
  }

  solicitudesCache = data || [];

  // Render inicial respetando filtro actual
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

  // ✅ Botón verificar (lógica pendiente)
if ($btnVerificar) {
  $btnVerificar.addEventListener("click", async () => {
    if (!solicitudSeleccionada) return;

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
        return;
      }

      alert(
        `✅ Registro verificado.\n\n` +
        `Se creó el usuario en Auth (App-SISAEP).\n` +
        `Correo: ${res.email}\n` +
        `Contraseña temporal: ${res.password}\n\n` +
        `Se enviará correo de confirmación con las credenciales.`
      );

      // ✅ opcional: aquí podrías marcar la solicitud como "verificada" en SISAP
      // (si tienes una columna estado/verificado)

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



  // ✅ Botón eliminar (ya funcional)
  if ($btnEliminar) {
    $btnEliminar.addEventListener("click", async () => {
      if (!solicitudSeleccionada) return;

      const nombre = fullName(solicitudSeleccionada);
    
      const boleta = solicitudSeleccionada.boleta_o_empleado || "";

      const ok = confirm(`¿Eliminar la solicitud de:\n${nombre}\nBoleta/Empleado: ${boleta}?`);
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

      // recargar lista manteniendo filtro de escuela (y manteniendo el texto en buscador)
      await cargarSolicitudes({ escuelaId: escuelaFiltroId });
    });
  }
}

/* 🔎 NUEVO: setup del buscador por boleta */
function setupBuscador() {
  if (!$buscador) return;

  // limita a números (sin impedir pegar)
  $buscador.addEventListener("input", () => {
    // guarda y normaliza
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

// Escucha la escuela seleccionada desde escuelas.js para filtrar
window.addEventListener("escuela:seleccionada", async (ev) => {
  const escuelaId = ev.detail?.escuelaId || null;
  await cargarSolicitudes({ escuelaId });
});

document.addEventListener("DOMContentLoaded", async () => {
  setupBotones();
  setupBuscador();
  await cargarSolicitudes();
});
