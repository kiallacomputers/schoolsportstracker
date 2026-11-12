<script setup lang="ts">
const db=useSupabaseClient()
const status=ref(''),error=ref(''),notice=ref(''),busy=ref(false),code=ref(''),sent=ref(false)
const given=ref(''),family=ref('')
onMounted(async()=>{
 const {data:{user}}=await db.auth.getUser()
 if(!user){await navigateTo('/login');return}
 given.value=user.user_metadata?.full_name?.split(' ')[0]||''
 family.value=user.user_metadata?.full_name?.split(' ').slice(1).join(' ')||''
 const r=await db.from('student_account_requests').select('status').eq('user_id',user.id).maybeSingle()
 status.value=r.data?.status||''
 if(status.value==='approved')await navigateTo('/student')
})
async function authHeaders(){
 const {data:{session}}=await db.auth.getSession()
 if(!session?.access_token)throw new Error('Sign in again to continue')
 return {Authorization:`Bearer ${session.access_token}`}
}
async function sendCode(){
 error.value='';notice.value='';busy.value=true
 try{
  const result=await $fetch<{message:string}>('/api/student/verification/start',{method:'POST',headers:await authHeaders()})
  sent.value=true;notice.value=result.message
 }catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to send code'}finally{busy.value=false}
}
async function verify(){
 error.value='';notice.value='';busy.value=true
 try{
  await $fetch('/api/student/verification/confirm',{method:'POST',headers:await authHeaders(),body:{code:code.value}})
  await navigateTo('/student')
 }catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Verification failed'}finally{busy.value=false}
}
async function requestManual(){
 error.value='';notice.value='';busy.value=true
 const r=await db.rpc('submit_student_account_request',{p_given_name:given.value.trim(),p_family_name:family.value.trim()})
 busy.value=false
 if(r.error){error.value=r.error.message;return}
 status.value=r.data||'pending'
}
</script>
<template>
<div class="page"><div class="shell admin-section"><NuxtLink to="/dashboard">← Dashboard</NuxtLink>
<div class="auth"><h1>Student Email Verification</h1>
<p>Use your existing school email account to verify your identity. We will match it to the email imported in your school's student records. No date of birth is sent by email.</p>
<p v-if="status==='pending'" class="notice">Your existing manual access request is awaiting school approval. You can still verify by email below.</p>
<p v-if="status==='rejected'" class="notice">Your previous request was declined. Contact your school if your student record needs correction.</p>
<p v-if="error" class="error" role="alert">{{error}}</p>
<p v-if="notice" class="notice">{{notice}}</p>
<form v-if="!sent" @submit.prevent="sendCode"><button class="btn" type="submit" :disabled="busy">{{busy?'Sending…':'Send verification code to my school email'}}</button></form>
<form v-else @submit.prevent="verify"><label class="field"><span>Six-digit verification code</span><input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required /></label><button class="btn" type="submit" :disabled="busy">{{busy?'Verifying…':'Verify and open my events'}}</button><button class="secondary" type="button" :disabled="busy" @click="sendCode">Send another code</button></form>
<details style="margin-top:1.5rem"><summary>My school email is not matched — request manual assistance</summary><form @submit.prevent="requestManual"><label class="field"><span>First name</span><input v-model="given" required maxlength="100" /></label><label class="field"><span>Last name</span><input v-model="family" required maxlength="100" /></label><button class="btn" type="submit" :disabled="busy">Request school review</button></form></details>
</div></div></div>
</template>
