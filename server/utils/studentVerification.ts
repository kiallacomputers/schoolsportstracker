import {createError,getHeader} from 'h3'

export function studentAdminConfig(){
 const url=(process.env.SUPABASE_URL||process.env.NUXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!url||!key)throw createError({statusCode:503,statusMessage:'Student verification service not configured'})
 return {url,key}
}
export async function studentIdentity(event:any){
 const bearer=getHeader(event,'authorization')||''
 if(!/^Bearer\s+\S+$/i.test(bearer))throw createError({statusCode:401,statusMessage:'Sign in before verifying your student email'})
 const {url,key}=studentAdminConfig()
 const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,authorization:bearer}})
 if(!response.ok)throw createError({statusCode:401,statusMessage:'Session expired; sign in again'})
 const user=await response.json() as {id?:string;email?:string;email_confirmed_at?:string}
 if(!user.id||!user.email||!user.email_confirmed_at)throw createError({statusCode:403,statusMessage:'Confirm your account email first'})
 return user
}
export async function studentPrivateRpc(name:string,body:Record<string,unknown>){
 const {url,key}=studentAdminConfig()
 const response=await fetch(`${url}/rest/v1/rpc/${name}`,{
  method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)
 })
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw createError({statusCode:400,statusMessage:typeof data?.message==='string'?data.message:'Student verification unavailable'})
 return data
}
