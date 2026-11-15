import {readBody,createError} from 'h3'
import {sendGraphMail} from '../../utils/graphMail'
import {code,digest,email,rpc,validEmail} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const body=await readBody<{email?:string;competitionId?:string}>(event)
 const address=email(body?.email),competitionId=String(body?.competitionId||'')
 if(!validEmail(address)||!/^[a-f0-9-]{36}$/i.test(competitionId))throw createError({statusCode:400,statusMessage:'Select a competition and enter a valid school email'})
 const otp=code()
 const accepted=await rpc<string|null>('student_registration_issue_code',{p_competition:competitionId,p_email:address,p_hash:digest(otp)})
 if(accepted)await sendGraphMail({to:accepted,subject:'School Sports Tracker registration code',text:`Your student sports registration code is ${otp}. It expires in 10 minutes. Do not share it.`})
 return {ok:true,message:'If your school email matches an eligible imported student, a code has been sent.'}
})
