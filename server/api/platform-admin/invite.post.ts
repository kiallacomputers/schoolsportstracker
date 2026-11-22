import {createError,getHeader,readBody} from 'h3'
import {sendGraphMail} from '../../utils/graphMail'
export default defineEventHandler(async event=>{
 const bearer=getHeader(event,'authorization')||''
 if(!/^Bearer\s+\S+$/i.test(bearer))throw createError({statusCode:401,statusMessage:'Sign in required'})
 const body=await readBody(event)
 const email=String(body?.email||'').trim().toLowerCase()
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw createError({statusCode:400,statusMessage:'Enter a valid email address'})
 const url=String(process.env.SUPABASE_URL||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.NUXT_PUBLIC_SUPABASE_KEY||process.env.SUPABASE_KEY||''
 const origin=String(process.env.APP_PUBLIC_URL||process.env.URL||'').replace(/\/$/,'')
 if(!url||!key||!/^https:\/\/[^/]+$/i.test(origin))throw createError({statusCode:503,statusMessage:'Invitation service configuration missing'})
 const headers={apikey:key,Authorization:bearer,'Content-Type':'application/json'}
 const auth=await fetch(url+'/auth/v1/user',{headers})
 if(!auth.ok)throw createError({statusCode:401,statusMessage:'Session expired'})
 const issued=await fetch(url+'/rest/v1/rpc/issue_platform_admin_invitation',{method:'POST',headers,body:JSON.stringify({p_email:email})})
 if(!issued.ok){const details=await issued.json().catch(()=>({}));throw createError({statusCode:403,statusMessage:details.message||'Unable to issue invitation'})}
 const token=await issued.json() as string
 const link=origin+'/invitations/accept-platform-admin?token='+encodeURIComponent(token)
 await sendGraphMail({to:email,subject:'School Sports Tracker — Platform Administrator invitation',text:'You have been invited to become a Platform Administrator for School Sports Tracker. This role has platform-wide access.\n\nAccept your invitation: '+link+'\n\nSign in or register using the invited email address. You must confirm your email before accepting. This invitation expires in seven days. If unexpected, ignore this email.'})
 return {ok:true,message:'Invitation submitted to Microsoft Graph for delivery.'}
})