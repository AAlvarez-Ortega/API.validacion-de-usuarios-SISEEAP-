import { requireAdmin, rpc, mensajeError } from './panel-api.js?v=1.24.0-576d56b72d26';
import { text, showSession, fecha } from './panel-ui.js?v=1.24.0-576d56b72d26';
import { supabase } from './coneccionSB.js?v=1.24.0-576d56b72d26';
import { lecturaDocumental, ErrorLecturaDocumental } from './constancias-form.js?v=1.24.0-576d56b72d26';
import { prepararPilotoConstancias } from './piloto-constancias.js?v=1.24.0-576d56b72d26';

const $ = id => document.getElementById(id);
let offset = 0, seleccion = null, ocupada = false;
const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
function nodo(tag, texto) { const el = document.createElement(tag); if (texto !== undefined) el.textContent = texto; return el; }
function campo(contenedor, etiqueta, key, valor = '', tipo = 'text') {
  const label = nodo('label', etiqueta), input = nodo(tipo === 'textarea' ? 'textarea' : 'input');
  if (tipo !== 'textarea') input.type = tipo;
  input.dataset.campo = key; input.value = valor ?? ''; label.append(input); contenedor.append(label); return input;
}
function boton(contenedor, texto, accion) { const b = nodo('button', texto); b.type = 'button'; b.addEventListener('click', accion); contenedor.append(b); return b; }
function agregarBloque(contenedor, bloque = {}) {
  const fila = nodo('div'); fila.className = 'bloque-documental'; fila.dataset.bloque = 'true';
  const label = nodo('label', 'Día'), select = nodo('select'); select.dataset.campo = 'dia';
  dias.forEach((d, i) => { const option = nodo('option', d); option.value = String(i + 1); select.append(option); });
  // Un horario sin día no recibe un lunes por defecto.
  const pendiente = nodo('option', 'Seleccionar día'); pendiente.value = ''; select.prepend(pendiente);
  select.value = bloque.dia ? String(bloque.dia) : ''; label.append(select); fila.append(label);
  campo(fila, 'Inicio', 'hora_inicio', bloque.hora_inicio, 'time');
  campo(fila, 'Fin', 'hora_fin', bloque.hora_fin); // admite 24:00 explícito
  campo(fila, 'Edificio (opcional)', 'edificio', bloque.edificio);
  campo(fila, 'Salón (opcional)', 'salon', bloque.salon);
  boton(fila, 'Quitar bloque', () => fila.remove()); contenedor.append(fila);
}
function agregarMateria(m = {}) {
  const card = nodo('fieldset'); card.dataset.materia = 'true'; card.className = 'materia-documental';
  card.append(nodo('legend', 'Materia · secuencia · horario'));
  const fields = nodo('div'); fields.className = 'details'; card.append(fields);
  campo(fields, 'Clave', 'clave', m.clave); campo(fields, 'Secuencia', 'secuencia', m.secuencia);
  campo(fields, 'Nombre', 'nombre', m.nombre); campo(fields, 'Créditos (opcional)', 'creditos', m.creditos);
  campo(fields, 'Profesores (uno por línea, opcional)', 'profesores_texto', (m.profesores_texto || []).join('\n'), 'textarea');
  if (m.incidencias?.length) card.append(nodo('p', 'El OCR marcó campos de esta fila para contrastar con el original.'));
  const bloques = nodo('div'); bloques.dataset.bloques = 'true'; card.append(bloques);
  (m.bloques || []).forEach(b => agregarBloque(bloques, b));
  boton(card, 'Añadir bloque de horario', () => agregarBloque(bloques));
  boton(card, 'Quitar materia', () => card.remove()); $('materiasConstancia').append(card);
}
function valores(contenedor) {
  return Object.fromEntries([...contenedor.querySelectorAll('[data-campo]')].map(el => [el.dataset.campo, el.value]));
}
function lectura() {
  const meta = { ...valores($('metadatosConstancia')), completa: $('documentoCompleto').checked };
  const materias = [...$('materiasConstancia').querySelectorAll('[data-materia]')].map(card => {
    const m = valores(card.querySelector('.details'));
    return { ...m, profesores_texto: m.profesores_texto.split('\n'),
      bloques: [...card.querySelectorAll('[data-bloque]')].map(valores) };
  });
  return lecturaDocumental(meta, materias);
}
function actualizarBotones() {
  $('aceptarConstancia').disabled = ocupada || !$('contrasteConstancia').checked || !seleccion?.original_disponible;
  $('rechazarConstancia').disabled = ocupada || !seleccion;
  $('abrirOriginal').disabled = ocupada || !seleccion?.original_disponible;
}
async function cargar() {
  const items = await rpc('sisaep_constancias_por_revisar', { p_offset: offset, p_limite: 30 });
  $('listaConstancias').replaceChildren(); text('totalConstancias', items.length); text('paginaConstancias', `Página ${offset / 30 + 1}`);
  $('anteriorConstancias').disabled = offset === 0; $('siguienteConstancias').disabled = items.length < 30;
  items.forEach(item => {
    const b = boton($('listaConstancias'), `${item.nombre} · ${item.boleta}`, () => ejecutar(() => seleccionar(item.id)));
    b.className = 'solicitudItem'; b.append(nodo('span', `${item.escuela_cct} · ${fecha(item.recibida_en)}`));
  });
  if (!items.length) $('listaConstancias').append(nodo('p', 'No hay constancias pendientes en esta página.'));
  text('mensajePanel', 'Pendientes actualizados.');
}
async function seleccionar(id) {
  seleccion = await rpc('sisaep_detalle_revision_constancia', { p_importacion: id });
  if (seleccion.estado !== 'PENDIENTE') { seleccion = null; await cargar(); return; }
  $('formConstancia').hidden = false; $('sinConstancia').hidden = true;
  text('identidadConstancia', `${seleccion.nombre} · Cuenta ${seleccion.boleta}`); text('escuelaConstancia', `Escuela de la cuenta: ${seleccion.escuela_cct}`);
  const borrador = seleccion.borrador || {};
  $('metadatosConstancia').replaceChildren();
  for (const [key, label] of Object.entries({ boleta:'Boleta leída', escuela_cct:'CCT leído', periodo_externo:'Periodo leído', programa_externo:'Programa leído', plan_externo:'Plan leído (opcional)' })) {
    campo($('metadatosConstancia'), label, key, borrador[key]);
  }
  $('materiasConstancia').replaceChildren(); (borrador.materias || []).forEach(agregarMateria);
  $('documentoCompleto').checked = false; $('contrasteConstancia').checked = false; $('motivoConstancia').value = '';
  text('mensajePanel', seleccion.original_disponible ? 'Contrasta los campos con el original antes de decidir.' : 'El original venció. Solicita que el alumno vuelva a subirlo.');
  actualizarBotones();
}
async function decidir(aceptar) {
  if (!seleccion || ocupada) return;
  if (aceptar && (!$('contrasteConstancia').checked || !seleccion.original_disponible)) return;
  const motivo = $('motivoConstancia').value.trim();
  if (!motivo) { text('mensajePanel', 'Escribe el motivo de la decisión.'); return; }
  const documento = aceptar ? lectura() : null;
  ocupada = true; actualizarBotones();
  try {
    await rpc('sisaep_revisar_constancia', { p_importacion: seleccion.id, p_revision: seleccion.revision,
      p_aceptar: aceptar, p_lectura: documento, p_motivo: motivo });
    seleccion = null; $('formConstancia').hidden = true; $('sinConstancia').hidden = false; await cargar();
    text('mensajePanel', aceptar ? 'Documento validado. El alumno ya puede recuperar la vista previa y confirmar cuando las ofertas estén resueltas.' : 'Corrección solicitada. El alumno verá el motivo.');
  } finally { ocupada = false; actualizarBotones(); }
}
async function ejecutar(accion) { try { await accion(); } catch (error) { text('mensajePanel', error instanceof ErrorLecturaDocumental ? error.message : error?.code ? mensajeError(error) : 'No se pudo completar la operación. Revisa los campos y la conexión.'); } }
$('formConstancia').addEventListener('submit', event => { event.preventDefault(); ejecutar(() => decidir(true)); });
$('rechazarConstancia').addEventListener('click', () => ejecutar(() => decidir(false)));
$('contrasteConstancia').addEventListener('change', actualizarBotones);
$('actualizarConstancias').addEventListener('click', () => ejecutar(cargar));
$('agregarMateriaConstancia').addEventListener('click', () => agregarMateria());
$('anteriorConstancias').addEventListener('click', () => { offset = Math.max(0, offset - 30); ejecutar(cargar); });
$('siguienteConstancias').addEventListener('click', () => { offset += 30; ejecutar(cargar); });
$('abrirOriginal').addEventListener('click', () => ejecutar(async () => {
  if (!seleccion?.original_disponible) return;
  const { data, error } = await supabase.storage.from('constancias-inscripcion').createSignedUrl(seleccion.ruta_privada, 60);
  if (error) throw error;
  const url = new URL(data.signedUrl);
  if (url.origin !== 'https://wdgsvdjojwjebjrpgopn.supabase.co' || !url.pathname.startsWith('/storage/v1/object/sign/constancias-inscripcion/')) throw new Error('ORIGINAL_INVALIDO');
  window.open(url.href, '_blank', 'noopener,noreferrer');
}));
await ejecutar(async () => { const session = await requireAdmin(); showSession(session); await cargar();await prepararPilotoConstancias(); });
