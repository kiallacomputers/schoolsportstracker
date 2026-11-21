import { createError, readBody } from 'h3'

// Uses service-role credentials ONLY on the server. Never expose this key to Nuxt public config.
export default defineEventHandler(async (event) => {
  const body = await readBody<{kind?: string; token?: string; password?: string; firstName?: string; lastName?: string}>(event)
  const kind = body?.kind
  const token = String(body?.token || '')
  const password = String(body?.password || '')
  const firstName = String(body?.firstName || '').trim()
  const lastName = String(body?.lastName || '').trim()
  if ((kind !== 'staff' && kind !== 'school_admin') || !/^[a-f0-9]{64}$/.test(token) ||
      password.length < 12 || password.length > 128 || !firstName || !lastName ||
      firstName.length > 100 || lastName.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Valid invitation, name and password (12–128 characters) required' })
  }
  const url = String(process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw createError({ statusCode: 503, statusMessage: 'Server authentication configuration missing' })
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const lookup = await fetch(`${url}/rest/v1/rpc/private_invitation_email`, {
    method: 'POST', headers, body: JSON.stringify({ p_kind: kind, p_token: token })
  })
  if (!lookup.ok) throw createError({ statusCode: 503, statusMessage: 'Invitation verification unavailable' })
  const email = await lookup.json() as string | null
  if (!email) throw createError({ statusCode: 400, statusMessage: 'Invitation invalid or expired' })
  // Admin createUser does not send Supabase confirmation or invitation emails.
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: `${firstName} ${lastName}` } })
  })
  if (!created.ok) {
    const detail = await created.text()
    if (/already registered|already exists|duplicate/i.test(detail)) {
      throw createError({ statusCode: 409, statusMessage: 'Account already exists. Sign in with your invited email and accept the invitation.' })
    }
    throw createError({ statusCode: 400, statusMessage: 'Unable to create account. Check the invitation and password.' })
  }
  return { ok: true, email, message: 'Account created. Sign in to accept the invitation.' }
})
