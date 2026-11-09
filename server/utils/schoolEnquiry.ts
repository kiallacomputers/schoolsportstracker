import { createHash } from 'node:crypto'
import { createError, getHeader, getRequestIP } from 'h3'
export function settings(event: any) {
 const c = useRuntimeConfig(event)
 const url = String(c.public.supabase?.url || c.public.supabaseUrl || process.env.SUPABASE_URL || '').replace(/\/$/, '')
 const key = String(c.schoolEnquiryServiceKey || process.env.NUXT_SUPABASE_SECRET_KEY || '')
 if (!url || !key) throw createError({statusCode:503,statusMessage:'School requests are not configured'})
 return {url,key}
}
export async function supaRequest(event:any, path:string, options:RequestInit={}) {
 const {url,key}=settings(event)
 const r=await fetch(`${url}${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,...options.headers}})
 const body=await r.text();let data:any;try{data=JSON.parse(body)}catch{data=body}
 if(!r.ok)throw createError({statusCode:r.status>=500?502:400,statusMessage:typeof data==='object'?data.message||data.error||'Request failed':'Request failed'})
 return data
}
export function ipHash(event:any){const ip=getRequestIP(event,{xForwardedFor:true})||'unknown';return createHash('sha256').update(ip+'|'+(process.env.SCHOOL_REQUEST_IP_SALT||'')).digest('hex')}
export async function verifyTurnstile(event:any,token:string){
 const secret=process.env.TURNSTILE_SECRET_KEY
 if(!secret)throw createError({statusCode:503,statusMessage:'School enquiry spam protection is not configured'})
 const ip=getRequestIP(event,{xForwardedFor:true})||''
 const result:any=await $fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token,remoteip:ip})})
 if(!result.success)throw createError({statusCode:400,statusMessage:'Please complete the verification challenge'})
}
