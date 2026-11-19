<script setup lang="ts">
type EventRow={event_id:string;event_name:string;competition_name:string;age_group:string|null;division:string|null;starts_on:string|null;registered:boolean;registration_open:boolean}
type CompetitionRow={id:string;name:string;starts_on:string|null;registration_opens_at:string|null;registration_closes_at:string|null}
function registrationState(c:CompetitionRow){
 const start=c.registration_opens_at?Date.parse(c.registration_opens_at):NaN
 const end=c.registration_closes_at?Date.parse(c.registration_closes_at):NaN
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 'Dates Not Configured'
 const now=Date.now()
 return now<start?'Not Yet Open':now>=end?'Registration Closed':'Registration Open'
}
function registrationDetail(c:CompetitionRow){
 const state=registrationState(c)
 const value=state==='Not Yet Open'?c.registration_opens_at:state==='Registration Closed'?c.registration_closes_at:null
 if(!value)return ''
 return `${state==='Not Yet Open'?'Opens':'Closed'} ${new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Melbourne'}).format(new Date(value))}`
}
const selectedCompetition=computed(()=>competitions.value.find(c=>c.id===competitionId.value))
const registrationIsOpen=computed(()=>selectedCompetition.value?registrationState(selectedCompetition.value)==='Registration Open':false)
const email=ref(''),code=ref(''),session=ref(''),competitionId=ref(''),competitions=ref<CompetitionRow[]>([]),step=ref<'email'|'code'|'events'>('email')
const busy=ref(false),error=ref(''),notice=ref(''),events=ref<EventRow[]>([]),saving=ref('')
const discovering=ref(false),lookupDone=ref(false),lookupEmail=ref('')
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
 // Competition discovery happens only after a school email is entered.
})
onUnmounted(()=>{if(expiryInterval)clearInterval(expiryInterval)})
const grouped=computed(()=>Object.entries(events.value.reduce((acc:Record<string,EventRow[]>,e)=>{(acc[e.competition_name] ||= []).push(e);return acc},{} as Record<string,EventRow[]>)))
watch(email,()=>{if(step.value==='email'){competitions.value=[];competitionId.value='';lookupDone.value=false;lookupEmail.value=''}})
async function findCompetitions(){
 error.value='';notice.value='';competitionId.value='';competitions.value=[];lookupDone.value=false
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)){error.value='Enter your school email address first.';return}
 discovering.value=true
 try{
  competitions.value=await $fetch('/api/public-registration/competitions',{query:{email:email.value}})
  lookupDone.value=true;lookupEmail.value=email.value.trim().toLowerCase()
  if(competitions.value.length===1)competitionId.value=competitions.value[0].id
 }catch(e:any){error.value=e?.data?.statusMessage||'Unable to find competitions for this school'}
 finally{discovering.value=false}
}
async function requestCode(){
 if(!registrationIsOpen.value){error.value='Registration is not currently open for this competition.';return}
 if(!competitionId.value||lookupEmail.value!==email.value.trim().toLowerCase()||!competitions.value.some(c=>c.id===competitionId.value)){
  error.value='Find and select a competition for your school first.';return
 }
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
    <label class="field"><span>School email address</span><input v-model.trim="email" type="email" autocomplete="email" maxlength="254" required placeholder="student@school.edu.au"></label>
    <button class="secondary" type="button" :disabled="discovering||!email" @click="findCompetitions">{{discovering?'Finding competitions…':'Find my school competitions'}}</button>
    <template v-if="lookupDone">
     <label v-if="competitions.length" class="field" style="margin-top:1rem"><span>Competitions available to your school</span><select v-model="competitionId" required><option value="" disabled>Select a competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} — {{registrationState(c)}}</option></select></label>
     <p v-else role="status">No eligible competitions were found for this school's email domain. Check your school email address or contact your school.</p>
    </template>
    <div v-if="selectedCompetition" style="margin-top:1rem">
     <p><strong>{{registrationState(selectedCompetition)}}</strong><span v-if="registrationDetail(selectedCompetition)"> — {{registrationDetail(selectedCompetition)}}</span></p>
    </div>
    <div v-if="competitionId" style="margin-top:1rem"><button class="btn" :disabled="busy||discovering||!registrationIsOpen">{{busy?'Sending…':'Send verification code'}}</button></div>
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
      <button v-if="e.registration_open" class="btn" :disabled="saving===e.event_id" @click="toggle(e)">
       {{saving===e.event_id?'Saving…':e.registered?'Withdraw':'Register'}}
      </button>
      <small v-if="!e.registration_open">Registration closed</small>
     </div>
    </section>
   </template>
  </div>
 </div></div>
</template>
