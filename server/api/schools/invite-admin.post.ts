import {createError,getHeader,readBody} from 'h3'
import {sendGraphMail} from '../../utils/graphMail'
export default defineEventHandler(async event=>{
 const bearer=getHeader(event,'authorization')||''
 if(!/^Bearer\s+\S+$/i.test(bearer))throw createError({statusCode:401,statusMessage:'Sign in required'})
 const access=bearer.replace(/^Bearer\s+/i,'')
 const body=await readBody(event),requestId=String(body?.requestId||'')
 if(!/^[0-9a-f-]{36}$/i.test(requestId))throw createError({statusCode:400,statusMessage:'Invalid request'})
 const url=String(process.env.SUPABASE_URL||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.NUXT_PUBLIC_SUPABASE_KEY||process.env.SUPABASE_KEY||''
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Supabase configuration missing'})
 const headers={apikey:key,Authorization:'Bearer '+access,'Content-Type':'application/json'}
 const auth=await fetch(url+'/auth/v1/user',{headers});if(!auth.ok)throw createError({statusCode:401,statusMessage:'Session expired'})
 const req=await fetch(url+'/rest/v1/school_requests?id=eq.'+encodeURIComponent(requestId)+'&select=id,contact_email,status,created_school_id',{headers})
 if(!req.ok)throw createError({statusCode:403,statusMessage:'Not authorised to view request'})
 const rows=await req.json() as {contact_email:string;status:string;created_school_id:string|null}[]
 const r=rows[0];if(!r||r.status!=='approved'||!r.created_school_id)throw createError({statusCode:400,statusMessage:'Approve the school first'})
 const origin=String(process.env.APP_PUBLIC_URL||process.env.URL||'').replace(/\/$/,'')
 if(!/^https:\/\/[^/]+$/i.test(origin))throw createError({statusCode:503,statusMessage:'APP_PUBLIC_URL must be set to the HTTPS site origin'})
 const issued=await fetch(url+'/rest/v1/rpc/issue_school_admin_invitation',{method:'POST',headers,body:JSON.stringify({p_request_id:requestId,p_email:r.contact_email})})
 if(!issued.ok)throw createError({statusCode:403,statusMessage:'Unable to issue administrator invitation'})
 const token=await issued.json() as string
 const link=origin+'/invitations/accept-admin?token='+encodeURIComponent(token)
 await sendGraphMail({to:r.contact_email,subject:'School Sports Tracker — School Administrator invitation',text:'Your school has been approved for School Sports Tracker.\n\nAccept your School Administrator invitation:\n'+link+'\n\nUse this email address to create your account or sign in. This invitation expires in seven days. If you did not expect it, ignore this message.'})
 return {ok:true,message:'Administrator invitation submitted to Microsoft Graph for sending.'}
})