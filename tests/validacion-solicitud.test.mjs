import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const code=await readFile(new URL('../JS/validacion-solicitud.js',import.meta.url),'utf8');
const {mensajeValidacion,puedeAceptar}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
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
test('director puede aprobar sin cuenta después de validar manualmente',()=>{
 const nueva={estado:'Pendiente',puede_aceptar:true,cuenta_confirmada_coincide:false};
 assert.equal(puedeAceptar(nueva,true),true);
 assert.equal(puedeAceptar(nueva,false),false);
 assert.equal(puedeAceptar(nueva,true,true),false);
 assert.match(mensajeValidacion({estado:'faltante'},'cuenta'),/no impide aprobarla/);
});
test('conflicto, solicitud revisada o servidor antiguo no habilitan aceptación',()=>{
 assert.equal(puedeAceptar({estado:'Pendiente',puede_aceptar:false},true),false);
 assert.equal(puedeAceptar({estado:'Aceptado',puede_aceptar:true},true),false);
 assert.equal(puedeAceptar({estado:'Pendiente',cuenta_confirmada_coincide:true},true),false);
});
