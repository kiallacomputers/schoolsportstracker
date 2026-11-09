import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createError } from 'h3'
import { settings, supaRequest, ipHash } from './schoolEnquiry'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ttl = 5 * 60 * 1000
function secret(event: any) {
  // Server-only existing credential, never returned to the browser.
  const { key } = settings(event)
  return createHmac('sha256', key).update('school-captcha-v1').digest()
}
function mac(event: any, data: string) { return createHmac('sha256', secret(event)).update(data).digest('hex') }
function hashAnswer(event: any, nonce: string, answer: string) {
  return createHmac('sha256', secret(event)).update(nonce + ':' + answer.toUpperCase()).digest('hex')
}
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex')
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y)
}
export function createSchoolCaptcha(event: any) {
  const answer = Array.from(randomBytes(5), b => alphabet[b % alphabet.length]).join('')
  const nonce = randomBytes(16).toString('hex')
  const expiry = Date.now() + ttl
  const payload = `${nonce}.${expiry}.${hashAnswer(event, nonce, answer)}`
  return { answer, token: `${payload}.${mac(event, payload)}`, expiresInSeconds: ttl / 1000 }
}
export async function verifySchoolCaptcha(event: any, token: string, answer: string) {
  if (token.length > 500 || answer.length > 30) throw createError({ statusCode: 400, statusMessage: 'Invalid CAPTCHA. Refresh and try again.' })
  const parts = token.split('.')
  if (parts.length !== 4) throw createError({ statusCode: 400, statusMessage: 'CAPTCHA missing. Refresh and try again.' })
  const [nonce, expiryText, expectedHash, signature] = parts
  const expiry = Number(expiryText)
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(expectedHash) || !/^[a-f0-9]{64}$/.test(signature) || !Number.isSafeInteger(expiry)) throw createError({ statusCode: 400, statusMessage: 'Invalid CAPTCHA. Refresh and try again.' })
  const payload = `${nonce}.${expiryText}.${expectedHash}`
  if (!safeEqual(signature, mac(event, payload)) || expiry < Date.now() || expiry > Date.now() + ttl + 1000) throw createError({ statusCode: 400, statusMessage: 'CAPTCHA expired or invalid. Refresh and try again.' })
  // Atomic DB operation ensures one-time use across Netlify function instances and rate limits failed attempts.
  const valid = safeEqual(hashAnswer(event, nonce, answer.trim()), expectedHash)
  const accepted = await supaRequest(event, '/rest/v1/rpc/consume_school_captcha', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_nonce: nonce, p_ip_hash: ipHash(event), p_valid: valid })
  })
  if (accepted !== true) throw createError({ statusCode: 400, statusMessage: 'Incorrect CAPTCHA or too many attempts. Refresh and try again.' })
}
export function captchaSvg(answer: string) {
  const chars = [...answer].map((c, i) => `<text x="${33 + i * 43}" y="${57 + (i % 2 ? -5 : 3)}" transform="rotate(${i % 2 ? 7 : -8} ${33 + i * 43} 45)" fill="${i % 2 ? '#17416c' : '#315c89'}" font-size="38" font-family="monospace" font-weight="bold">${c}</text>`).join('')
  const lines = Array.from({length: 7}, (_, i) => `<path d="M ${i*38} 4 Q ${140-i*8} ${i*13+8} 270 ${75-i*8}" stroke="#7a94ae" stroke-width="1" opacity=".55" fill="none"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 85" role="img" aria-label="CAPTCHA verification code"><rect width="270" height="85" rx="8" fill="#eaf0f6"/>${lines}${chars}</svg>`
}
