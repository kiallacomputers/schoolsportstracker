import {createError,readBody} from 'h3'
import {requirePlatformAdmin} from '../../../utils/requirePlatformAdmin'
import {sendGraphMail} from '../../../utils/graphMail'
export default defineEventHandler(async event=>{
 await requirePlatformAdmin(event)
 const body=await readBody(event)
 const to=String(body?.to||'').trim()
 if(to.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw createError({statusCode:400,statusMessage:'Enter a valid email address'})
 await sendGraphMail({to,subject:'School Sports Tracker — Test Email',text:'This is a test email from School Sports Tracker. Microsoft Graph accepted the message for sending.'})
 return {ok:true,message:'Microsoft Graph accepted the message. Check the recipient inbox and junk folder.'}
})
