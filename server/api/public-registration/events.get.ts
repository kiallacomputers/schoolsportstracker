import {getSession,rpc} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 return await rpc('private_registration_events',{p_token_hash:getSession(event)})
})
