import { createError } from 'h3'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw createError({ statusCode: 503, statusMessage: `Email service is missing ${name}` })
  return value
}

export function emailConfig() {
  const sender = required('MICROSOFT_SENDER_EMAIL')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) throw createError({statusCode:503,statusMessage:'Invalid sender email configuration'})
  return {sender, name:process.env.MAIL_SENDER_NAME?.trim() || 'School Sports Tracker'}
}

export async function sendGraphMail(input: {to:string;subject:string;text:string;replyTo?:string}) {
  const {sender,name} = emailConfig()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) throw createError({statusCode:400,statusMessage:'Invalid recipient address'})
  const tenant = required('MICROSOFT_TENANT_ID')
  const clientId = required('MICROSOFT_CLIENT_ID')
  const secret = required('MICROSOFT_CLIENT_SECRET')
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:clientId,client_secret:secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'})
  })
  if (!tokenResponse.ok) {console.error('Graph token request failed',tokenResponse.status);throw createError({statusCode:502,statusMessage:'Email authentication failed'})}
  const token = (await tokenResponse.json() as {access_token?:string}).access_token
  if (!token) throw createError({statusCode:502,statusMessage:'Email authentication returned no token'})
  const message:any = {
    subject:input.subject,
    body:{contentType:'Text',content:input.text},
    toRecipients:[{emailAddress:{address:input.to}}],
    from:{emailAddress:{address:sender,name}}
  }
  if (input.replyTo) message.replyTo=[{emailAddress:{address:input.replyTo}}]
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({message,saveToSentItems:true})
  })
  if (!response.ok) {console.error('Graph sendMail failed',response.status);throw createError({statusCode:502,statusMessage:'Microsoft Graph could not send the email; check Mail.Send and mailbox permissions'})}
  return {accepted:true} // Graph 202 Accepted, not delivery confirmation
}
