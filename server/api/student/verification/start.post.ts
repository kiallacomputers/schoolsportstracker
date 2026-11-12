import {createError} from 'h3'
import {sendGraphMail} from '../../../utils/graphMail'
import {studentIdentity,studentPrivateRpc} from '../../../utils/studentVerification'
export default defineEventHandler(async(event)=>{
 const user=await studentIdentity(event)
 const result=await studentPrivateRpc('private_start_student_email_challenge',{p_user:user.id}) as {email?:string;code?:string}[]
 const challenge=Array.isArray(result)?result[0]:null
 if(!challenge?.email||!challenge?.code)throw createError({statusCode:500,statusMessage:'Could not issue verification code'})
 await sendGraphMail({to:challenge.email,subject:'School Sports Tracker — student verification code',text:`Your School Sports Tracker verification code is ${challenge.code}.\n\nIt expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.`})
 return {ok:true,message:'Verification code sent to your school email address.'}
})
