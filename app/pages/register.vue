<script setup lang="ts">
type EventRow={event_id:string;event_name:string;competition_name:string;age_group:string|null;division:string|null;starts_on:string|null;registered:boolean;registration_open:boolean}
const email=ref(''),code=ref(''),session=ref(''),step=ref<'email'|'code'|'events'>('email')
const busy=ref(false),error=ref(''),notice=ref(''),events=ref<EventRow[]>([]),saving=ref('')
const grouped=computed(()=>Object.entries(events.value.reduce((acc:Record<string,EventRow[]>,e)=>{(acc[e.competition_name] ||= []).push(e);return acc},{} as Record<string,EventRow[]>)))
async function requestCode(){
 busy.value=true;error.value='';notice.value=''
 try{const result=await $fetch<{message:string}>('/api/public-registration/start',{method:'POST',body:{email:email.value}})
 notice.value=result.message;step.value='code'}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to request a code'}
 finally{busy.value=false}
}
async function verify(){
 busy.value=true;error.value=''
 try{const result=await $fetch<{session:string}>('/api/public-registration/verify',{method:'POST',body:{email:email.value,code:code.value}})
 session.value=result.session;step.value='events';await load()}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Verification failed'}
 finally{busy.value=false}
}
async function load(){
 try{events.value=await $fetch<EventRow[]>('/api/public-registration/events',{headers:{Authorization:`Bearer ${session.value}`}})}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to load events'}
}
async function toggle(e:EventRow){
 saving.value=e.event_id;error.value='';notice.value=''
 try{
  await $fetch('/api/public-registration/toggle',{method:'POST',headers:{Authorization:`Bearer ${session.value}`},body:{eventId:e.event_id,register:!e.registered}})
  notice.value=e.registered?'Registration withdrawn.':'Registration confirmed.'
  await load()
 }catch(x:any){error.value=x?.data?.statusMessage||x?.message||'Unable to save registration'}
 finally{saving.value=''}
}
function restart(){session.value='';code.value='';events.value=[];step.value='email';error.value='';notice.value=''}
</script>
<template>
 <div class="page"><div class="shell admin-section" style="max-width:860px;margin:2rem auto">
  <header class="top"><NuxtLink class="brand" to="/"><img src="/logo.png" alt="School Sports Tracker"><div><strong>SCHOOL SPORTS TRACKER</strong><small>STUDENT EVENT REGISTRATION</small></div></NuxtLink></header>
  <div class="card" style="margin-top:2rem;padding:2rem">
   <h1>Student Sports Registration</h1>
   <p>Register for school sports events using your school email. No account or password is needed.</p>
   <p v-if="error" class="error" role="alert">{{error}}</p>
   <p v-if="notice" class="success" role="status">{{notice}}</p>
   <form v-if="step==='email'" @submit.prevent="requestCode">
    <label class="field"><span>School email address</span><input v-model.trim="email" type="email" autocomplete="email" maxlength="254" required placeholder="student@school.edu.au"></label>
    <button class="btn" :disabled="busy">{{busy?'Sending…':'Send verification code'}}</button>
   </form>
   <form v-else-if="step==='code'" @submit.prevent="verify">
    <p>Enter the six-digit code sent to <strong>{{email}}</strong>. It expires after 10 minutes.</p>
    <label class="field"><span>Verification code</span><input v-model.trim="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label>
    <button class="btn" :disabled="busy">{{busy?'Verifying…':'Verify and view events'}}</button>
    <button class="secondary" type="button" style="margin-left:1rem" @click="restart">Change email</button>
   </form>
   <template v-else>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><h2>My Events</h2><button class="secondary" @click="restart">Finish / use another email</button></div>
    <p>Only events matching your school, year level and sporting-age eligibility are displayed. Your verification expires after 30 minutes.</p>
    <p v-if="!events.length" class="notice">No eligible individual events are currently available. Ask your school to check registration dates, age eligibility and your imported student details.</p>
    <section v-for="[competition,items] in grouped" :key="competition" class="card" style="margin-top:1rem;padding:1rem">
     <h3>{{competition}}</h3>
     <div v-for="e in items" :key="e.event_id" class="data-row">
      <div><strong>{{e.event_name}}</strong><p>{{e.age_group||'All ages'}} · {{e.division||'Open'}} · {{e.starts_on||'Date TBA'}}</p></div>
      <button class="btn" :disabled="saving===e.event_id||!e.registration_open" @click="toggle(e)">
       {{saving===e.event_id?'Saving…':e.registered?'Withdraw':'Register'}}
      </button>
      <small v-if="!e.registration_open">Registration closed</small>
     </div>
    </section>
   </template>
  </div>
 </div></div>
</template>
