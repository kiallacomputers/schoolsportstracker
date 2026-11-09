<script setup lang="ts">
definePageMeta({middleware:'admin'})
const client=useSupabaseClient()
const to=ref(''),busy=ref(false),error=ref(''),result=ref('')
async function sendTest(){
 busy.value=true;error.value='';result.value=''
 try{
  const {data:{session}}=await client.auth.getSession()
  if(!session)throw new Error('Please sign in again')
  const response=await $fetch<{message:string}>('/api/admin/email/test',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:{to:to.value}})
  result.value=response.message
 }catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to send test email'}finally{busy.value=false}
}
</script>
<template><div class="page"><div class="shell admin-section"><NuxtLink to="/dashboard">← Dashboard</NuxtLink><h1>Email Settings</h1><p>Application emails are sent securely using Microsoft Graph. Sender: <strong>sportstracker@kiallacomputers.com.au</strong> (set in Netlify as MICROSOFT_SENDER_EMAIL).</p><div class="card" style="max-width:650px"><h2>Send a test email</h2><p>Only SuperAdmins can use this function.</p><form @submit.prevent="sendTest"><label>Recipient email<input v-model="to" type="email" required autocomplete="email" placeholder="you@example.com" /></label><button class="btn" type="submit" :disabled="busy">{{busy?'Sending…':'Send Test Email'}}</button></form><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="result" class="success" role="status">{{result}}</p></div><p class="notice">Changing the sending mailbox requires updating Netlify environment variables and redeploying. Supabase Auth verification and password-reset emails require separate SMTP or a configured Send Email Hook.</p></div></div></template>
