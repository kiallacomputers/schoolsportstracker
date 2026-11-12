import {createError,readBody} from 'h3'
import {randomInt} from 'node:crypto'
import {digest,rpc,validEmail,validId} from './_shared'
import {sendGraphMail} from '../../utils/graphMail'
export default defineEventHandler(async event=>{
 const b=await readBody(event)
 if(!validId(b?.competition_id)||!validEmail(b?.email))throw createError({statusCode:400,statusMessage:'Enter a valid school email'})
 const email=String(b.email).trim().toLowerCase()
 const code=String(randomInt(0,1000000)).padStart(6,'0')
 const recipient=await rpc('student_registration_issue_code',{p_competition:b.competition_id,p_email:email,p_hash:digest(code)})
 if(recipient)await sendGraphMail({to:recipient,subject:'School Sports Tracker verification code',text:`Your event registration verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`})
 return {message:'If this email is eligible for registration, a verification code has been sent.'}
})
