export const clavePrograma=p=>`${p.id_plan}/${p.id_carrera}`;
export const etiquetaPrograma=p=>`${p.nombre_carrera} · Plan ${p.id_plan}`;
export function datosMateria({cct,codigo,nombre,programas,activa,revision}){
 const code=String(codigo||'').trim().toUpperCase(),name=String(nombre||'').trim();
 if(!/^[A-Z0-9]{10}$/.test(cct||''))throw Error('Selecciona la escuela.');
 if(!/^[A-Z0-9_.-]{1,15}$/.test(code)||!name||name.length>100)throw Error('Escribe un código válido y el nombre de la materia.');
 if(!Array.isArray(programas)||!programas.length||programas.length>100)throw Error('Selecciona al menos una carrera y plan.');
 const values=[...new Map(programas.map(p=>{
  if(!Number.isInteger(p.id_plan)||p.id_plan<1||p.id_plan>9999||!Number.isInteger(p.id_carrera)||p.id_carrera<1)throw Error('Revisa las carreras seleccionadas.');
  return [clavePrograma(p),{id_plan:p.id_plan,id_carrera:p.id_carrera}];
 })).values()];
 if(typeof activa!=='boolean'||!Number.isInteger(revision)||revision<0)throw Error('Actualiza el catálogo antes de guardar.');
 return {p_cct:cct,p_codigo:code,p_nombre:name,p_programas:values,p_activa:activa,p_revision:revision};
}
export function datosPrograma(cct,carrera,plan,nombre){
 const id=Number(plan),cid=carrera==='nueva'?null:Number(carrera),name=String(nombre||'').trim();
 if(!/^[A-Z0-9]{10}$/.test(cct||'')||!Number.isInteger(id)||id<1||id>9999)throw Error('Selecciona la escuela y escribe la clave del plan.');
 if(cid===null?name.length<2||name.length>150:!Number.isInteger(cid)||cid<1)throw Error('Selecciona una carrera o escribe el nombre de la nueva.');
 return {p_cct:cct,p_carrera:cid,p_plan:id,p_nombre_carrera:cid===null?name:null};
}
export function errorCatalogo(e){
 if(e?.code==='42501')return 'Tu cuenta no puede administrar el catálogo de esta escuela.';
 if(e?.code==='PT409'||String(e?.message).includes('CATALOGO_DESACTUALIZADO'))return 'Otra persona actualizó esta materia. Actualiza el catálogo y revisa los cambios antes de guardar.';
 if(e?.code==='22023')return 'Revisa el código, nombre, carrera y plan seleccionados.';
 if(e?.code)return 'No se pudo guardar. Comprueba la conexión y actualiza el catálogo.';
 return e?.message||'No se pudo completar la operación.';
}
