import {rpc} from '../../utils/publicStudentRegistration'
export default defineEventHandler(async()=>await rpc('public_student_registration_competitions',{}))
