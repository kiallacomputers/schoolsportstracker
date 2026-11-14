import {createHash,randomBytes} from 'node:crypto'
import {createError,getHeader} from 'h3'

export const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
export const token=()=>randomBytes(32).toString('hex')
export const code=()=>String(randomBytes(4).readUInt32BE(0)%1000000).padStart(6,'0')
export const email=(s:unknown)=>String(s||'').trim().toLowerCase()
export function config(){
 const url=(process.env.SUPABASE_URL||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Registration service is not configured'})
 return {url,key}
}
export async function rpc<T=unknown>(name:string,body:Record<string,unknown>):Promise<T>{
 const {url,key}=config()
 const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)})
 const result=await response.json().catch(()=>null)
 if(!response.ok)throw createError({statusCode:400,statusMessage:result?.message||'Registration unavailable'})
 return result as T
}
export function getSession(event:any){
 const header=getHeader(event,'authorization')||''
 const match=/^Bearer ([a-f0-9]{64})$/.exec(header)
 if(!match)throw createError({statusCode:401,statusMessage:'Verify your school email to continue'})
 return digest(match[1])
}
export function validEmail(value:string){return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
