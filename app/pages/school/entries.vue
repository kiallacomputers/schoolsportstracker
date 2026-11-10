<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const busy = ref(true), saving = ref(false), error = ref(''), notice = ref('')
const schoolName = ref('School'), canEdit = ref(false)
const competitions = ref<any[]>([]), events = ref<any[]>([]), definitions = ref<any[]>([])
const students = ref<any[]>([]), enrolments = ref<any[]>([]), houses = ref<any[]>([])
const entries = ref<any[]>([]), participants = ref<any[]>([])
const competitionId = ref(''), eventId = ref(''), studentId = ref(''), search = ref('')
const competition = computed(() => competitions.value.find(c => c.id === competitionId.value))
const event = computed(() => events.value.find(e => e.id === eventId.value))
const selectedEvents = computed(() => events.value.filter(e => e.competition_id === competitionId.value))
const eligibleStudents = computed(() => students.value.filter(s => enrolments.value.some(e => e.student_id === s.id && e.school_year === competition.value?.school_year) && `${s.given_name} ${s.family_name} ${s.student_number}`.toLowerCase().includes(search.value.toLowerCase())))
const studentName = (id:string) => { const s=students.value.find(x=>x.id===id); return s ? `${s.given_name} ${s.family_name} (${s.student_number})` : 'Student' }
const eventName = (id:string) => definitions.value.find(d=>d.id===id)?.name || 'Event'
const houseName = (id:string|null) => houses.value.find(h=>h.id===id)?.name || 'Unassigned'
const selectedEntries = computed(() => entries.value.filter(e=>e.competition_event_id===eventId.value).map(e=>({...e, student_id:participants.value.find(p=>p.entry_id===e.id)?.student_id})))
async function load() {
 busy.value=true; error.value=''
 try {
  const {data:{user}}=await db.auth.getUser()
  if(!user){await navigateTo('/login');return}
  if(!schoolId.value) throw new Error('Select your school from the School Dashboard.')
  const member=await db.from('school_memberships').select('role,schools(name)').eq('user_id',user.id).eq('school_id',schoolId.value).maybeSingle()
  if(member.error)throw member.error
  if(!member.data || !['school_admin','teacher'].includes(member.data.role))throw new Error('You do not have access to this school.')
  canEdit.value=member.data.role==='school_admin'
  schoolName.value=(member.data.schools as any)?.name||'School'
  const [c,d,s,h]=await Promise.all([
   db.from('competitions').select('id,name,school_year,status').eq('organiser_school_id',schoolId.value).eq('competition_type','intra_school').order('school_year',{ascending:false}),
   db.from('event_definitions').select('id,name'),
   db.from('students').select('id,student_number,given_name,family_name').eq('school_id',schoolId.value).order('family_name').limit(3000),
   db.from('school_houses').select('id,name').eq('school_id',schoolId.value)
  ])
  for(const r of [c,d,s,h])if(r.error)throw r.error
  competitions.value=c.data||[];definitions.value=d.data||[];students.value=s.data||[];houses.value=h.data||[]
  if(!competitions.value.some(x=>x.id===competitionId.value))competitionId.value=competitions.value[0]?.id||''
  await loadCompetition()
 }catch(e:any){error.value=e.message||'Unable to load registrations.'}
 finally{busy.value=false}
}
async function loadCompetition(){
 events.value=[];enrolments.value=[];entries.value=[];participants.value=[]
 if(!competitionId.value)return
 const c=competition.value
 const [ev,en]=await Promise.all([
  db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team').eq('competition_id',competitionId.value),
  db.from('student_enrolments').select('student_id,school_year,house_id').eq('school_id',schoolId.value).eq('school_year',c.school_year).limit(3000)
 ])
 if(ev.error)throw ev.error;if(en.error)throw en.error
 events.value=ev.data||[];enrolments.value=en.data||[]
 if(!events.value.some(e=>e.id===eventId.value))eventId.value=events.value.find(e=>!e.is_team)?.id||''
 await loadEntries()
}
async function loadEntries(){
 entries.value=[];participants.value=[]
 if(!eventId.value)return
 const r=await db.from('event_entries').select('id,competition_event_id,house_id').eq('competition_event_id',eventId.value).eq('school_id',schoolId.value).limit(3000)
 if(r.error)throw r.error
 entries.value=r.data||[]
 if(entries.value.length){
  const p=await db.from('entry_participants').select('entry_id,student_id').in('entry_id',entries.value.map(x=>x.id))
  if(p.error)throw p.error
  participants.value=p.data||[]
 }
}
watch(competitionId,async()=>{if(!busy.value){error.value='';try{await loadCompetition()}catch(e:any){error.value=e.message}}})
watch(eventId,async()=>{studentId.value='';if(!busy.value){error.value='';try{await loadEntries()}catch(e:any){error.value=e.message}}})
async function register(){
 if(!canEdit.value||saving.value||!studentId.value||!eventId.value)return
 saving.value=true;error.value='';notice.value=''
 try{
  const r=await db.rpc('school_register_student_event',{p_school:schoolId.value,p_event:eventId.value,p_student:studentId.value})
  if(r.error)throw r.error
  notice.value='Student registered successfully.';studentId.value='';await loadEntries()
 }catch(e:any){error.value=e.message||'Unable to register student.'}finally{saving.value=false}
}
async function removeEntry(id:string){
 if(!canEdit.value||saving.value||!confirm('Remove this student registration?'))return
 saving.value=true;error.value='';notice.value=''
 try{
  const r=await db.rpc('school_remove_student_event_entry',{p_school:schoolId.value,p_entry:id})
  if(r.error)throw r.error
  notice.value='Registration removed.';await loadEntries()
 }catch(e:any){error.value=e.message||'Unable to remove registration.'}finally{saving.value=false}
}
onMounted(load)
</script>
<template>
 <div class="page"><div class="shell admin-section">
  <NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink>
  <h1>{{schoolName}} — Event Registrations</h1>
  <p class="notice">Register enrolled students for individual events. Age groups and divisions are displayed for staff to verify; automatic age and division eligibility checks are not yet configured.</p>
  <p v-if="busy">Loading registrations…</p>
  <p v-if="error" class="error" role="alert">{{error}}</p>
  <p v-if="notice" class="notice" role="status">{{notice}}</p>
  <template v-if="!busy">
   <div class="card" style="margin-bottom:1rem">
    <label class="field"><span>Competition</span><select v-model="competitionId"><option value="">Select competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} ({{c.school_year}}) — {{c.status}}</option></select></label>
    <label class="field"><span>Event</span><select v-model="eventId"><option value="">Select event</option><option v-for="e in selectedEvents" :key="e.id" :value="e.id">{{eventName(e.event_definition_id)}} · {{e.age_group||'All ages'}} · {{e.division||'Open'}} {{e.is_team?'(Team — coming later)':''}}</option></select></label>
   </div>
   <div v-if="event" class="card" style="margin-bottom:1rem">
    <h2>{{eventName(event.event_definition_id)}} — Entries ({{selectedEntries.length}})</h2>
    <p v-if="event.is_team" class="notice">Team and relay registration will be added in a later phase.</p>
    <p v-else-if="competition?.status!=='registration'" class="notice">Registration is closed. A School Administrator can change the competition status to Registration in Sports &amp; Events.</p>
    <form v-if="canEdit && !event.is_team && competition?.status==='registration'" class="form-grid" @submit.prevent="register">
     <label class="field"><span>Find student</span><input v-model="search" placeholder="Search by name or student number" /></label>
     <label class="field"><span>Student (enrolled for {{competition?.school_year}})</span><select v-model="studentId" required><option value="">Select student</option><option v-for="s in eligibleStudents" :key="s.id" :value="s.id">{{studentName(s.id)}} · {{houseName(enrolments.find(e=>e.student_id===s.id)?.house_id)}}</option></select></label>
     <button class="btn primary" type="submit" :disabled="saving || !studentId">{{saving?'Registering…':'Register Student'}}</button>
    </form>
    <p v-if="!selectedEntries.length">No registrations yet.</p>
    <div v-for="entry in selectedEntries" :key="entry.id" class="data-row" style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
     <div><strong>{{studentName(entry.student_id)}}</strong><div><small>{{houseName(entry.house_id)}}</small></div></div>
     <button v-if="canEdit && competition?.status==='registration' && !event.is_team" class="btn" type="button" :disabled="saving" @click="removeEntry(entry.id)">Remove</button>
    </div>
   </div>
  </template>
 </div></div>
</template>
