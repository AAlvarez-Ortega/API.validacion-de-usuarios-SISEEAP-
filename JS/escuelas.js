// ./JS/escuelas.js
import { supabase } from "./coneccionSB.js";

/**
 * Requiere en el HTML:
 * - #listaEscuelas (contenedor)
 * - #buscadorEscuelas (input)
 * Opcional:
 * - #nombreUsuario (texto arriba, ej: "UPIICSA")
 * - #descripcionUsuario (descripcion arriba)
 */

const $lista = document.getElementById("listaEscuelas");
const $buscador = document.getElementById("buscadorEscuelas");
const $nombreUsuario = document.getElementById("nombreUsuario");
const $descripcionUsuario = document.getElementById("descripcionUsuario");

let escuelasCache = [];

function escapeHTML(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderEscuelas(items) {
  if (!$lista) return;

  if (!items.length) {
    $lista.innerHTML = `<div style="padding:12px;opacity:.7;">No hay escuelas para mostrar.</div>`;
    return;
  }

  $lista.innerHTML = items
    .map((e) => {
      const siglas = escapeHTML(e.siglas);
      const nombre = escapeHTML(e.nombre);
      const id = escapeHTML(e.id);

      return `
        <button class="schoolItem" type="button" data-escuela-id="${id}">
          <div class="schoolItem__logo" aria-hidden="true">
            <img src="./img/Upiicsa.png" alt="" />
          </div>
          <div class="schoolItem__text">
            <div class="schoolItem__name">${siglas}</div>
            <div class="schoolItem__sub">IPN</div>
          </div>
        </button>
      `;
    })
    .join("");

  // Click en escuela -> disparar evento global para filtrar solicitudes (opcional)
  $lista.querySelectorAll(".schoolItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const escuelaId = btn.getAttribute("data-escuela-id");
      const escuela = escuelasCache.find((x) => x.id === escuelaId);

      // UI arriba (tarjeta usuario/escuela)
      if (escuela && $nombreUsuario) $nombreUsuario.textContent = escuela.siglas;
      if (escuela && $descripcionUsuario) $descripcionUsuario.textContent = escuela.nombre;

      // Evento para que solicitudes.js filtre
      window.dispatchEvent(
        new CustomEvent("escuela:seleccionada", {
          detail: { escuelaId, escuela },
        })
      );
    });
  });
}

function setupSearch() {
  if (!$buscador) return;

  $buscador.addEventListener("input", () => {
    const q = ($buscador.value || "").trim().toLowerCase();
    if (!q) return renderEscuelas(escuelasCache);

    const filtradas = escuelasCache.filter((e) => {
      return (
        (e.siglas || "").toLowerCase().includes(q) ||
        (e.nombre || "").toLowerCase().includes(q)
      );
    });

    renderEscuelas(filtradas);
  });
}

export async function cargarEscuelas() {
  if (!$lista) return;

  $lista.innerHTML = `<div style="padding:12px;opacity:.7;">Cargando escuelas...</div>`;

  const { data, error } = await supabase
    .from("escuelas")
    .select("id,nombre,siglas")
    .order("siglas", { ascending: true });

  if (error) {
    console.error("Error cargando escuelas:", error);
    $lista.innerHTML = `<div style="padding:12px;color:#b00020;">Error al cargar escuelas.</div>`;
    return;
  }

  escuelasCache = data || [];
  renderEscuelas(escuelasCache);
}

document.addEventListener("DOMContentLoaded", async () => {
  setupSearch();
  await cargarEscuelas();
});
