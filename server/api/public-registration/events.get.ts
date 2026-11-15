import {getSession,rpc} from '../../utils/publicStudentRegistration'
import {getQuery,createError} from 'h3'
export default defineEventHandler(async(event)=>{
 const id=String(getQuery(event).competitionId||'')
 if(!/^[a-f0-9-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Invalid competition'})
 return await rpc('public_student_registration_events',{p_competition:id,p_session_hash:getSession(event)})
})
