import {requireAdmin,rpc} from './panel-api.js?v=1.24.0-6c9761704713';
import {showSession,text,fecha} from './panel-ui.js?v=1.24.0-6c9761704713';
import {pedirImportacionHorarios as pedir,archivoComoBase64} from './importacion-horarios-api.js?v=1.24.0-6c9761704713';
import {comprobarArchivoHorarios,datosPublicacionHorarios,textoHorarioOferta,textoMotivoOferta} from './importacion-horarios-form.js?v=1.24.0-6c9761704713';

const el=id=>document.getElementById(id),storageKey='sisaep-importacion-horarios';
let context,session,preview,busy=false,offset=0,generation=0,historyGeneration=0,searchTimer,uploadIntent;
let comparacion, comparacionOffset=0, consultaComparacion=0;
let revisionDetalle, detalleOffset=0, consultaDetalle=0, consultaFechas=0;
let restauracion, correccionFechas;
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
function controles(){
  el('revisarHorarios').disabled=busy||!context;
  el('escuelaImportacion').disabled=busy||Boolean(context?.escuela_fija);
  el('periodoImportacion').disabled=busy;
  el('archivoHorarios').disabled=busy;
  el('confirmacionesHorarios').disabled=busy||Boolean(preview?.publicado_en);
  el('publicarHorarios').disabled=busy||!preview||Boolean(preview.publicado_en)||!comparacion||comparacion.desactualizado||
    !el('confirmarPeriodoHorarios').checked||!el('confirmarPendientesHorarios').checked;
  el('anteriorOfertaImportada').disabled=busy||offset===0;
  el('siguienteOfertaImportada').disabled=busy||!preview||offset+30>=preview.total_filtrado;
  el('restaurarOferta').disabled=busy||!revisionDetalle?.revision_vigente;
  el('guardarCorreccionPeriodo').disabled=busy;
}
function seleccion(){return {escuela_cct:el('escuelaImportacion').value,id_cicloesc:Number(el('periodoImportacion').value)};}
function confirmarSeleccion(){const s=seleccion();if(!s.escuela_cct||!s.id_cicloesc)throw Error('Selecciona escuela y periodo escolar.');return s;}
function nodo(tag,value){const element=document.createElement(tag);element.textContent=value;return element;}
function filaTabla(...valores){
  const fila=document.createElement('tr');
  for(const valor of valores)fila.append(nodo('td',valor));
  return fila;
}
function etiquetaMateria(oferta){
  return `${oferta.nombre}${oferta.codigo?' ('+oferta.codigo+')':''} · ${oferta.secuencia}`;
}
function estadoOferta(oferta){
  return oferta.habilitada?'Disponible para nuevas altas':textoMotivoOferta(oferta.motivo);
}
function descripcionOferta(oferta){
  if(!oferta)return '—';
  return [oferta.nombre,oferta.turno,textoHorarioOferta(oferta.bloques),oferta.profesores.join(', ')||'Sin profesor indicado',
    oferta.semestre?`Semestre curricular ${oferta.semestre}`:'',estadoOferta(oferta)].filter(Boolean).join(' · ');
}
function textoErrorOferta(error){
  if(['22023','PT409','PT410','42501'].includes(error?.code)&&error.message)return error.message;
  return 'No se pudo completar la consulta. Intenta nuevamente.';
}
function totalCambios(data){return data.agregadas+data.modificadas+data.retiradas;}
async function cargarComparacion(pagina=0){
  if(!preview||preview.publicado_en)return;
  const id=preview.id, consulta=++consultaComparacion;
  comparacion=null;
  controles();
  el('anteriorComparacionOferta').disabled=true;
  el('siguienteComparacionOferta').disabled=true;
  text('resumenComparacionOferta','Comparando con la publicación vigente…');
  try{
    const data=await rpc('sisaep_gestion_borrador_oferta',{p_borrador:id,p_vista:'comparar',p_offset:pagina});
    if(consulta!==consultaComparacion||id!==preview?.id)return;
    comparacion=data;
    comparacionOffset=pagina;
    const resumen=`${data.agregadas} agregadas · ${data.modificadas} modificadas · ${data.retiradas} retiradas · ${data.iguales} sin cambios.`;
    const base=data.revision?`Revisión vigente ${data.revision}.`:'Primera publicación del periodo.';
    text('resumenComparacionOferta',data.desactualizado?
      `${base} La oferta cambió desde la vista previa. Vuelve a revisar el Excel antes de publicar. ${resumen}`:`${base} ${resumen}`);
    const etiquetas={agregada:'Agregada',modificada:'Modificada',retirada:'Retirada'};
    el('filasComparacionOferta').replaceChildren(...data.filas.map(({cambio,antes,despues})=>{
      const oferta=despues||antes;
      return filaTabla(etiquetas[cambio],`${etiquetaMateria(oferta)} · ${oferta.carrera} · ${oferta.plan}`,
        descripcionOferta(antes),descripcionOferta(despues));
    }));
    text('paginaComparacionOferta',`Página ${Math.floor(pagina/30)+1} de ${Math.max(1,Math.ceil(totalCambios(data)/30))}`);
    el('anteriorComparacionOferta').disabled=pagina===0;
    el('siguienteComparacionOferta').disabled=pagina+30>=totalCambios(data);
  }catch(error){
    if(consulta!==consultaComparacion)return;
    el('filasComparacionOferta').replaceChildren();
    text('paginaComparacionOferta','');
    text('resumenComparacionOferta',textoErrorOferta(error));
  }finally{if(consulta===consultaComparacion)controles();}
}
function prepararComparacion(){
  el('comparacionOferta').hidden=Boolean(preview?.publicado_en);
  el('descargarIncidenciasHorarios').hidden=!(preview?.pendientes>0);
  comparacion=null;
  comparacionOffset=0;
  el('filasComparacionOferta').replaceChildren();
  text('estadoDescargaIncidencias','');
  return cargarComparacion();
}
el('anteriorComparacionOferta').addEventListener('click',()=>void cargarComparacion(Math.max(0,comparacionOffset-30)));
el('siguienteComparacionOferta').addEventListener('click',()=>void cargarComparacion(comparacionOffset+30));
el('actualizarComparacionOferta').addEventListener('click',()=>void cargarComparacion());

function celdaCsv(value){
  let texto=String(value??'');
  if(/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(texto))texto="'"+texto;
  return '"'+texto.replaceAll('"','""')+'"';
}
el('descargarIncidenciasHorarios').addEventListener('click',async()=>{
  if(!preview)return;
  const id=preview.id,periodo=preview.periodo;
  const boton=el('descargarIncidenciasHorarios');
  boton.disabled=true;
  text('estadoDescargaIncidencias','Preparando el reporte…');
  try{
    const filas=[['Fila del Excel','Carrera','Plan','Clave','Materia','Secuencia','Motivo']];
    for(let pagina=0;;){
      const {filas:ofertas,limite}=await rpc('sisaep_gestion_borrador_oferta',{p_borrador:id,p_vista:'incidencias',p_offset:pagina});
      if(preview?.id!==id)return;
      for(const oferta of ofertas){
        for(const fila of oferta.filas_fuente){
          filas.push([fila,oferta.carrera,oferta.plan,oferta.codigo,oferta.nombre_oferta,oferta.secuencia,textoMotivoOferta(oferta.motivo)]);
        }
      }
      if(ofertas.length<limite)break;
      pagina+=limite;
    }
    const contenido='\uFEFF'+filas.map(f=>f.map(celdaCsv).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([contenido],{type:'text/csv;charset=utf-8'}));
    const enlace=document.createElement('a');
    enlace.href=url;
    enlace.download=`incidencias-horarios-${periodo}.csv`;
    enlace.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    text('estadoDescargaIncidencias',`Reporte descargado con ${filas.length-1} filas del Excel.`);
  }catch(error){
    if(preview?.id===id)text('estadoDescargaIncidencias',textoErrorOferta(error));
  }finally{boton.disabled=false;}
});

async function abrirRevision(id,pagina=0){
  const consulta=++consultaDetalle;
  el('detalleRevisionOferta').hidden=false;
  el('formRestaurarOferta').hidden=true;
  el('filasDetalleRevision').replaceChildren();
  text('motivoRevisionOferta','');
  text('estadoDetalleRevision','Consultando las materias de la revisión…');
  try{
    const data=await rpc('sisaep_detalle_revision_oferta',{p_lote:id,p_offset:pagina});
    if(consulta!==consultaDetalle)return;
    revisionDetalle=data;
    detalleOffset=pagina;
    text('tituloRevisionOferta',`Revisión ${data.revision}`);
    text('estadoDetalleRevision',`${data.activo?'Vigente':'Histórica'} · ${data.total} ofertas.`);
    if(data.correccion){
      const c=data.correccion;
      text('motivoRevisionOferta',`Recuperada de la revisión ${c.revision_origen} por ${c.responsable}, ${fecha(c.creado_en)}. ${c.motivo}`);
    }
    el('filasDetalleRevision').replaceChildren(...data.filas.map(oferta=>filaTabla(
      `${oferta.carrera} · ${oferta.plan}`,etiquetaMateria(oferta),oferta.profesores.join(', ')||'Sin profesor indicado',
      textoHorarioOferta(oferta.bloques),estadoOferta(oferta))));
    text('paginaRevisionOferta',`Página ${Math.floor(pagina/30)+1} de ${Math.max(1,Math.ceil(data.total/30))}`);
    el('anteriorRevisionOferta').disabled=pagina===0;
    el('siguienteRevisionOferta').disabled=pagina+30>=data.total;
    el('formRestaurarOferta').hidden=data.activo||!data.revision_vigente;
  }catch(error){if(consulta===consultaDetalle)text('estadoDetalleRevision',textoErrorOferta(error));}
  finally{controles();}
}
el('anteriorRevisionOferta').addEventListener('click',()=>{if(revisionDetalle)void abrirRevision(revisionDetalle.id,Math.max(0,detalleOffset-30));});
el('siguienteRevisionOferta').addEventListener('click',()=>{if(revisionDetalle)void abrirRevision(revisionDetalle.id,detalleOffset+30);});
el('formRestaurarOferta').addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy||!revisionDetalle||revisionDetalle.activo||!el('confirmarRestaurarOferta').checked)return;
  const motivo=el('motivoRestaurarOferta').value.trim();
  const params={p_lote:revisionDetalle.id,p_revision:revisionDetalle.revision_vigente,p_motivo:motivo};
  const clave=JSON.stringify(params);
  if(restauracion?.clave!==clave)restauracion={clave,id:crypto.randomUUID()};
  busy=true;
  controles();
  try{
    const result=await rpc('sisaep_restaurar_revision_oferta',{...params,p_operacion:restauracion.id});
    el('confirmarRestaurarOferta').checked=false;
    el('motivoRestaurarOferta').value='';
    await historial();
    await abrirRevision(result.lote_id);
    await cargarComparacion();
    text('mensajePanel',`Se publicó la revisión ${result.revision} con la oferta de la revisión ${result.revision_origen}.`);
  }catch(error){text('estadoDetalleRevision',textoErrorOferta(error));}
  finally{busy=false;controles();}
});

async function mostrarCorreccionFechas(){
  const consulta=++consultaFechas;
  const periodo=context?.periodos.find(p=>p.id===seleccion().id_cicloesc);
  el('corregirPeriodoOferta').hidden=!periodo||session?.rol!=='administrador_aplicacion';
  el('historialCorreccionPeriodo').replaceChildren();
  if(el('corregirPeriodoOferta').hidden)return;
  text('fechasOriginalesOferta',`${periodo.descripcion} · ${periodo.desde} al ${periodo.hasta}.`);
  el('inicioCorregirPeriodo').value=periodo.desde;
  el('finCorregirPeriodo').value=periodo.hasta;
  el('motivoCorregirPeriodo').value='';
  el('confirmarCorregirPeriodo').checked=false;
  text('estadoCorreccionPeriodo','');
  try{
    const cambios=await rpc('sisaep_historial_fechas_oferta',{p_ciclo:periodo.id});
    if(consulta!==consultaFechas)return;
    el('historialCorreccionPeriodo').replaceChildren(...cambios.map(c=>nodo('li',
      `${fecha(c.creado_en)} · ${c.responsable} · ${c.desde_original} al ${c.hasta_original} → ${c.desde} al ${c.hasta}. ${c.motivo}`)));
  }catch(error){if(consulta===consultaFechas)text('estadoCorreccionPeriodo',textoErrorOferta(error));}
}
el('formCorregirPeriodo').addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy||session?.rol!=='administrador_aplicacion'||!el('confirmarCorregirPeriodo').checked)return;
  const periodo=context.periodos.find(p=>p.id===seleccion().id_cicloesc);
  if(!periodo)return;
  const params={p_ciclo:periodo.id,p_desde:el('inicioCorregirPeriodo').value,p_hasta:el('finCorregirPeriodo').value,
    p_desde_original:periodo.desde,p_hasta_original:periodo.hasta,p_motivo:el('motivoCorregirPeriodo').value.trim()};
  const clave=JSON.stringify(params);
  if(correccionFechas?.clave!==clave)correccionFechas={clave,id:crypto.randomUUID()};
  busy=true;
  controles();
  try{
    const data=await rpc('sisaep_corregir_fechas_oferta',{...params,p_operacion:correccionFechas.id});
    periodo.desde=data.desde;
    periodo.hasta=data.hasta;
    opcionesPeriodos();
    el('periodoImportacion').value=String(periodo.id);
    cambiarSeleccion();
    text('estadoCorreccionPeriodo','Se guardaron las fechas corregidas.');
    text('mensajePanel','Periodo actualizado. Selecciona el Excel para revisar las materias con las nuevas fechas.');
  }catch(error){text('estadoCorreccionPeriodo',textoErrorOferta(error));}
  finally{busy=false;controles();}
});
function profesores(){const names=preview?.profesores||[],query=el('buscarProfesorImportado').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();const filtered=names.filter(n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(query));el('profesoresImportados').replaceChildren(...filtered.slice(0,100).map(n=>nodo('li',n)));text('totalProfesoresImportados',`${filtered.length} de ${names.length} nombres. ${filtered.length>100?'Se muestran los primeros 100; escribe un apellido para acotar.':''}`);}
function recibo(data){el('reciboPublicacionHorarios').hidden=false;text('reciboPublicacionHorarios',`Publicación confirmada. Revisión ${data.revision??'vigente'}${data.sin_cambios?' (el archivo ya era la oferta vigente; no se creó otra revisión)':''}. Operación ${data.id_operacion??'registrada'}.`);}
function dibujar(data){preview=data;offset=data.offset??0;el('vistaPreviaHorarios').hidden=false;text('resumenPeriodoHorarios',`${data.escuela_cct} · IPN ${data.periodo} · ${data.desde} al ${data.hasta}. Revisión vigente al preparar: ${data.revision_base}.`);text('resumenConteosHorarios',`${data.filas} filas del archivo · ${data.ofertas instanceof Array?data.habilitadas+data.pendientes:data.ofertas} ofertas · ${data.habilitadas} disponibles para nuevas altas · ${data.pendientes} fuera de nuevas altas · ${data.docentes} nombres de profesores · ${data.secuencias} secuencias.`);text('incidenciasHorarios',Object.entries(data.motivos||{}).map(([reason,count])=>`${count}: ${textoMotivoOferta(reason)}`).join(' ')||'Todas las ofertas coinciden y tienen horario válido.');text('nombreArchivoHorarios',data.nombre_archivo);text('venceVistaHorarios',fecha(data.vence_en));text('hashArchivoHorarios',data.sha256_archivo);text('hashDatosHorarios',data.sha256_datos);const rows=(Array.isArray(data.ofertas)?data.ofertas:[]).map(o=>{const tr=document.createElement('tr');for(const value of [(o.filas_fuente||[]).join(', '),`${o.carrera} · ${o.plan}`,`${o.nombre} (${o.codigo||'sin clave'}) · ${o.secuencia}`,(o.profesores||[]).join('; ')||'Sin profesor indicado',textoHorarioOferta(o.bloques),o.habilitada?'Disponible para nuevas altas':textoMotivoOferta(o.motivo)])tr.append(nodo('td',value));return tr;});el('filasOfertaImportada').replaceChildren(...rows);if(!rows.length){const tr=document.createElement('tr'),td=nodo('td','No hay ofertas que coincidan con la búsqueda.');td.colSpan=6;tr.append(td);el('filasOfertaImportada').append(tr);}text('contadorOfertaImportada',`${data.total_filtrado??0} ofertas coinciden con los filtros.`);text('paginaOfertaImportada',`Página ${Math.floor(offset/30)+1} de ${Math.max(1,Math.ceil((data.total_filtrado??0)/30))}`);profesores();if(data.publicado_en){el('reciboPublicacionHorarios').hidden=false;text('reciboPublicacionHorarios',`Esta vista previa se publicó el ${fecha(data.publicado_en)}. La publicación ya está registrada.`);}controles();}
async function cargarFilas(){if(!preview)return;const own=++generation;const q=new URLSearchParams({q:el('buscarOfertaImportada').value,estado:el('estadoOfertaImportada').value,offset:String(offset)});try{const data=await pedir(`/importaciones/${preview.id}?${q}`);if(own!==generation)return;dibujar(data);text('mensajePanel',data.publicado_en?'Publicación registrada.':'Vista previa lista. Revisa el periodo y las incidencias antes de publicar.');}catch(e){if(own===generation)text('mensajePanel',e.message);}}
async function historial(){const own=++historyGeneration,s=seleccion();el('revisionesHorarios').replaceChildren();if(!s.escuela_cct||!s.id_cicloesc){text('estadoRevisionesHorarios','Selecciona escuela y periodo para consultar su historial.');return;}text('estadoRevisionesHorarios','Consultando revisiones…');try{const rows=await pedir('/revisiones?'+new URLSearchParams(s));if(own!==historyGeneration)return;text('estadoRevisionesHorarios',rows.length?`${rows.length} revisiones conservadas.`:'Todavía no hay una revisión publicada para este periodo.');const list=document.createElement('ul');for(const row of rows){
    const item=nodo('li',`Revisión ${row.revision} · ${row.activo?'Vigente':'Histórica'} · ${row.ofertas} ofertas · ${fecha(row.creado_en)} · ${row.nombre_archivo} `);
    const boton=nodo('button',`Ver revisión ${row.revision}`);
    boton.type='button';
    boton.addEventListener('click',()=>{if(!busy){restauracion=null;el('motivoRestaurarOferta').value='';el('confirmarRestaurarOferta').checked=false;void abrirRevision(row.id);}});
    item.append(boton);
    list.append(item);
  }el('revisionesHorarios').append(list);}catch(e){if(own===historyGeneration)text('estadoRevisionesHorarios',e.message);}}
function descartarVistaPrevia(){
  ++generation;
  ++consultaComparacion;
  preview=null;
  comparacion=null;
  offset=0;
  uploadIntent=null;
  limpiarRecuerdo();
  el('vistaPreviaHorarios').hidden=true;
  el('confirmarPeriodoHorarios').checked=false;
  el('confirmarPendientesHorarios').checked=false;
  controles();
}
function cambiarSeleccion(){
  ++consultaDetalle;
  revisionDetalle=null;
  el('archivoHorarios').value='';
  el('detalleRevisionOferta').hidden=true;
  descartarVistaPrevia();
  void historial();
  void mostrarCorreccionFechas();
}
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
el('archivoHorarios').addEventListener('change',descartarVistaPrevia);
el('formImportarHorarios').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;try{const selected=confirmarSeleccion(),file=el('archivoHorarios').files[0];comprobarArchivoHorarios(file,context);busy=true;controles();text('mensajePanel','Revisando el archivo en el servidor. Todavía no se cambia la oferta vigente…');const key=[selected.escuela_cct,selected.id_cicloesc,file.name,file.size,file.lastModified].join('/');if(uploadIntent?.key!==key)uploadIntent={key,id:crypto.randomUUID()};const data=await pedir('/importaciones',{method:'POST',body:{id:uploadIntent.id,...selected,nombre_archivo:file.name,archivo_base64:await archivoComoBase64(file)}});preview=data;offset=0;el('buscarOfertaImportada').value='';el('estadoOfertaImportada').value='todas';el('confirmarPeriodoHorarios').checked=false;el('confirmarPendientesHorarios').checked=false;el('reciboPublicacionHorarios').hidden=true;guardar({borrador_id:data.id,sha256_borrador:data.sha256_borrador,operacion_id:crypto.randomUUID()});await Promise.all([cargarFilas(),prepararComparacion()]);}catch(e){text('mensajePanel',e.message);}finally{busy=false;controles();}});
for(const id of ['confirmarPeriodoHorarios','confirmarPendientesHorarios'])el(id).addEventListener('change',controles);
el('publicarHorarios').addEventListener('click',async()=>{if(busy||!comparacion||comparacion.desactualizado)return;try{const saved=recordar(),id=saved?.borrador_id===preview?.id&&saved.sha256_borrador===preview.sha256_borrador?saved.operacion_id:crypto.randomUUID();const body=datosPublicacionHorarios(preview,{id,periodoConfirmado:el('confirmarPeriodoHorarios').checked,pendientesConfirmados:el('confirmarPendientesHorarios').checked});guardar({borrador_id:preview.id,sha256_borrador:preview.sha256_borrador,operacion_id:id});busy=true;controles();text('mensajePanel','Publicando en el servidor. Conserva esta página hasta recibir la confirmación…');const result=await pedir('/publicaciones',{method:'POST',body});await cargarFilas();await prepararComparacion();recibo(result);await historial();text('mensajePanel','La oferta se guardó en el servidor. Las revisiones anteriores siguen conservadas.');}catch(e){text('mensajePanel',e.message);}finally{busy=false;controles();}});
el('buscarOfertaImportada').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;void cargarFilas();},300);});
el('estadoOfertaImportada').addEventListener('change',()=>{offset=0;void cargarFilas();});
el('anteriorOfertaImportada').addEventListener('click',()=>{offset=Math.max(0,offset-30);void cargarFilas();});el('siguienteOfertaImportada').addEventListener('click',()=>{offset+=30;void cargarFilas();});el('buscarProfesorImportado').addEventListener('input',profesores);
try{session=await requireAdmin();showSession(session);context=await pedir('/contexto');opciones('escuelaImportacion',context.escuelas,etiquetaEscuela,'cct','Selecciona escuela');opcionesPeriodos();configurarRegistroPeriodo();if(context.escuela_fija)el('escuelaImportacion').value=context.escuela_fija;const parametros=new URLSearchParams(location.search);
const escuelaEnlace=parametros.get('escuela');
const periodoEnlace=Number(parametros.get('periodo'));
if(!context.escuela_fija&&context.escuelas.some(e=>e.cct===escuelaEnlace))el('escuelaImportacion').value=escuelaEnlace;
if(context.periodos.some(p=>p.id===periodoEnlace))el('periodoImportacion').value=String(periodoEnlace);
const saved=recordar();if(saved?.borrador_id&&!periodoEnlace){try{const data=await pedir('/importaciones/'+saved.borrador_id);el('escuelaImportacion').value=data.escuela_cct;el('periodoImportacion').value=data.id_cicloesc;dibujar(data);await prepararComparacion();text('mensajePanel',data.publicado_en?'La revisión anterior ya está publicada.':'Se recuperó tu vista previa. Revisa y confirma antes de publicar; no se publica automáticamente.');}catch(e){limpiarRecuerdo();text('mensajePanel',e.message);}}else text('mensajePanel','Selecciona escuela, periodo y archivo para revisar los horarios.');await Promise.all([historial(),mostrarCorreccionFechas()]);controles();}catch(e){text('mensajePanel',e.message);}
