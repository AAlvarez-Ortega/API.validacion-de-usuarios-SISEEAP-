import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const code=await readFile(new URL('../JS/validacion-solicitud.js',import.meta.url),'utf8');
const {mensajeValidacion}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('registro faltante se distingue de campos diferentes',()=>{
 assert.match(mensajeValidacion({estado:'faltante'},'padron'),/No hay un registro previo/);
 const diferente=mensajeValidacion({estado:'diferente',campos_diferentes:['correo','apellido_materno','escuela_id']},'padron');
 assert.match(diferente,/correo, apellido materno, escuela/);
 assert.doesNotMatch(diferente,/No hay/);
});
test('cuenta ausente, sin confirmar y sin perfil tienen explicación propia',()=>{
 assert.match(mensajeValidacion({estado:'faltante'},'cuenta'),/No existe una cuenta/);
 assert.match(mensajeValidacion({estado:'sin_confirmar'},'cuenta'),/aún no está confirmado/);
 assert.match(mensajeValidacion({estado:'sin_perfil'},'cuenta'),/falta el perfil/);
});
test('ambigüedad no atribuye diferencias a una persona equivocada',()=>{
 assert.match(mensajeValidacion({estado:'ambiguo',campos_diferentes:['curp']},'padron'),/varios registros/);
 assert.doesNotMatch(mensajeValidacion({estado:'ambiguo',campos_diferentes:['curp']},'padron'),/CURP/);
});
test('validación incompleta obliga a actualizar',()=>{
 assert.match(mensajeValidacion(undefined,'cuenta'),/Actualiza la lista/);
 assert.match(mensajeValidacion({estado:'coincidente'},'cuenta'),/Cuenta confirmada/);
});
