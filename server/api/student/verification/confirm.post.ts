import {createError,readBody} from 'h3'
import {studentIdentity,studentPrivateRpc} from '../../../utils/studentVerification'
export default defineEventHandler(async(event)=>{
 const user=await studentIdentity(event)
 const body=await readBody<{code?:string}>(event)
 const code=String(body?.code||'').trim()
 if(!/^\d{6}$/.test(code))throw createError({statusCode:400,statusMessage:'Enter the six-digit code'})
 const result=await studentPrivateRpc('private_verify_student_email_challenge',{p_user:user.id,p_code:code})
 if(result!=='approved')throw createError({statusCode:400,statusMessage:'Incorrect code; please try again'})
 return {ok:true,message:'Student email verified and school record linked.'}
})
