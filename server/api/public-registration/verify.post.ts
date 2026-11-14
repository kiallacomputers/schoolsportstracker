import {readBody,createError} from 'h3'
import {digest,email,rpc,token,validEmail} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const body=await readBody<{email?:string;code?:string}>(event)
 const address=email(body?.email),otp=String(body?.code||'').trim()
 if(!validEmail(address)||!/^\d{6}$/.test(otp))throw createError({statusCode:400,statusMessage:'Enter your email and six-digit code'})
 const session=token()
 const valid=await rpc<boolean>('private_registration_verify',{p_email:address,p_code_hash:digest(otp),p_token_hash:digest(session)})
 if(!valid)throw createError({statusCode:400,statusMessage:'Code invalid, expired or too many attempts'})
 return {session,expiresInMinutes:30}
})
