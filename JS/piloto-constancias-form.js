export function configuracionPiloto(cct,habilitada,motivo) {
  const escuela=String(cct||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{10}$/u.test(escuela) || typeof habilitada!=='boolean' || typeof motivo!=='string' || !motivo.trim() || motivo.length>1000)
    throw new Error('Selecciona la escuela e indica el motivo de la configuración.');
  return {p_cct:escuela,p_habilitada:habilitada,p_motivo:motivo.trim()};
}
