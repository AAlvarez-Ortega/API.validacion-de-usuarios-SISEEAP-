// Contrato de revisión documental. No hay reglas de carga mínima/máxima.
export class ErrorLecturaDocumental extends Error {}
export function lecturaDocumental(meta, materias) {
  const texto = value => typeof value === 'string' ? value.trim() : '';
  const falta = mensaje => { throw new ErrorLecturaDocumental(mensaje); };
  if (!/^\d{10}$/u.test(texto(meta.boleta))) falta('Revisa la boleta leída en el original.');
  if (!texto(meta.escuela_cct) || !texto(meta.periodo_externo) || !texto(meta.programa_externo)) {
    falta('Revisa la escuela, el periodo y el programa del original.');
  }
  if (!Array.isArray(materias) || !materias.length) falta('Falta una tabla de materias legible.');
  const filas = materias.map((m, index) => {
    const clave = texto(m.clave), nombre = texto(m.nombre), secuencia = texto(m.secuencia);
    if (!clave || !nombre || !secuencia) falta(`Revisa clave, nombre y secuencia de la fila ${index + 1}.`);
    const bloques = (m.bloques || []).map(b => {
      const dia = Number(b.dia), inicio = texto(b.hora_inicio), fin = texto(b.hora_fin);
      const valida = h => /^([01]\d|2[0-3]):[0-5]\d$/u.test(h);
      if (!Number.isInteger(dia) || dia < 1 || dia > 7 || !valida(inicio) || !(valida(fin) || fin === '24:00') || inicio >= fin) {
        falta(`Revisa día y horas de la fila ${index + 1}.`);
      }
      return { dia, hora_inicio: inicio, hora_fin: fin, edificio: texto(b.edificio) || null, salon: texto(b.salon) || null };
    });
    if (!bloques.length) falta(`Falta contrastar el horario de la fila ${index + 1}.`);
    const creditos = m.creditos == null || String(m.creditos).trim() === '' ? null : Number(m.creditos);
    if (creditos !== null && !Number.isFinite(creditos)) falta(`Revisa los créditos opcionales de la fila ${index + 1}.`);
    return { clave, nombre, secuencia, creditos, bloques,
      profesores_texto: (m.profesores_texto || []).map(texto).filter(Boolean) };
  });
  return { fuente: 'REVISION_AUTORIZADA', completa: meta.completa === true,
    boleta: texto(meta.boleta), escuela_cct: texto(meta.escuela_cct), periodo_externo: texto(meta.periodo_externo),
    programa_externo: texto(meta.programa_externo), plan_externo: texto(meta.plan_externo) || null, materias: filas };
}
