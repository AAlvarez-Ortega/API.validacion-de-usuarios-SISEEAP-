export const motivosOferta={CLAVE_AMBIGUA:'Clave ambigua: requiere confirmación oficial.',SIN_HORARIO:'Sin días u horas de clase.',SIN_COINCIDENCIA:'Sin coincidencia con el catálogo curricular.',PROGRAMA_AUSENTE_O_AMBIGUO:'Carrera o plan sin correspondencia única.',CLAVE_O_NOMBRE_FUERA_DEL_PROGRAMA:'La clave, el nombre o el semestre no coinciden con el plan.',SUFIJO_NO_VALIDADO:'La modalidad o el idioma necesita revisión.',CLAVE_PENDIENTE:'Falta la clave oficial.',MATERIA_NO_HABILITADA:'Materia pausada para nuevas altas.',PROGRAMA_PAUSADO:'Carrera o plan pausado para nuevas altas.',HORARIO_SOLAPADO:'El horario requiere revisar sus intervalos.'};
export function textoMotivoOferta(value){return motivosOferta[value]||'Requiere revisión antes de habilitarse.';}
export function textoHorarioOferta(bloques){const dias=['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];return bloques.length?bloques.map(b=>`${dias[b.dia]} ${b.hora_inicio}–${b.hora_fin}`).join('; '):'Sin horario';}
export function comprobarArchivoHorarios(file,context){if(!file||!file.name?.toLowerCase().endsWith('.xlsx'))throw Error('Selecciona un archivo con extensión .xlsx.');if(file.size<1||file.size>context.limites.bytes)throw Error('El archivo debe ocupar como máximo 6 MB.');}
export function datosPublicacionHorarios(preview,{id,periodoConfirmado,pendientesConfirmados}){
  if(!preview?.id||preview.publicado_en)throw Error('Carga una vista previa vigente antes de publicar.');
  if(new Date(preview.vence_en).getTime()<=Date.now())throw Error('La vista previa venció. Vuelve a cargar el archivo.');
  if(!periodoConfirmado||!pendientesConfirmados)throw Error('Confirma el periodo y la revisión de las incidencias.');
  return {id,borrador_id:preview.id,sha256_borrador:preview.sha256_borrador,confirmar_periodo:true,confirmar_pendientes:true};
}
