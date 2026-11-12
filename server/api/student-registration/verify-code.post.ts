import {createError,readBody} from 'h3'
import {digest,randomToken,rpc,validEmail,validId} from './_shared'
export default defineEventHandler(async event=>{
 const b=await readBody(event)
 if(!validId(b?.competition_id)||!validEmail(b?.email)||!/^\d{6}$/.test(b?.code||''))throw createError({statusCode:400,statusMessage:'Invalid verification details'})
 const token=randomToken()
 const student=await rpc('student_registration_verify_code',{p_competition:b.competition_id,p_email:String(b.email).trim().toLowerCase(),p_hash:digest(b.code),p_session_hash:digest(token)})
 if(!student)throw createError({statusCode:403,statusMessage:'Code invalid or expired'})
 return {token,expires_in:1800}
})
