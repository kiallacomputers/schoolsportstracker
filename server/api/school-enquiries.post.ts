import { verifySchoolCaptcha } from '../utils/schoolCaptcha'
import { sendGraphMail } from '../utils/graphMail'
import { createError, readMultipartFormData } from 'h3'
import { ipHash, supaRequest } from '../utils/schoolEnquiry'
export default defineEventHandler(async event=>{
 const parts=await readMultipartFormData(event)
 if(!parts)throw createError({statusCode:400,statusMessage:'Invalid form'})
 const fields:Record<string,string>={};let logo:Uint8Array|undefined;let mime=''
 for(const part of parts){if(!part.name)continue;if(part.name==='logo'){logo=part.data;mime=part.type||''}else if(part.data.length<4000)fields[part.name]=part.data.toString('utf8').trim()}
 if(fields.websiteTrap) return {ok:true} // honeypot: silent discard
 await verifySchoolCaptcha(event,fields.captchaToken||'',fields.captchaAnswer||'')
 const required=['schoolName','domain','firstName','lastName','position','email'];if(required.some(k=>!fields[k]))throw createError({statusCode:400,statusMessage:'Complete all required fields'})
 if(logo){if(logo.length>2097152)throw createError({statusCode:400,statusMessage:'Logo must be 2 MB or smaller'});
 const png=logo[0]===137&&logo[1]===80&&logo[2]===78&&logo[3]===71;
 const jpg=logo[0]===255&&logo[1]===216&&logo[2]===255;
 const webp=String.fromCharCode(...logo.slice(0,4))==='RIFF'&&String.fromCharCode(...logo.slice(8,12))==='WEBP';
 if(!((mime==='image/png'&&png)||(mime==='image/jpeg'&&jpg)||(mime==='image/webp'&&webp)))throw createError({statusCode:400,statusMessage:'Invalid logo file'})}
 const result=await supaRequest(event,'/rest/v1/rpc/create_public_school_enquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_school_name:fields.schoolName,p_school_domain:fields.domain.replace(/^@/,''),p_first_name:fields.firstName,p_last_name:fields.lastName,p_position:fields.position,p_email:fields.email,p_phone:fields.phone||null,p_website:fields.website||null,p_school_code:fields.code||null,p_notes:fields.notes||null,p_ip_hash:ipHash(event)})})
 const id=String(result)
 if(logo){const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';const path=`${id}/logo.${ext}`
 try{
  await supaRequest(event,`/storage/v1/object/school-logos/${path}`,{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false'},body:Buffer.from(logo)})
  await supaRequest(event,`/rest/v1/school_requests?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({logo_path:path})})
 }catch(e){console.error('School request logo could not be attached',id,e)} }
 // Best-effort internal notification. Enquiry success must not depend on mail delivery.
 const notifyTo=process.env.SCHOOL_REQUEST_NOTIFICATION_EMAIL?.trim()
 if(notifyTo){
  try {await sendGraphMail({to:notifyTo,subject:'New School Sports Tracker school request',text:`A school request has been received for ${fields.schoolName}.\nContact: ${fields.firstName} ${fields.lastName} (${fields.email})\nReview in the SuperAdmin School Requests page.`})}
  catch(e){console.error('School enquiry notification failed',id,e)}
 }
 return {ok:true}
})
