import { requireAdmin, rpc } from "./panel-api.js?v=1.24.0-576d56b72d26";
import { fecha, showSession, text } from "./panel-ui.js?v=1.24.0-576d56b72d26";
import { supabase } from "./coneccionSB.js?v=1.24.0-576d56b72d26";

const $ = id => document.getElementById(id);
const size = 30;
let chat, filtro = "", motivo = "", listaOffset = 0, mensajeOffset = 0, ocupado = false;
let listaMas = false, mensajesMas = false, disponible = false;
let cuenta;

function limpiar() {
  disponible = false;
  chat = null;
  motivo = "";
  $("chatMotivo").value = "";
  for (const id of ["listaChats", "chatMensajes"]) $(id).replaceChildren();
  $("revisionChats").hidden = true;
}
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || disponible && session?.user?.id && session.user.id !== cuenta) {
    limpiar();
    text("mensajePanel", "Vuelve a abrir esta página para validar tu sesión.");
  }
});

function botones() {
  $("revisionChats").querySelectorAll("button").forEach(b => { b.disabled = ocupado; });
  $("chatsAnterior").disabled ||= listaOffset === 0;
  $("chatsSiguiente").disabled ||= !listaMas;
  $("mensajesAnterior").disabled ||= mensajeOffset === 0;
  $("mensajesSiguiente").disabled ||= !mensajesMas;
}
function nodo(tag, value) {
  const item = document.createElement(tag);
  item.textContent = value;
  return item;
}
async function ejecutar(fn) {
  if (ocupado) return;
  ocupado = true;
  botones();
  try { await fn(); }
  catch (error) {
    if (["42501", "PT401"].includes(error?.code)) {
      limpiar();
      text("mensajePanel", "Tu cuenta o sesión ya no tiene acceso a la revisión de chats.");
    } else text("mensajePanel", error?.code === "22023"
      ? "Escribe un motivo de 8 a 500 caracteres." : "No se pudo completar la consulta. Intenta de nuevo.");
  } finally {
    ocupado = false;
    botones();
  }
}
async function listar(offset) {
  const { filas, mas } = await rpc("sisaep_revision_chats", { p_busqueda: filtro, p_offset: offset });
  if (!disponible) return;
  listaOffset = offset;
  listaMas = mas;
  const lista = $("listaChats");
  lista.replaceChildren();
  for (const row of filas) {
    const button = nodo("button", row.titulo);
    button.type = "button";
    button.className = "solicitudItem";
    const origen = row.origen === "historico" ? "Histórico" : row.tipo === "CURSO" ? "Curso" : row.tipo === "GRUPO" ? "Grupo" : "Directo";
    button.append(nodo("span", `${origen} · ${fecha(row.fecha)}${row.cerrada_en ? " · Cerrado" : ""}`));
    button.addEventListener("click", () => {
      chat = row;
      motivo = "";
      text("chatTitulo", row.titulo);
      text("chatParticipantes", row.participantes ?? "");
      $("chatMotivo").value = "";
      $("chatMensajes").replaceChildren();
      $("chatPaginacion").hidden = true;
      $("abrirChat").hidden = false;
      $("chatMotivo").focus();
    });
    lista.append(button);
  }
  if (!filas.length) lista.append(nodo("p", "No se encontraron conversaciones."));
  text("mensajePanel", "Conversaciones actualizadas.");
}
async function mensajes(offset, razon) {
  const { filas, mas } = await rpc("sisaep_revision_chats", {
    p_chat: chat.id, p_origen: chat.origen, p_motivo: razon, p_offset: offset,
  });
  if (!disponible) return;
  motivo = razon;
  mensajeOffset = offset;
  mensajesMas = mas;
  const salida = $("chatMensajes");
  salida.replaceChildren();
  for (const row of filas) {
    const card = nodo("article", "");
    card.className = "chatRevisionMensaje";
    card.append(nodo("strong", row.autor), nodo("small", fecha(row.fecha)), nodo("p", row.contenido));
    salida.append(card);
  }
  if (!filas.length) salida.append(nodo("p", "Esta conversación no tiene mensajes en esta página."));
  $("chatPaginacion").hidden = !offset && !mas;
  text("mensajePanel", "Consulta registrada.");
}
$("buscarChats").addEventListener("submit", event => {
  event.preventDefault();
  ejecutar(() => { filtro = $("filtroChats").value.trim(); return listar(0); });
});
$("abrirChat").addEventListener("submit", event => {
  event.preventDefault();
  ejecutar(() => mensajes(0, $("chatMotivo").value.trim()));
});
$("chatsAnterior").addEventListener("click", () => ejecutar(() => listar(listaOffset - size)));
$("chatsSiguiente").addEventListener("click", () => ejecutar(() => listar(listaOffset + size)));
$("mensajesAnterior").addEventListener("click", () => ejecutar(() => mensajes(mensajeOffset - size, motivo)));
$("mensajesSiguiente").addEventListener("click", () => ejecutar(() => mensajes(mensajeOffset + size, motivo)));
await ejecutar(async () => {
  const session = await requireAdmin();
  if (session.rol !== "administrador_aplicacion") {
    text("mensajePanel", "La revisión de chats está reservada al administrador de la aplicación.");
    return;
  }
  showSession(session);
  cuenta = session.id;
  disponible = true;
  $("revisionChats").hidden = false;
  await listar(0);
});
