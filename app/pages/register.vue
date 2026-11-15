<script setup lang="ts">
type EventRow={event_id:string;event_name:string;competition_name:string;age_group:string|null;division:string|null;starts_on:string|null;registered:boolean;registration_open:boolean}
const email=ref(''),code=ref(''),session=ref(''),competitionId=ref(''),competitions=ref<{id:string;name:string;starts_on:string|null}[]>([]),step=ref<'email'|'code'|'events'>('email')
const busy=ref(false),error=ref(''),notice=ref(''),events=ref<EventRow[]>([]),saving=ref('')
const STORAGE_KEY='sst-student-registration-session-v1'
const expiresAt=ref(0)
const remaining=ref(0)
const remainingText=computed(()=>{const seconds=Math.ceil(remaining.value/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`})
function clearSession(){
 if(import.meta.client)sessionStorage.removeItem(STORAGE_KEY)
 session.value='';expiresAt.value=0;remaining.value=0;events.value=[]
}
function expireSession(){clearSession();step.value='email';code.value='';notice.value='Your 30-minute session has expired. Please verify your email again.'}
function updateExpiry(){
 if(!session.value)return
 remaining.value=Math.max(0,expiresAt.value-Date.now())
 if(remaining.value===0)expireSession()
}
async function restoreSession(){
 if(!import.meta.client)return
 const stored=sessionStorage.getItem(STORAGE_KEY)
 if(!stored)return
 try{
  const saved=JSON.parse(stored)
  if(typeof saved.token!=='string'||!/^[a-f0-9]{64}$/.test(saved.token)||typeof saved.competitionId!=='string'||typeof saved.expiresAt!=='number'||saved.expiresAt<=Date.now()){
   sessionStorage.removeItem(STORAGE_KEY);return
  }
  session.value=saved.token;competitionId.value=saved.competitionId;expiresAt.value=saved.expiresAt
  updateExpiry()
  if(!session.value)return
  await load()
  if(session.value)step.value='events'
 }catch{clearSession();step.value='email'}
}

let expiryInterval:ReturnType<typeof setInterval>|undefined
onMounted(async()=>{
 expiryInterval=setInterval(updateExpiry,1000)
 await restoreSession()
 try{competitions.value=await $fetch('/api/public-registration/competitions')}
 catch(e:any){if(!session.value)error.value=e?.data?.statusMessage||'Unable to load competitions'}
})
onUnmounted(()=>{if(expiryInterval)clearInterval(expiryInterval)})
const grouped=computed(()=>Object.entries(events.value.reduce((acc:Record<string,EventRow[]>,e)=>{(acc[e.competition_name] ||= []).push(e);return acc},{} as Record<string,EventRow[]>)))
async function requestCode(){
 busy.value=true;error.value='';notice.value=''
 try{const result=await $fetch<{message:string}>('/api/public-registration/start',{method:'POST',body:{email:email.value,competitionId:competitionId.value}})
 notice.value=result.message;step.value='code'}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to request a code'}
 finally{busy.value=false}
}
async function verify(){
 busy.value=true;error.value=''
 try{const result=await $fetch<{session:string}>('/api/public-registration/verify',{method:'POST',body:{email:email.value,code:code.value,competitionId:competitionId.value}})
 session.value=result.session
 expiresAt.value=Date.now()+30*60*1000
 remaining.value=30*60*1000
 if(import.meta.client)sessionStorage.setItem(STORAGE_KEY,JSON.stringify({token:result.session,competitionId:competitionId.value,expiresAt:expiresAt.value}))
 step.value='events';await load()}
 catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Verification failed'}
 finally{busy.value=false}
}
async function load(){
 try{events.value=await $fetch<EventRow[]>('/api/public-registration/events',{query:{competitionId:competitionId.value},headers:{Authorization:`Bearer ${session.value}`}})}
 catch(e:any){
  const status=e?.statusCode||e?.response?.status||e?.data?.statusCode
  if(status===401||status===403||/expired|verification/i.test(e?.data?.statusMessage||''))expireSession()
  else error.value=e?.data?.statusMessage||e?.message||'Unable to load events'
 }
}
async function toggle(e:EventRow){
 saving.value=e.event_id;error.value='';notice.value=''
 try{
  await $fetch('/api/public-registration/toggle',{method:'POST',headers:{Authorization:`Bearer ${session.value}`},body:{competitionId:competitionId.value,eventId:e.event_id,register:!e.registered}})
  notice.value=e.registered?'Registration withdrawn.':'Registration confirmed.'
  await load()
 }catch(x:any){error.value=x?.data?.statusMessage||x?.message||'Unable to save registration'}
 finally{saving.value=''}
}
function restart(){clearSession();code.value='';step.value='email';error.value='';notice.value=''}
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
    <label class="field"><span>Competition</span><select v-model="competitionId" required><option value="" disabled>Select a competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} — {{c.starts_on||'Date TBA'}}</option></select></label>
    <p v-if="!competitions.length">No competitions are currently open for registration.</p>
    <label class="field"><span>School email address</span><input v-model.trim="email" type="email" autocomplete="email" maxlength="254" required placeholder="student@school.edu.au"></label>
    <button class="btn" :disabled="busy||!competitionId">{{busy?'Sending…':'Send verification code'}}</button>
   </form>
   <form v-else-if="step==='code'" @submit.prevent="verify">
    <p>Enter the six-digit code sent to <strong>{{email}}</strong>. It expires after 10 minutes.</p>
    <label class="field"><span>Verification code</span><input v-model.trim="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label>
    <button class="btn" :disabled="busy">{{busy?'Verifying…':'Verify and view events'}}</button>
    <button class="secondary" type="button" style="margin-left:1rem" @click="restart">Change email</button>
   </form>
   <template v-else>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><h2>My Events</h2><button class="secondary" @click="restart">Finish / use another email</button></div>
    <p>Only events matching your school, year level and sporting-age eligibility are displayed. Session time remaining: <strong>{{remainingText}}</strong>. Refreshing this tab won't sign you out.</p>
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
