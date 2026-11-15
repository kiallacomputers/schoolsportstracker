<script setup lang="ts">
type EventRow={event_id:string;event_name:string;competition_name:string;age_group:string|null;division:string|null;starts_on:string|null;registered:boolean;registration_open:boolean}
const route=useRoute()
const competitionId=computed(()=>String(route.params.competition||''))
const email=ref(''),code=ref(''),session=ref('')
const stage=ref<'email'|'code'|'events'>('email')
const busy=ref(false),saving=ref(''),error=ref(''),notice=ref('')
const events=ref<EventRow[]>([])
const authHeaders=computed(()=>({Authorization:`Bearer ${session.value}`}))
async function requestCode(){
 busy.value=true;error.value='';notice.value=''
 try{const r=await $fetch<{message:string}>('/api/public-registration/start',{method:'POST',body:{competitionId:competitionId.value,email:email.value}});notice.value=r.message;stage.value='code'}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to send code'}finally{busy.value=false}
}
async function verify(){
 busy.value=true;error.value='';notice.value=''
 try{const r=await $fetch<{session:string}>('/api/public-registration/verify',{method:'POST',body:{competitionId:competitionId.value,email:email.value,code:code.value}});session.value=r.session;stage.value='events';await load();notice.value='Email verified. Choose your events.'}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to verify code'}finally{busy.value=false}
}
async function load(){
 try{events.value=await $fetch<EventRow[]>('/api/public-registration/events',{query:{competitionId:competitionId.value},headers:authHeaders.value})}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to load events';if([401,403].includes(e?.statusCode||e?.response?.status)){session.value='';stage.value='email'}}
}
async function toggle(row:EventRow){
 saving.value=row.event_id;error.value='';notice.value=''
 try{await $fetch('/api/public-registration/toggle',{method:'POST',headers:authHeaders.value,body:{competitionId:competitionId.value,eventId:row.event_id,register:!row.registered}});notice.value=row.registered?'Registration withdrawn.':'Registration confirmed.';await load()}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to update registration'}finally{saving.value=''}
}
</script>
<template><main class="page"><div class="shell" style="max-width:720px;margin:2rem auto">
<h1>Student Event Registration</h1><p>Register using your school email address. No account required.</p>
<p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
<form v-if="stage==='email'" class="card" @submit.prevent="requestCode"><label class="field">School email address<input v-model.trim="email" type="email" autocomplete="email" required /></label><button class="btn primary" :disabled="busy">{{busy?'Sending…':'Send verification code'}}</button></form>
<form v-else-if="stage==='code'" class="card" @submit.prevent="verify"><p>Enter the six-digit code sent to your school email.</p><label class="field">Verification code<input v-model.trim="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required /></label><button class="btn primary" :disabled="busy">{{busy?'Verifying…':'Verify email'}}</button><button class="btn" type="button" :disabled="busy" @click="requestCode">Resend code</button></form>
<div v-else class="card"><h2>Available events</h2><p v-if="!events.length">No eligible events found for this competition.</p>
<div v-for="row in events" :key="row.event_id" style="padding:1rem 0;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;gap:1rem;align-items:center">
<div><strong>{{row.event_name}}</strong><div>{{row.age_group||'All ages'}} · {{row.division||'Open'}}</div><small v-if="row.registered">Registered</small></div>
<button class="btn" type="button" :disabled="!row.registration_open||!!saving" @click="toggle(row)">{{saving===row.event_id?'Saving…':row.registered?'Withdraw':'Register'}}</button>
</div><button class="btn" type="button" :disabled="!!saving" @click="load">Refresh events</button></div>
</div></main></template>
