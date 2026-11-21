import {createError,readBody,getRequestIP} from 'h3'
export default defineEventHandler(async event=>{
 const b=await readBody(event)
 if(b?.website)return {ok:true}
 const schoolName=String(b?.schoolName||'').trim(),contactName=String(b?.contactName||'').trim(),email=String(b?.email||'').trim().toLowerCase(),position=String(b?.position||'').trim(),phone=String(b?.phone||'').trim(),schoolCode=String(b?.schoolCode||'').trim(),notes=String(b?.notes||'').trim()
 if(schoolName.length<3||schoolName.length>150||contactName.length<2||contactName.length>150||position.length<2||position.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.length>40||schoolCode.length>30||notes.length>1000)throw createError({statusCode:400,statusMessage:'Check the required school and contact details'})
 const url=String(process.env.SUPABASE_URL||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Registration service unavailable'})
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'}
 const result=await fetch(url+'/rest/v1/rpc/submit_public_school_request',{method:'POST',headers,body:JSON.stringify({p_school_name:schoolName,p_contact_name:contactName,p_contact_email:email,p_contact_position:position,p_contact_phone:phone||null,p_school_code:schoolCode||null,p_notes:notes||null})})
 if(!result.ok){const body=await result.json().catch(()=>({}));const msg=String(body?.message||'');throw createError({statusCode:/already|pending|exists/i.test(msg)?409:400,statusMessage:/already|pending|exists/i.test(msg)?'A request for this school may already exist. Contact the platform administrator.':'Unable to submit school request'})}
 return {ok:true}
})