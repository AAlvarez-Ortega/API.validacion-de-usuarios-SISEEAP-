import {requireAdmin,rpc,mensajeError} from './panel-api.js?v=1.24.0-576d56b72d26';
import {text,showSession,fecha} from './panel-ui.js?v=1.24.0-576d56b72d26';
import {supabase} from './coneccionSB.js?v=1.24.0-576d56b72d26';
import {revisionBaja} from './cambios-constancia-form.js?v=1.24.0-576d56b72d26';
const $=id=>document.getElementById(id);let offset=0,seleccion=null,ocupada=false;
function node(tag,value) { const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e; }
async function cargar() {
  const items=await rpc('sisaep_cambios_constancia_por_revisar',{p_offset:offset,p_limite:30});
  $('listaCambios').replaceChildren();text('paginaCambios',`Página ${offset/30+1}`);
  $('anteriorCambios').disabled=offset===0;$('siguienteCambios').disabled=items.length<30;
  for(const item of items) {
    const b=node('button',`${item.nombre} · ${item.boleta} · ${item.codigo_materia} · ${item.secuencia}`);
    b.type='button';b.className='solicitudItem';b.append(node('span',`${item.escuela_cct} · ${fecha(item.solicitada_en)}`));
    b.addEventListener('click',()=>seleccionar(item));$('listaCambios').append(b);
  }
  if(!items.length)$('listaCambios').append(node('p','No hay cambios pendientes en esta página.'));
  text('mensajePanel','Pendientes actualizados.');
}
function seleccionar(item) {
  seleccion=item;$('formCambio').hidden=false;
  text('identidadCambio',`${item.nombre} · ${item.boleta}`);text('materiaCambio',`${item.codigo_materia} · ${item.materia} · ${item.secuencia}`);
  text('motivoSolicitud',`${item.tipo==='REVERSION'?'Reversión de una incorporación':'Baja por cambio de inscripción'}: ${item.motivo_solicitud}`);$('fechaEfectiva').value='';$('horaEfectiva').value='';$('motivoCambio').value='';$('fechaComprobada').checked=false;
  $('abrirOriginalCambio').disabled=!item.original_disponible;
  text('mensajePanel',item.original_disponible?'Comprueba la fecha efectiva antes de cerrar esta fuente.':'El original venció. El alumno debe volver a subirlo.');
}
async function decidir(aceptar) {
  const args=revisionBaja(seleccion,{aceptar,fecha:$('fechaEfectiva').value,hora:$('horaEfectiva').value,
    motivo:$('motivoCambio').value,comprobada:$('fechaComprobada').checked});
  await rpc('sisaep_revisar_baja_constancia',args);seleccion=null;$('formCambio').hidden=true;await cargar();
  text('mensajePanel',aceptar?'Baja de esta fuente registrada con su fecha efectiva. Se conservan asistencias e inscripciones respaldadas por otras fuentes.':'Solicitud rechazada. La inscripción se conserva.');
}
async function ejecutar(fn) {
  if(ocupada)return;ocupada=true;
  $('aceptarCambio').disabled=true;$('rechazarCambio').disabled=true;
  try { await fn(); } catch(e) { text('mensajePanel',e.code?mensajeError(e):e.message||'No se pudo completar la operación.'); }
  finally {ocupada=false;$('aceptarCambio').disabled=false;$('rechazarCambio').disabled=false;}
}
$('formCambio').addEventListener('submit',e=>{e.preventDefault();void ejecutar(()=>decidir(true));});
$('rechazarCambio').addEventListener('click',()=>ejecutar(()=>decidir(false)));
$('actualizarCambios').addEventListener('click',()=>ejecutar(cargar));
$('anteriorCambios').addEventListener('click',()=>ejecutar(async()=>{offset=Math.max(0,offset-30);await cargar();}));
$('siguienteCambios').addEventListener('click',()=>ejecutar(async()=>{offset+=30;await cargar();}));
$('abrirOriginalCambio').addEventListener('click',()=>ejecutar(async()=>{
  if(!seleccion?.original_disponible)return;
  const {data,error}=await supabase.storage.from('constancias-inscripcion').createSignedUrl(seleccion.ruta_privada,60);
  if(error)throw error;
  const url=new URL(data.signedUrl);if(url.origin!==new URL(supabase.supabaseUrl).origin || !url.pathname.startsWith('/storage/v1/object/sign/constancias-inscripcion/'))throw new Error('No se pudo abrir el original.');
  window.open(url.href,'_blank','noopener,noreferrer');
}));
try { const session=await requireAdmin();showSession(session);await ejecutar(cargar); }
catch { /* requireAdmin resuelve el acceso. */ }
