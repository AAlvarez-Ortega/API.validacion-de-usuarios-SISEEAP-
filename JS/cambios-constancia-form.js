export function revisionBaja(item,{aceptar,fecha,hora,motivo,comprobada}) {
  if(!item?.id || !Number.isInteger(item.revision_cambio) || typeof aceptar!=='boolean') throw new Error('Actualiza la solicitud.');
  if(typeof motivo!=='string' || !motivo.trim() || motivo.length>1000) throw new Error('Indica el motivo de la decisión.');
  if(aceptar && (!comprobada || !item.original_disponible)) throw new Error('Comprueba la fecha efectiva con el respaldo institucional y el original vigente.');
  if(aceptar && (!/^\d{4}-\d{2}-\d{2}$/u.test(fecha||'') ||
    !/^([01]\d|2[0-3]):[0-5]\d$/u.test(hora||'') || new Date(fecha+'T00:00:00Z').toISOString().slice(0,10)!==fecha))
    throw new Error('Indica fecha y hora efectivas comprobadas, en horario de Ciudad de México.');
  return {p_solicitud:item.id,p_revision:item.revision_cambio,p_aceptar:aceptar,
    p_fecha:aceptar?fecha:null,p_hora:aceptar?hora:null,p_motivo:motivo.trim()};
}
