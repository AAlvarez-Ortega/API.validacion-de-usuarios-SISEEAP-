import {rpc,mensajeError} from './panel-api.js?v=1.24.0-6c9761704713';
import {text} from './panel-ui.js?v=1.24.0-6c9761704713';
import {configuracionPiloto} from './piloto-constancias-form.js?v=1.24.0-6c9761704713';
export async function prepararPilotoConstancias() {
  const form=document.getElementById('formPilotoConstancias');if(!form)return;
  const selector=document.getElementById('escuelaPiloto'),check=document.getElementById('habilitarPiloto');
  const motivo=document.getElementById('motivoPiloto'),button=document.getElementById('guardarPiloto');let filas=[];
  function seleccionar() {const item=filas.find(x=>x.escuela_cct===selector.value);check.checked=item?.habilitada===true;motivo.value='';}
  async function cargar() {
    const previa=selector.value;filas=await rpc('sisaep_configuraciones_piloto_constancias');selector.replaceChildren();
    for(const fila of filas) {const o=document.createElement('option');o.value=fila.escuela_cct;
      o.textContent=`${fila.escuela_cct} · ${fila.habilitada?'Habilitado':'Pausado'}`;selector.append(o);}
    if(filas.some(f=>f.escuela_cct===previa))selector.value=previa;seleccionar();
  }
  selector.addEventListener('change',seleccionar);
  form.addEventListener('submit',async e=>{e.preventDefault();if(button.disabled)return;button.disabled=true;
    try {const args=configuracionPiloto(selector.value,check.checked,motivo.value);
      await rpc('sisaep_configurar_piloto_constancias',args);await cargar();
      text('mensajePanel',args.p_habilitada?'Piloto habilitado para la escuela seleccionada.':'Piloto pausado. Se conservan las inscripciones e historial confirmados.');
    } catch(error) {text('mensajePanel',error.code?mensajeError(error):error.message);}
    finally {button.disabled=false;}
  });
  await cargar();
}
