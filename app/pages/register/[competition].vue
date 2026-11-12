<script setup lang="ts">
const route=useRoute()
const email=ref(''),code=ref(''),stage=ref<'email'|'code'|'verified'>('email')
const busy=ref(false),error=ref(''),notice=ref(''),token=ref('')
const competitionId=computed(()=>String(route.params.competition||''))
async function requestCode(){
 busy.value=true;error.value='';notice.value=''
 try{const r=await $fetch<{message:string}>('/api/student-registration/request-code',{method:'POST',body:{competition_id:competitionId.value,email:email.value}});notice.value=r.message;stage.value='code'}
 catch(e:any){error.value=e.data?.statusMessage||e.message||'Unable to send code'}finally{busy.value=false}
}
async function verify(){
 busy.value=true;error.value=''
 try{const r=await $fetch<{token:string}>('/api/student-registration/verify-code',{method:'POST',body:{competition_id:competitionId.value,email:email.value,code:code.value}});token.value=r.token;stage.value='verified';notice.value='Email verified successfully.'}
 catch(e:any){error.value=e.data?.statusMessage||e.message||'Unable to verify code'}finally{busy.value=false}
}
</script>
<template><main class="page"><div class="shell" style="max-width:680px;margin:2rem auto">
<h1>Student Event Registration</h1><p>Register for your school sporting competition without creating an account.</p>
<p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
<form v-if="stage==='email'" class="card" @submit.prevent="requestCode"><label class="field">School email address<input v-model.trim="email" type="email" required autocomplete="email" /></label><button class="btn primary" :disabled="busy">{{busy?'Sending…':'Send verification code'}}</button></form>
<form v-else-if="stage==='code'" class="card" @submit.prevent="verify"><p>Enter the six-digit code sent to your school email.</p><label class="field">Verification code<input v-model.trim="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required /></label><button class="btn primary" :disabled="busy">{{busy?'Verifying…':'Verify email'}}</button><button class="btn" type="button" :disabled="busy" @click="requestCode">Send another code</button></form>
<div v-else class="card"><h2>Identity verified</h2><p>Your school email has been verified. Event selection and submission will be enabled in the next registration update.</p></div>
</div></main></template>
