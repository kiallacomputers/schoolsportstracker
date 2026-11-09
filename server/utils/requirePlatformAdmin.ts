import {createError, getHeader} from 'h3'
import {settings} from './schoolEnquiry'
export async function requirePlatformAdmin(event:any){
 const bearer=getHeader(event,'authorization')||''
 if(!/^Bearer\s+\S+$/i.test(bearer))throw createError({statusCode:401,statusMessage:'Sign in required'})
 const token=bearer.replace(/^Bearer\s+/i,'')
 const {url,key}=settings(event)
 // Verify the token with Supabase Auth rather than trusting a client-supplied role.
 const userRes=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}})
 if(!userRes.ok)throw createError({statusCode:401,statusMessage:'Session expired'})
 const roleRes=await fetch(`${url}/rest/v1/rpc/is_platform_admin`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'})
 if(!roleRes.ok || await roleRes.json()!==true)throw createError({statusCode:403,statusMessage:'SuperAdmin required'})
}
