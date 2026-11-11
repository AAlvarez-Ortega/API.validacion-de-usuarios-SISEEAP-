import {requireAdmin,rpc} from './panel-api.js?v=1.24.0-983a04337a31';
import {showSession,text,fecha} from './panel-ui.js?v=1.24.0-983a04337a31';
import {pedirImportacionHorarios as pedir,archivoComoBase64} from './importacion-horarios-api.js?v=1.24.0-983a04337a31';
import {comprobarArchivoHorarios,datosPublicacionHorarios,textoHorarioOferta,textoMotivoOferta} from './importacion-horarios-form.js?v=1.24.0-983a04337a31';

const el=id=>document.getElementById(id),storageKey='sisaep-importacion-horarios';
let context,session,preview,busy=false,offset=0,generation=0,historyGeneration=0,searchTimer,uploadIntent;
function guardar(value){try{sessionStorage.setItem(storageKey,JSON.stringify({usuario:session.id,...value}));}catch{/* La revisión sigue disponible en esta página. */}}
function recordar(){try{const value=JSON.parse(sessionStorage.getItem(storageKey));return value?.usuario===session.id?value:null;}catch{return null;}}
function limpiarRecuerdo(){try{sessionStorage.removeItem(storageKey);}catch{}}
function opciones(id,items,label,value,placeholder){const select=el(id);select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=placeholder;select.append(first);for(const item of items){const option=document.createElement('option');option.value=item[value];option.textContent=label(item);select.append(option);}}
const etiquetaEscuela=s=>`${s.siglas||s.nombre} · ${s.cct}`;
function opcionesPeriodos(){opciones('periodoImportacion',context.periodos,p=>`${p.descripcion} · ${p.desde} al ${p.hasta}`,'id','Selecciona periodo');}
function configurarRegistroPeriodo(){
  if(session.rol!=='administrador_aplicacion')return;
  opciones('escuelaPeriodoOferta',context.escuelas,etiquetaEscuela,'cct','Selecciona escuela');
  el('registroPeriodoOferta').hidden=false;
  el('guardarPeriodoOferta').disabled=false;
}
function controles(){el('revisarHorarios').disabled=busy||!context;el('escuelaImportacion').disabled=busy||Boolean(context?.escuela_fija);el('periodoImportacion').disabled=busy;el('archivoHorarios').disabled=busy;el('confirmacionesHorarios').disabled=busy||Boolean(preview?.publicado_en);el('publicarHorarios').disabled=busy||!preview||Boolean(preview.publicado_en)||!el('confirmarPeriodoHorarios').checked||!el('confirmarPendientesHorarios').checked;el('anteriorOfertaImportada').disabled=busy||offset===0;el('siguienteOfertaImportada').disabled=busy||!preview||offset+30>=preview.total_filtrado;}
function seleccion(){return {escuela_cct:el('escuelaImportacion').value,id_cicloesc:Number(el('periodoImportacion').value)};}
function confirmarSeleccion(){const s=seleccion();if(!s.escuela_cct||!s.id_cicloesc)throw Error('Selecciona escuela y periodo escolar.');return s;}
function nodo(tag,value){const element=document.createElement(tag);element.textContent=value;return element;}
function profesores(){const names=preview?.profesores||[],query=el('buscarProfesorImportado').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();const filtered=names.filter(n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(query));el('profesoresImportados').replaceChildren(...filtered.slice(0,100).map(n=>nodo('li',n)));text('totalProfesoresImportados',`${filtered.length} de ${names.length} nombres. ${filtered.length>100?'Se muestran los primeros 100; escribe un apellido para acotar.':''}`);}
function recibo(data){el('reciboPublicacionHorarios').hidden=false;text('reciboPublicacionHorarios',`Publicación confirmada. Revisión ${data.revision??'vigente'}${data.sin_cambios?' (el archivo ya era la oferta vigente; no se creó otra revisión)':''}. Operación ${data.id_operacion??'registrada'}.`);}
function dibujar(data){preview=data;offset=data.offset??0;el('vistaPreviaHorarios').hidden=false;text('resumenPeriodoHorarios',`${data.escuela_cct} · IPN ${data.periodo} · ${data.desde} al ${data.hasta}. Revisión vigente al preparar: ${data.revision_base}.`);text('resumenConteosHorarios',`${data.filas} filas del archivo · ${data.ofertas instanceof Array?data.habilitadas+data.pendientes:data.ofertas} ofertas · ${data.habilitadas} disponibles para nuevas altas · ${data.pendientes} fuera de nuevas altas · ${data.docentes} nombres de profesores · ${data.secuencias} secuencias.`);text('incidenciasHorarios',Object.entries(data.motivos||{}).map(([reason,count])=>`${count}: ${textoMotivoOferta(reason)}`).join(' ')||'Todas las ofertas coinciden y tienen horario válido.');text('nombreArchivoHorarios',data.nombre_archivo);text('venceVistaHorarios',fecha(data.vence_en));text('hashArchivoHorarios',data.sha256_archivo);text('hashDatosHorarios',data.sha256_datos);const rows=(Array.isArray(data.ofertas)?data.ofertas:[]).map(o=>{const tr=document.createElement('tr');for(const value of [(o.filas_fuente||[]).join(', '),`${o.carrera} · ${o.plan}`,`${o.nombre} (${o.codigo||'sin clave'}) · ${o.secuencia}`,(o.profesores||[]).join('; ')||'Sin profesor indicado',textoHorarioOferta(o.bloques),o.habilitada?'Disponible para nuevas altas':textoMotivoOferta(o.motivo)])tr.append(nodo('td',value));return tr;});el('filasOfertaImportada').replaceChildren(...rows);if(!rows.length){const tr=document.createElement('tr'),td=nodo('td','No hay ofertas que coincidan con la búsqueda.');td.colSpan=6;tr.append(td);el('filasOfertaImportada').append(tr);}text('contadorOfertaImportada',`${data.total_filtrado??0} ofertas coinciden con los filtros.`);text('paginaOfertaImportada',`Página ${Math.floor(offset/30)+1} de ${Math.max(1,Math.ceil((data.total_filtrado??0)/30))}`);profesores();if(data.publicado_en){el('reciboPublicacionHorarios').hidden=false;text('reciboPublicacionHorarios',`Esta vista previa se publicó el ${fecha(data.publicado_en)}. La publicación ya está registrada.`);}controles();}
async function cargarFilas(){if(!preview)return;const own=++generation;const q=new URLSearchParams({q:el('buscarOfertaImportada').value,estado:el('estadoOfertaImportada').value,offset:String(offset)});try{const data=await pedir(`/importaciones/${preview.id}?${q}`);if(own!==generation)return;dibujar(data);text('mensajePanel',data.publicado_en?'Publicación registrada.':'Vista previa lista. Revisa el periodo y las incidencias antes de publicar.');}catch(e){if(own===generation)text('mensajePanel',e.message);}}
async function historial(){const own=++historyGeneration,s=seleccion();el('revisionesHorarios').replaceChildren();if(!s.escuela_cct||!s.id_cicloesc)return;text('estadoRevisionesHorarios','Consultando revisiones…');try{const rows=await pedir('/revisiones?'+new URLSearchParams(s));if(own!==historyGeneration)return;text('estadoRevisionesHorarios',rows.length?`${rows.length} revisiones conservadas.`:'Todavía no hay una revisión publicada para este periodo.');const list=document.createElement('ul');for(const row of rows)list.append(nodo('li',`Revisión ${row.revision} · ${row.activo?'Vigente':'Histórica'} · ${row.ofertas} ofertas · ${fecha(row.creado_en)} · ${row.nombre_archivo}`));el('revisionesHorarios').append(list);}catch(e){if(own===historyGeneration)text('estadoRevisionesHorarios',e.message);}}
function cambiarSeleccion(){++generation;preview=null;offset=0;uploadIntent=null;limpiarRecuerdo();el('vistaPreviaHorarios').hidden=true;el('confirmarPeriodoHorarios').checked=false;el('confirmarPendientesHorarios').checked=false;controles();void historial();}
el('escuelaImportacion').addEventListener('change',cambiarSeleccion);el('periodoImportacion').addEventListener('change',cambiarSeleccion);
el('formPeriodoOferta').addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy||!context||session?.rol!=='administrador_aplicacion')return;
  const escuela=el('escuelaPeriodoOferta').value;
  const desde=el('inicioPeriodoOferta').value,hasta=el('finPeriodoOferta').value;
  const codigo=el('clavePeriodoOferta').value.trim();
  if(!escuela||!/^\d{2}-[12]$/.test(codigo)||!desde||!hasta||hasta<=desde){
    text('mensajePeriodoOferta','Selecciona la escuela, la clave IPN y las fechas oficiales.');
    return;
  }
  busy=true;
  controles();
  el('guardarPeriodoOferta').disabled=true;
  text('mensajePeriodoOferta','Registrando el periodo…');
  try{
    const periodo=await rpc('sisaep_registrar_periodo_oferta',{p_codigo:codigo,p_desde:desde,p_hasta:hasta,p_escuela:escuela});
    const mantenerVista=preview&&preview.id_cicloesc===periodo.id&&preview.escuela_cct===escuela;
    context.periodos=[periodo,...context.periodos.filter(p=>p.id!==periodo.id)].sort((a,b)=>b.desde.localeCompare(a.desde)||a.id-b.id);
    opcionesPeriodos();
    el('escuelaImportacion').value=escuela;
    el('periodoImportacion').value=String(periodo.id);
    if(!mantenerVista)cambiarSeleccion();
    text('mensajePeriodoOferta',`Periodo IPN ${periodo.codigo} listo para recibir materias.`);
    if(!mantenerVista)text('mensajePanel','Selecciona el archivo de horarios para revisar las materias de este periodo.');
  }catch(error){
    const mensaje=['22023','PT409'].includes(error?.code)?error.message:
      error?.code==='42501'?'Solo el administrador de la aplicación puede registrar periodos.':
        'No se pudo registrar el periodo. Comprueba la conexión y vuelve a intentarlo.';
    text('mensajePeriodoOferta',mensaje);
  }finally{
    busy=false;
    el('guardarPeriodoOferta').disabled=false;
    controles();
  }
});
el('archivoHorarios').addEventListener('change',()=>{uploadIntent=null;});
el('formImportarHorarios').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;try{const selected=confirmarSeleccion(),file=el('archivoHorarios').files[0];comprobarArchivoHorarios(file,context);busy=true;controles();text('mensajePanel','Revisando el archivo en el servidor. Todavía no se cambia la oferta vigente…');const key=[selected.escuela_cct,selected.id_cicloesc,file.name,file.size,file.lastModified].join('/');if(uploadIntent?.key!==key)uploadIntent={key,id:crypto.randomUUID()};const data=await pedir('/importaciones',{method:'POST',body:{id:uploadIntent.id,...selected,nombre_archivo:file.name,archivo_base64:await archivoComoBase64(file)}});preview=data;offset=0;el('buscarOfertaImportada').value='';el('estadoOfertaImportada').value='todas';el('confirmarPeriodoHorarios').checked=false;el('confirmarPendientesHorarios').checked=false;el('reciboPublicacionHorarios').hidden=true;guardar({borrador_id:data.id,sha256_borrador:data.sha256_borrador,operacion_id:crypto.randomUUID()});await cargarFilas();}catch(e){text('mensajePanel',e.message);}finally{busy=false;controles();}});
for(const id of ['confirmarPeriodoHorarios','confirmarPendientesHorarios'])el(id).addEventListener('change',controles);
el('publicarHorarios').addEventListener('click',async()=>{if(busy)return;try{const saved=recordar(),id=saved?.borrador_id===preview?.id&&saved.sha256_borrador===preview.sha256_borrador?saved.operacion_id:crypto.randomUUID();const body=datosPublicacionHorarios(preview,{id,periodoConfirmado:el('confirmarPeriodoHorarios').checked,pendientesConfirmados:el('confirmarPendientesHorarios').checked});guardar({borrador_id:preview.id,sha256_borrador:preview.sha256_borrador,operacion_id:id});busy=true;controles();text('mensajePanel','Publicando en el servidor. Conserva esta página hasta recibir la confirmación…');const result=await pedir('/publicaciones',{method:'POST',body});await cargarFilas();recibo(result);await historial();text('mensajePanel','La oferta se guardó en el servidor. Las revisiones anteriores siguen conservadas.');}catch(e){text('mensajePanel',e.message);}finally{busy=false;controles();}});
el('buscarOfertaImportada').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;void cargarFilas();},300);});
el('estadoOfertaImportada').addEventListener('change',()=>{offset=0;void cargarFilas();});
el('anteriorOfertaImportada').addEventListener('click',()=>{offset=Math.max(0,offset-30);void cargarFilas();});el('siguienteOfertaImportada').addEventListener('click',()=>{offset+=30;void cargarFilas();});el('buscarProfesorImportado').addEventListener('input',profesores);
try{session=await requireAdmin();showSession(session);context=await pedir('/contexto');opciones('escuelaImportacion',context.escuelas,etiquetaEscuela,'cct','Selecciona escuela');opcionesPeriodos();configurarRegistroPeriodo();if(context.escuela_fija)el('escuelaImportacion').value=context.escuela_fija;const saved=recordar();if(saved?.borrador_id){try{const data=await pedir('/importaciones/'+saved.borrador_id);el('escuelaImportacion').value=data.escuela_cct;el('periodoImportacion').value=data.id_cicloesc;dibujar(data);text('mensajePanel',data.publicado_en?'La revisión anterior ya está publicada.':'Se recuperó tu vista previa. Revisa y confirma antes de publicar; no se publica automáticamente.');}catch(e){limpiarRecuerdo();text('mensajePanel',e.message);}}else text('mensajePanel','Selecciona escuela, periodo y archivo para revisar los horarios.');await historial();controles();}catch(e){text('mensajePanel',e.message);}
