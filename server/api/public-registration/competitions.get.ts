import {getQuery,createError} from 'h3'
import {email,rpc,validEmail} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async(event)=>{
 const address=email(getQuery(event).email)
 if(!validEmail(address))throw createError({statusCode:400,statusMessage:'Enter a valid school email address'})
 return await rpc('public_student_competitions_for_email',{p_email:address})
})
