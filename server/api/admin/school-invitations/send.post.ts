import { createError, readBody, getHeader } from 'h3'
import { requirePlatformAdmin } from '../../../utils/requirePlatformAdmin'
import { sendGraphMail } from '../../../utils/graphMail'

export default defineEventHandler(async event => {
 await requirePlatformAdmin(event)
 const body = await readBody<{requestId?:string; email?:string}>(event)
 const requestId = body?.requestId?.trim()
 const email = body?.email?.trim().toLowerCase()
 if (!requestId || !/^[a-f0-9-]{36}$/i.test(requestId) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({statusCode:400,statusMessage:'Valid request and recipient required'})
 const config = useRuntimeConfig(event)
 const url = String(config.public.supabase?.url || config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/,'')
 const key = String(config.public.supabase?.key || config.public.supabaseKey || process.env.NUXT_PUBLIC_SUPABASE_KEY || '')
 if (!url || !key) throw createError({statusCode:503,statusMessage:'Supabase not configured'})
 const jwt = (getHeader(event,'authorization')||'').replace(/^Bearer\s+/i,'')
 const r = await fetch(`${url}/rest/v1/rpc/issue_school_admin_invitation`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify({p_request_id:requestId,p_email:email})})
 if (!r.ok) {console.error('Invitation RPC failed',r.status);throw createError({statusCode:400,statusMessage:'Unable to create invitation. Confirm school is approved and you are SuperAdmin.'})}
 const token = await r.json() as string
 const origin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/,'')
 if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) throw createError({statusCode:503,statusMessage:'APP_PUBLIC_URL must be configured as the HTTPS website origin'})
 const link = `${origin}/invitations/accept?token=${encodeURIComponent(token)}`
 try {
  await sendGraphMail({to:email,subject:'Your School Sports Tracker administrator invitation',text:`You have been invited to administer your school on School Sports Tracker.\n\nAccept your invitation within 7 days:\n${link}\n\nSign in or create an account using this exact email address, verify it, then open the invitation link again.\n\nIf you did not expect this invitation, ignore this message.`})
 } catch(e) { console.error('School admin invitation email failed',e);throw createError({statusCode:502,statusMessage:'Invitation created but email failed. Retry sending to issue a new link.'}) }
 return {message:'Invitation accepted for sending by Microsoft Graph'}
})
