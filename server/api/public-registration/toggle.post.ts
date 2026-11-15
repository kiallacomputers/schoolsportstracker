import {readBody,createError} from 'h3'
import {getSession,rpc} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const body=await readBody<{eventId?:string;competitionId?:string;register?:boolean}>(event)
 if(!/^[a-f0-9-]{36}$/i.test(String(body?.eventId||''))||!/^[a-f0-9-]{36}$/i.test(String(body?.competitionId||''))||typeof body?.register!=='boolean')throw createError({statusCode:400,statusMessage:'Invalid event selection'})
 await rpc('public_student_registration_toggle',{p_competition:body.competitionId,p_session_hash:getSession(event),p_event:body.eventId,p_register:body.register})
 return {ok:true}
})
