import {readBody,createError} from 'h3'
import {getSession,rpc} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const body=await readBody<{eventId?:string;register?:boolean}>(event)
 if(!/^[a-f0-9-]{36}$/i.test(String(body?.eventId||''))||typeof body?.register!=='boolean')
  throw createError({statusCode:400,statusMessage:'Invalid event selection'})
 await rpc('private_registration_toggle',{p_token_hash:getSession(event),p_event:body.eventId,p_register:body.register})
 return {ok:true}
})
