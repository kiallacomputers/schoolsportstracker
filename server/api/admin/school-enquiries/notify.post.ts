import { createError, getHeader, readBody } from 'h3'
import { requirePlatformAdmin } from '../../../utils/requirePlatformAdmin'
import { sendGraphMail } from '../../../utils/graphMail'
export default defineEventHandler(async event=>{
 await requirePlatformAdmin(event)
 const {requestId}=await readBody<{requestId?:string}>(event)
 if(!requestId || !/^[a-f0-9-]{36}$/i.test(requestId))throw createError({statusCode:400,statusMessage:'Invalid request'})
 const c=useRuntimeConfig(event)
 const url=String(c.public.supabase?.url||c.public.supabaseUrl||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=String(c.public.supabase?.key||c.public.supabaseKey||process.env.NUXT_PUBLIC_SUPABASE_KEY||'')
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Supabase not configured'})
 const jwt=(getHeader(event,'authorization')||'').replace(/^Bearer\s+/i,'')
 const r=await fetch(`${url}/rest/v1/school_requests?id=eq.${encodeURIComponent(requestId)}&select=id,school_name,contact_email,status`,{headers:{apikey:key,Authorization:`Bearer ${jwt}`}})
 if(!r.ok)throw createError({statusCode:403,statusMessage:'Cannot read school request'})
 const rows=await r.json() as Array<{school_name:string;contact_email:string;status:string}>
 const req=rows[0]
 if(!req || !['approved','rejected'].includes(req.status))throw createError({statusCode:400,statusMessage:'Request has not been reviewed'})
 const approved=req.status==='approved'
 await sendGraphMail({to:req.contact_email,subject:`School Sports Tracker — School request ${req.status}`,text:approved?`Your request to add ${req.school_name} has been approved. We will contact you separately with details about school administrator access. Approval does not automatically grant access.`:`Your request to add ${req.school_name} was not approved. Please contact School Sports Tracker if you would like to discuss this decision.`})
 return {message:'Notification accepted for sending by Microsoft Graph'}
})
