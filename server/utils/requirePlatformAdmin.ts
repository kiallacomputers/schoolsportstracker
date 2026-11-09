import { createError, getHeader } from 'h3'

/** Validate the signed-in user and platform role without requiring the
 * privileged School Requests service key. */
export async function requirePlatformAdmin(event: any) {
  const authorization = getHeader(event, 'authorization') || ''
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  if (!match) throw createError({ statusCode: 401, statusMessage: 'Sign in required' })

  const config = useRuntimeConfig(event)
  const url = String(
    config.public.supabase?.url ||
    config.public.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.NUXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '')
  const key = String(
    config.public.supabase?.key ||
    config.public.supabaseKey ||
    process.env.SUPABASE_KEY ||
    process.env.NUXT_PUBLIC_SUPABASE_KEY ||
    ''
  )
  if (!url || !key) throw createError({ statusCode: 503, statusMessage: 'Supabase authentication is not configured' })

  const headers = { apikey: key, Authorization: `Bearer ${match[1]}` }
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers })
  if (!userResponse.ok) throw createError({ statusCode: 401, statusMessage: 'Session expired; sign in again' })

  // This database RPC must validate auth.uid() and return a boolean.
  // It is executed using the user's JWT, not a service-role token.
  const roleResponse = await fetch(`${url}/rest/v1/rpc/is_platform_admin`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}'
  })
  if (!roleResponse.ok) {
    console.error('SuperAdmin role check failed', roleResponse.status)
    throw createError({ statusCode: 503, statusMessage: 'Unable to verify SuperAdmin access' })
  }
  if ((await roleResponse.json()) !== true) {
    throw createError({ statusCode: 403, statusMessage: 'SuperAdmin access required' })
  }
}
