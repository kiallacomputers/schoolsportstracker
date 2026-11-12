import {createError,getHeader,readBody} from 'h3'
import {sendGraphMail} from '../../utils/graphMail'
export default defineEventHandler(async event=>{
 const bearer=getHeader(event,'authorization')||''
 if(!/^Bearer\s+\S+$/i.test(bearer))throw createError({statusCode:401,statusMessage:'Sign in required'})
 const token=bearer.replace(/^Bearer\s+/i,'')
 const url=(process.env.NUXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.NUXT_PUBLIC_SUPABASE_KEY||process.env.SUPABASE_KEY||''
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!url||!key||!service)throw createError({statusCode:503,statusMessage:'Supabase server configuration missing'})
 const body=await readBody(event)
 const school_id=String(body?.school_id||''),user_id=String(body?.user_id||'')
 if(!/^[\da-f-]{36}$/i.test(school_id)||!/^[\da-f-]{36}$/i.test(user_id))
   throw createError({statusCode:400,statusMessage:'Invalid school or user'})
 const userHeaders={apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
 const auth=await fetch(`${url}/auth/v1/user`,{headers:userHeaders})
 if(!auth.ok)throw createError({statusCode:401,statusMessage:'Session expired'})
 const issued=await fetch(`${url}/rest/v1/rpc/request_school_admin_promotion`,{
  method:'POST',headers:userHeaders,body:JSON.stringify({p_school_id:school_id,p_user_id:user_id})
 })
 if(!issued.ok){
  const err=await issued.json().catch(()=>({}))
  throw createError({statusCode:403,statusMessage:err.message||'Request not permitted'})
 }
 const requestId=await issued.json() as string
 const adminHeaders={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'}
 const [schoolRes,staffRes,adminsRes]=await Promise.all([
  fetch(`${url}/rest/v1/schools?id=eq.${encodeURIComponent(school_id)}&select=name`,{headers:adminHeaders}),
  fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user_id)}&select=display_name`,{headers:adminHeaders}),
  fetch(`${url}/rest/v1/platform_admins?select=user_id`,{headers:adminHeaders})
 ])
 if(!schoolRes.ok||!staffRes.ok||!adminsRes.ok)
  return {message:'Request saved. SuperAdmin email notification could not be prepared; the request remains pending.'}
 const school=(await schoolRes.json() as any[])[0]?.name||'School'
 const staff=(await staffRes.json() as any[])[0]?.display_name||user_id
 const admins=await adminsRes.json() as {user_id:string}[]
 // Fetch admin email addresses from Auth Admin API; never expose the service key to the client.
 const emails=new Set<string>()
 for(const admin of admins.slice(0,50)){
  const r=await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(admin.user_id)}`,{headers:adminHeaders})
  if(r.ok){const u=await r.json() as {email?:string};if(u.email)emails.add(u.email)}
 }
 const origin=(process.env.APP_PUBLIC_URL||process.env.URL||'').replace(/\/$/,'')
 let accepted=0
 for(const email of emails){
  try{
   await sendGraphMail({to:email,subject:`School Sports Tracker — School Administrator approval requested`,
    text:`A School Administrator promotion has been requested.\n\nSchool: ${school}\nStaff member: ${staff}\n\nSign in to School Sports Tracker and open School > Staff to approve or reject the request.\n${/^https:\/\/[^/]+$/i.test(origin)?origin+'/school/staff?school='+encodeURIComponent(school_id):''}\n\nRequest ID: ${requestId}\n\nOnly a SuperAdmin can approve this change.`})
   accepted++
  }catch(e){console.error('School admin promotion notification failed',e)}
 }
 return {message:accepted
  ?`Request submitted. Microsoft Graph accepted ${accepted} SuperAdmin notification(s).`
  :'Request saved as pending, but no SuperAdmin email was accepted. Ask a SuperAdmin to review it.'}
})
