import {createError} from 'h3'
import {config} from './publicStudentRegistration'

/** Authoritative UTC window check; never trust the browser clock or manual status. */
export async function assertRegistrationOpen(competitionId:string) {
  const {url,key}=config()
  const response=await fetch(`${url}/rest/v1/competitions?id=eq.${encodeURIComponent(competitionId)}&select=registration_opens_at,registration_closes_at`,{
    headers:{apikey:key,authorization:`Bearer ${key}`}
  })
  if(!response.ok)throw createError({statusCode:503,statusMessage:'Unable to verify registration dates'})
  const rows=await response.json() as Array<{registration_opens_at:string|null;registration_closes_at:string|null}>
  const row=rows[0]
  const opens=row?.registration_opens_at?Date.parse(row.registration_opens_at):NaN
  const closes=row?.registration_closes_at?Date.parse(row.registration_closes_at):NaN
  if(!Number.isFinite(opens)||!Number.isFinite(closes)||opens>=closes)
    throw createError({statusCode:403,statusMessage:'Registration dates are not configured correctly'})
  const now=Date.now()
  if(now<opens)throw createError({statusCode:403,statusMessage:'Registration has not opened yet'})
  if(now>=closes)throw createError({statusCode:403,statusMessage:'Registration is closed'})
}
