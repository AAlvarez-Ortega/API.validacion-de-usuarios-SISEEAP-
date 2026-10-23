import {requireAdmin,rpc} from './panel-api.js';
import {showSession,text} from './panel-ui.js';
import {clavePrograma,etiquetaPrograma,datosMateria,datosPrograma,errorCatalogo} from './catalogo-form.js';
const $=id=>document.getElementById(id);let catalogo=null,seleccion=null,ocupado=false,sucio=false;
function el(tag,label){const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;}
function opciones(select,items,placeholder){select.replaceChildren();if(placeholder){const o=el('option',placeholder);o.value='';select.append(o);}for(const [value,label] of items){const o=el('option',label);o.value=value;select.append(o);}}
function permitirCambio(){return !sucio||window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?');}
function dibujarEditor(item=null){
 seleccion=item;sucio=false;text('tituloMateria',item?'Editar materia':'Nueva materia');$('codigoMateria').value=item?.codigo||'';$('codigoMateria').disabled=!!item;
 $('nombreMateria').value=item?.nombre||'';$('materiaActiva').checked=item?.activa!==false;$('programasMateria').replaceChildren();
 const selected=new Set((item?.programas||[]).map(clavePrograma));
 for(const p of catalogo.programas){const label=el('label');label.className='review-check';const input=el('input');input.type='checkbox';input.value=clavePrograma(p);input.checked=selected.has(input.value);label.append(input,document.createTextNode(etiquetaPrograma(p)));$('programasMateria').append(label);}
 if(!catalogo.programas.length)$('programasMateria').append(el('p','Agrega primero una carrera y plan a esta escuela.'));
 $('guardarMateria').disabled=!catalogo.programas.length;
}
function dibujarLista(){
 const q=$('buscarMateria').value.trim().toLocaleLowerCase('es'),program=$('filtrarPrograma').value;
 const rows=catalogo.materias.filter(m=>(!q||`${m.codigo} ${m.nombre}`.toLocaleLowerCase('es').includes(q))&&(!program||m.programas.some(p=>clavePrograma(p)===program)));
 text('totalMaterias',`${rows.length} materias`);$('listaMaterias').replaceChildren();
 for(const m of rows){const b=el('button',`${m.codigo} · ${m.nombre}${m.activa?'':' · Pausada'}`);b.type='button';b.className='solicitudItem';const labels=m.programas.map(p=>etiquetaPrograma(catalogo.programas.find(x=>clavePrograma(x)===clavePrograma(p))||{...p,nombre_carrera:'Carrera '+p.id_carrera}));b.append(el('span',labels.join(' / ')));b.addEventListener('click',()=>{if(!ocupado&&permitirCambio())dibujarEditor(m);});$('listaMaterias').append(b);}
 if(!rows.length)$('listaMaterias').append(el('p','No hay materias con estos filtros.'));
}
async function cargar(cct=null,codigo=null){
 const nuevo=await rpc('sisaep_admin_catalogo',{p_cct:cct});catalogo=nuevo;
 opciones($('escuelaCatalogo'),catalogo.escuelas.map(e=>[e.cct,`${e.siglas} · ${e.cct}`]));$('escuelaCatalogo').value=catalogo.escuela_cct;$('escuelaCatalogo').disabled=catalogo.escuelas.length===1;
 opciones($('filtrarPrograma'),catalogo.programas.map(p=>[clavePrograma(p),etiquetaPrograma(p)]),'Todas');
 opciones($('carreraPrograma'),[...catalogo.carreras.map(c=>[String(c.id),c.nombre]),['nueva','Registrar una nueva carrera']],'Seleccionar carrera');
 $('campoCarreraNueva').hidden=true;$('nombreCarreraNueva').value='';$('planPrograma').value='';$('planesCatalogo').replaceChildren();
 for(const p of catalogo.planes){const o=el('option',p.nombre);o.value=String(p.id);$('planesCatalogo').append(o);}
 dibujarLista();dibujarEditor(catalogo.materias.find(m=>m.codigo===codigo)||null);
}
async function ejecutar(fn){if(ocupado)return;ocupado=true;for(const id of ['guardarMateria','guardarPrograma','actualizarCatalogo','nuevaMateria'])$(id).disabled=true;
 try{await fn();}catch(e){text('mensajePanel',errorCatalogo(e));}finally{ocupado=false;for(const id of ['guardarPrograma','actualizarCatalogo','nuevaMateria'])$(id).disabled=false;$('guardarMateria').disabled=!catalogo?.programas.length;}}
$('buscarMateria').addEventListener('input',()=>catalogo&&dibujarLista());$('filtrarPrograma').addEventListener('change',()=>catalogo&&dibujarLista());
$('formMateriaCatalogo').addEventListener('input',()=>{sucio=true;});
$('nuevaMateria').addEventListener('click',()=>{if(catalogo&&permitirCambio())dibujarEditor();});
$('actualizarCatalogo').addEventListener('click',()=>{if(permitirCambio())ejecutar(async()=>{await cargar(catalogo?.escuela_cct,seleccion?.codigo);text('mensajePanel','Catálogo actualizado.');});});
$('escuelaCatalogo').addEventListener('change',()=>{if(permitirCambio())ejecutar(()=>cargar($('escuelaCatalogo').value));else $('escuelaCatalogo').value=catalogo.escuela_cct;});
$('carreraPrograma').addEventListener('change',()=>{$('campoCarreraNueva').hidden=$('carreraPrograma').value!=='nueva';$('nombreCarreraNueva').required=!$('campoCarreraNueva').hidden;});
$('formProgramaCatalogo').addEventListener('submit',e=>{e.preventDefault();ejecutar(async()=>{
 const draft=sucio?{seleccion,codigo:$('codigoMateria').value,nombre:$('nombreMateria').value,activa:$('materiaActiva').checked,programas:[...$('programasMateria').querySelectorAll('input:checked')].map(n=>n.value)}:null;
 const args=datosPrograma(catalogo.escuela_cct,$('carreraPrograma').value,$('planPrograma').value,$('nombreCarreraNueva').value);await rpc('sisaep_admin_guardar_programa',args);await cargar(catalogo.escuela_cct);
 if(draft){dibujarEditor(draft.seleccion);$('codigoMateria').value=draft.codigo;$('nombreMateria').value=draft.nombre;$('materiaActiva').checked=draft.activa;for(const n of $('programasMateria').querySelectorAll('input'))n.checked=draft.programas.includes(n.value);sucio=true;}
 text('mensajePanel','Carrera y plan agregados. Ya puedes asignarles materias.');
});});
$('formMateriaCatalogo').addEventListener('submit',e=>{e.preventDefault();ejecutar(async()=>{
 const keys=new Set([...$('programasMateria').querySelectorAll('input:checked')].map(n=>n.value));
 const args=datosMateria({cct:catalogo.escuela_cct,codigo:$('codigoMateria').value,nombre:$('nombreMateria').value,programas:catalogo.programas.filter(p=>keys.has(clavePrograma(p))),activa:$('materiaActiva').checked,revision:seleccion?.revision||0});
 await rpc('sisaep_admin_guardar_materia_catalogo',args);await cargar(catalogo.escuela_cct,args.p_codigo);text('mensajePanel','Materia guardada. Aparecerá en la aplicación al actualizar el catálogo o abrir el alta de materias.');
});});
try{const session=await requireAdmin();showSession(session);await ejecutar(async()=>{await cargar(session.escuela?.cct||null);text('mensajePanel','Catálogo listo. Selecciona una materia para editarla o registra una nueva.');});}catch(e){text('mensajePanel',errorCatalogo(e));}
