import {createError,getHeader,readBody} from 'h3'
import {sendGraphMail} from '../../utils/graphMail'
export default defineEventHandler(async event=>{
 const bearer=getHeader(event,'authorization')||''
 if(!/^Bearer\s+\S+$/i.test(bearer)) throw createError({statusCode:401,statusMessage:'Sign in required'})
 const token=bearer.replace(/^Bearer\s+/i,'')
 const url=(process.env.NUXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.NUXT_PUBLIC_SUPABASE_KEY||process.env.SUPABASE_KEY||''
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Supabase public configuration unavailable'})
 const body=await readBody(event)
 const school_id=String(body?.school_id||''),email=String(body?.email||'').trim().toLowerCase()
 if(!/^[0-9a-f-]{36}$/i.test(school_id)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw createError({statusCode:400,statusMessage:'Valid school and email required'})
 const headers={apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
 const auth=await fetch(`${url}/auth/v1/user`,{headers})
 if(!auth.ok)throw createError({statusCode:401,statusMessage:'Session expired'})
 const origin=(process.env.APP_PUBLIC_URL||process.env.URL||'').replace(/\/$/,'')
 if(!/^https:\/\/[^/]+$/i.test(origin))throw createError({statusCode:503,statusMessage:'APP_PUBLIC_URL must be set to the HTTPS site origin'})
 const issued=await fetch(`${url}/rest/v1/rpc/issue_school_staff_invitation`,{method:'POST',headers,body:JSON.stringify({p_school_id:school_id,p_email:email})})
 if(!issued.ok){const info=await issued.json().catch(()=>({}));throw createError({statusCode:403,statusMessage:info.message||'Not authorised to invite staff'})}
 const inviteToken=await issued.json() as string
 const link=`${origin}/staff/register?token=${encodeURIComponent(inviteToken)}`
 await sendGraphMail({to:email,subject:'School Sports Tracker — Staff invitation',text:`You have been invited to register as school staff on School Sports Tracker.\n\nRegister using this link:\n${link}\n\nUse the email address that received this invitation. Sign in with the invited email address to accept. Once accepted, you will be assigned to the school as a Teacher automatically.\n\nThis link expires in seven days. If you were not expecting this invitation, ignore this email.`})
 return {ok:true,message:'Microsoft Graph accepted the invitation for sending. Delivery is not guaranteed.'}
})
