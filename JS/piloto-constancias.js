import {rpc,mensajeError} from './panel-api.js?v=1.24.0-2ccfdcd23787';
import {text} from './panel-ui.js?v=1.24.0-2ccfdcd23787';
import {configuracionPiloto} from './piloto-constancias-form.js?v=1.24.0-2ccfdcd23787';

export async function prepararPilotoConstancias() {
  const form=document.getElementById('formPilotoConstancias');
  if(!form)return;
  const selector=document.getElementById('escuelaPiloto');
  const cambiar=document.getElementById('cambiarEstadoPiloto');
  const motivo=document.getElementById('motivoPiloto');
  const guardar=document.getElementById('guardarPiloto');
  const cancelar=document.getElementById('cancelarPiloto');
  const configuraciones=new Map();
  const nombres=new Map();
  let edicion=null;
  let guardando=false;

  function mostrarEstado() {
    const actual=configuraciones.get(selector.value);
    text('estadoPiloto',actual ? (actual.habilitada?'Habilitada':'Deshabilitada') : 'No disponible');
    cambiar.disabled=!actual;
  }

  function cerrarEdicion() {
    edicion=null;
    motivo.value='';
    form.hidden=true;
    cambiar.setAttribute('aria-expanded','false');
    mostrarEstado();
  }

  selector.addEventListener('change',()=>{
    cerrarEdicion();
    text('mensajePiloto','');
  });
  cambiar.addEventListener('click',()=>{
    const actual=configuraciones.get(selector.value);
    if(guardando||!actual||edicion)return;
    edicion={escuela:selector.value,habilitar:!actual.habilitada};
    const nombre=nombres.get(edicion.escuela);
    const accion=edicion.habilitar?'Habilitar':'Deshabilitar';
    text('accionPiloto',`${accion} la importación de constancias en ${nombre}.`);
    text('guardarPiloto',`Confirmar y ${accion.toLowerCase()}`);
    guardar.className=edicion.habilitar?'primary':'danger';
    form.hidden=false;
    cambiar.setAttribute('aria-expanded','true');
    text('mensajePiloto','');
    motivo.focus();
  });
  cancelar.addEventListener('click',()=>{
    if(guardando)return;
    cerrarEdicion();
    text('mensajePiloto','');
    cambiar.focus();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(guardando||!edicion||edicion.escuela!==selector.value)return;
    try {
      const args=configuracionPiloto(edicion.escuela,edicion.habilitar,motivo.value);
      guardando=true;
      selector.disabled=cambiar.disabled=guardar.disabled=cancelar.disabled=true;
      const actualizada=await rpc('sisaep_configurar_piloto_constancias',args);
      configuraciones.set(args.p_cct,actualizada);
      cerrarEdicion();
      text('mensajePiloto',`Importación ${actualizada.habilitada?'habilitada':'deshabilitada'} en ${nombres.get(args.p_cct)}.`);
      cambiar.focus();
    } catch(error) {
      text('mensajePiloto',error.code?mensajeError(error):error.message);
    } finally {
      guardando=false;
      selector.disabled=guardar.disabled=cancelar.disabled=false;
      mostrarEstado();
    }
  });

  try {
    const [filas,escuelas]=await Promise.all([
      rpc('sisaep_configuraciones_piloto_constancias'),
      rpc('sisaep_catalogo_escuelas'),
    ]);
    const directorio=new Map(escuelas.map(escuela=>[escuela.id,escuela.nombre||escuela.siglas]));
    for(const fila of filas){
      configuraciones.set(fila.escuela_cct,fila);
      nombres.set(fila.escuela_cct,directorio.get(fila.escuela_cct)||'Escuela sin nombre registrado');
    }
    const opciones=[...nombres].sort((a,b)=>a[1].localeCompare(b[1],'es')).map(([cct,nombre])=>{
      const opcion=document.createElement('option');
      opcion.value=cct;
      opcion.textContent=nombre;
      return opcion;
    });
    selector.replaceChildren(...opciones);
    selector.disabled=opciones.length===0;
    mostrarEstado();
  } catch(error) {
    mostrarEstado();
    text('mensajePiloto',mensajeError(error));
  }
}
