import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const apiCode = await readFile(new URL('../JS/confirmacion-api.js',import.meta.url),'utf8');
const api = await import('data:text/javascript;base64,'+Buffer.from(apiCode).toString('base64'));
const originalFetch = globalThis.fetch;
test.after(()=> { globalThis.fetch=originalFetch; });
test('verifica OTP por POST y exige correo confirmado por el servidor',async()=>{
 let request;
 globalThis.fetch=async(url,options)=>{
  request={url,options};
  return new Response(JSON.stringify({user:{email:'qa@example.com',email_confirmed_at:'2026-10-13'}}));
 };
 assert.equal(await api.verificarCodigo(' QA@example.com ','12345678'),true);
 assert.equal(request.url,'https://wdgsvdjojwjebjrpgopn.supabase.co/auth/v1/verify');
 assert.equal(request.options.method,'POST');
 assert.deepEqual(JSON.parse(request.options.body),{email:'qa@example.com',token:'12345678',type:'email'});
 assert.equal(request.options.credentials,'omit');
});
test('un usuario sin confirmar o de otro correo nunca muestra éxito',async()=>{
 for(const user of [{email:'qa@example.com'}, {email:'otro@example.com',email_confirmed_at:'2026-10-13'}]){
  globalThis.fetch=async()=>new Response(JSON.stringify({user}));
  await assert.rejects(api.verificarCodigo('qa@example.com','123456'),/CORREO_NO_CONFIRMADO/);
 }
});
test('validación incompleta no envía códigos ni solicitudes',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No debe llamarse');};
 await assert.rejects(api.verificarCodigo('qa@example.com','12345'));
 await assert.rejects(api.verificarCodigo('qa@example.com','00000000000'));
 await assert.rejects(api.verificarCodigo('qa@example.com','１２３４５６７８'));
 await assert.rejects(api.verificarCodigo('sin-correo','123456'));
 await assert.rejects(api.reenviarCodigo('sin-correo'));
 assert.equal(calls,0);
});
test('un código reutilizado conserva el acceso existente y permite pedir otro',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({code:'otp_expired'}),{status:403});
 let error;try{await api.verificarCodigo('qa@example.com','123456');}catch(e){error=e;}
 assert.equal(error.code,'otp_expired');
 assert.match(api.mensajeErrorConfirmacion(error),/ya fue usado/);
 assert.match(api.mensajeErrorConfirmacion(error),/Si ya confirmaste/);
 assert.match(api.mensajeErrorConfirmacion(error),/más reciente/);
});
test('reenvío usa signup y no crea otra cuenta ni cambia contraseña',async()=>{
 let request;globalThis.fetch=async(url,options)=>{request={url,options};return new Response('{}');};
 await api.reenviarCodigo('QA@example.com');
 assert.match(request.url,/\/resend$/);
 assert.deepEqual(JSON.parse(request.options.body),{email:'qa@example.com',type:'signup'});
});
test('los enlaces antiguos se comprueban con Auth antes de mostrar confirmación',async()=>{
 let headers;globalThis.fetch=async(url,options)=>{headers=options.headers;assert.match(url,/\/user$/);return new Response(JSON.stringify({email_confirmed_at:null}));};
 assert.equal(await api.comprobarEnlace('token-ficticio'),false);
 assert.equal(headers.Authorization,'Bearer token-ficticio');
});
test('correo incluye OTP para la app, sin enlace que un lector pueda consumir',async()=>{
 const template=await readFile(new URL('../supabase/templates/confirmar-correo.html',import.meta.url),'utf8');
 assert.match(template,/\{\{ \.Token \}\}/);
 assert.match(template,/Ya tengo un código de confirmación/);
 assert.doesNotMatch(template,/href=|ConfirmationURL|TokenHash/);
});
test('errores SMTP y límites no se confunden con rechazo de la solicitud',()=>{
 assert.match(api.mensajeErrorConfirmacion({code:'email_address_not_authorized'}),/SMTP/);
 assert.match(api.mensajeErrorConfirmacion({status:429}),/límite temporal/);
});
