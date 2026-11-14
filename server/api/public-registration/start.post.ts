import {readBody,createError,getRequestIP} from 'h3'
import {sendGraphMail} from '../../utils/graphMail'
import {code,digest,email,rpc,validEmail} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const body=await readBody<{email?:string}>(event)
 const address=email(body?.email)
 if(!validEmail(address))throw createError({statusCode:400,statusMessage:'Enter a valid school email'})
 const otp=code()
 const ip=getRequestIP(event,{xForwardedFor:false})||'unknown'
 const allowed=await rpc<boolean>('private_registration_start',{
  p_email:address,p_code_hash:digest(otp),p_ip_hash:digest(ip)
 })
 if(allowed)await sendGraphMail({to:address,subject:'School Sports Tracker registration code',
  text:`Your student sports registration code is ${otp}. It expires in 10 minutes. Do not share it. If you did not request this, ignore the message.`})
 return {ok:true,message:'If your email matches an eligible imported student, a code has been sent. Check your inbox.'}
})
