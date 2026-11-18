import {assertRegistrationOpen} from '../../utils/registrationWindow'
import {readBody,createError} from 'h3'
import {digest,email,rpc,token,validEmail} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const body=await readBody<{email?:string;code?:string;competitionId?:string}>(event)
 const address=email(body?.email),otp=String(body?.code||''),competitionId=String(body?.competitionId||'')
 if(!validEmail(address)||!/^\d{6}$/.test(otp)||!/^[a-f0-9-]{36}$/i.test(competitionId))throw createError({statusCode:400,statusMessage:'Enter a valid code and competition'})
 await assertRegistrationOpen(competitionId)
 const session=token()
 const student=await rpc<string|null>('student_registration_verify_code',{p_competition:competitionId,p_email:address,p_hash:digest(otp),p_session_hash:digest(session)})
 if(!student)throw createError({statusCode:400,statusMessage:'Code invalid or expired'})
 return {session,expiresInMinutes:30}
})
