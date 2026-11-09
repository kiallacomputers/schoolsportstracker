import { setHeader } from 'h3'
import { createSchoolCaptcha, captchaSvg } from '../../utils/schoolCaptcha'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'no-store, private')
  const { answer, token, expiresInSeconds } = createSchoolCaptcha(event)
  return { image: `data:image/svg+xml;base64,${Buffer.from(captchaSvg(answer)).toString('base64')}`, token, expiresInSeconds }
})
