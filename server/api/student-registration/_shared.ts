import {createError} from 'h3'
import {createHash,randomBytes} from 'node:crypto'
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
export const randomToken=()=>randomBytes(32).toString('hex')
export const validId=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
export const validEmail=(s:unknown)=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
export async function rpc(name:string,body:object){
 const url=(process.env.SUPABASE_URL||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Student registration is not configured'})
 const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
 if(!r.ok){console.error('Student registration RPC failed',name,r.status,(await r.text()).slice(0,300));throw createError({statusCode:503,statusMessage:'Registration service unavailable'})}
 return await r.json()
}
