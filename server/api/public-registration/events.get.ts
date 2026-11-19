import { getSession, rpc } from '../../utils/publicStudentRegistration'
import { config } from '../../utils/publicStudentRegistration'
import { getQuery, createError } from 'h3'

type EventRow = { registration_open?: boolean; [key: string]: unknown }

export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).competitionId || '')
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid competition' })
  }

  // Keep the database RPC responsible for session and event eligibility.
  const rows = await rpc<EventRow[]>('public_student_registration_events', {
    p_competition: id,
    p_session_hash: getSession(event)
  })

  // The competition dates are authoritative for both the landing page and events.
  const { url, key } = config()
  const response = await fetch(
    `${url}/rest/v1/competitions?id=eq.${encodeURIComponent(id)}&select=registration_opens_at,registration_closes_at`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } }
  )
  if (!response.ok) {
    throw createError({ statusCode: 503, statusMessage: 'Unable to verify registration dates' })
  }
  const competitions = await response.json() as Array<{
    registration_opens_at: string | null
    registration_closes_at: string | null
  }>
  const c = competitions[0]
  const opens = c?.registration_opens_at ? Date.parse(c.registration_opens_at) : NaN
  const closes = c?.registration_closes_at ? Date.parse(c.registration_closes_at) : NaN
  const now = Date.now()
  const isOpen = Number.isFinite(opens) && Number.isFinite(closes) &&
    opens < closes && now >= opens && now < closes

  return rows.map(row => ({ ...row, registration_open: isOpen }))
})
