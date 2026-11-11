import {supabase,supabaseUrl,supabasePublicKey} from './coneccionSB.js?v=1.24.0-983a04337a31';
export async function pedirImportacionHorarios(path,{method='GET',body}={}){
  const {data,error}=await supabase.auth.getSession();
  if(error||!data?.session?.access_token)throw new Error('La sesión venció. Vuelve a iniciar sesión.');
  let response;
  try{response=await fetch(supabaseUrl+'/functions/v1/sisaep-campus/api/admin/horarios'+path,{
    method,headers:{Authorization:'Bearer '+data.session.access_token,apikey:supabasePublicKey,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000),cache:'no-store'});}
  catch{throw new Error('No se pudo confirmar la respuesta del servidor. Conserva esta página y vuelve a intentar la misma operación.');}
  let result;try{result=await response.json();}catch{throw new Error('El servidor devolvió una respuesta incompleta. Vuelve a intentar la misma operación.');}
  if(!response.ok)throw Object.assign(new Error(result.message||'No se pudo completar la importación.'),{status:response.status});
  return result;
}

export function archivoComoBase64(file){return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el archivo seleccionado.'));
  reader.onload=()=>{const value=String(reader.result||''),separator=value.indexOf(',');if(separator<0)reject(new Error('El archivo no se pudo preparar.'));else resolve(value.slice(separator+1));};
  reader.readAsDataURL(file);
});}
