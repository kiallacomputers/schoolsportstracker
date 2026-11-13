<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const loading = ref(true), saving = ref(false), error = ref(''), notice = ref('')
const schoolName = ref(''), canEdit = ref(false), isSuperAdmin = ref(false), showAllCompetitions = ref(false)
const sports = ref<any[]>([]), definitions = ref<any[]>([]), competitions = ref<any[]>([]), events = ref<any[]>([])
const selected = ref('')
const blank = () => ({ name:'', sport_id:'', school_year:new Date().getFullYear(), starts_on:'' })
const form = ref(blank())
const editForm = ref({name:'',starts_on:'',status:'draft'})
const windowForm = ref({opens:'',closes:''})
const windowSaving = ref(false)
const cutoffForm = ref({mode:'calendar_year',custom:''})
const cutoffSaving = ref(false)
const eventForm = ref({event_definition_id:'',age_group:'',division:'',is_team:false})
const ageEdit = ref<Record<string,{min:string,max:string}>>({})
const ageSaving = ref('')
const capacityEdit=ref<Record<string,string>>({})
const capacitySaving=ref('')
const competitionLimit=ref('')
const limitSaving=ref(false)

const actionModal = ref(false)
const actionKind = ref('')
function dismissAction(){
  actionModal.value=false
  if(typeof route.query.action==='string')navigateTo({path:route.path,query:{...route.query,action:undefined},replace:true})
}
watch(()=>route.query.action,(action)=>{
  if(typeof action==='string' && ['add','event'].includes(action)){actionKind.value=action;actionModal.value=true}
},{immediate:true})
const selectedCompetition = computed(() => competitions.value.find(c => c.id === selected.value))
watch(selectedCompetition,(c)=>{competitionLimit.value=c?.max_events_per_student==null?'':String(c.max_events_per_student)},{immediate:true})
const visibleCompetitions = computed(() => isSuperAdmin.value && showAllCompetitions.value ? competitions.value : competitions.value.filter(c => c.organiser_school_id === schoolId.value || c.joinedSchool === true))
const eligibleDefinitions = computed(() => definitions.value.filter(d => d.sport_id === selectedCompetition.value?.sport_id))
const selectedEvents = computed(() => events.value.filter(e => e.competition_id === selected.value))
const registrationReadiness = computed(() => {
  const c = selectedCompetition.value
  if (!c) return { label: 'No competition selected', items: [] as string[] }
  const items: string[] = []
  if (!selectedEvents.value.length) items.push('Add at least one event')
  if(c.age_cutoff_mode==='competition_date' && !c.starts_on)items.push('Set a competition date for the age cutoff')
  if(c.age_cutoff_mode==='custom' && !c.age_cutoff_date)items.push('Set the custom age cutoff date')
  if (!c.registration_opens_at || !c.registration_closes_at) items.push('Set both registration opening and closing dates')
  if (c.status !== 'registration') items.push('Change competition status to Registration when ready')
  if (c.registration_closes_at && new Date(c.registration_closes_at).getTime() <= Date.now()) items.push('Registration closing date has passed')
  if (c.registration_opens_at && c.registration_closes_at && new Date(c.registration_opens_at).getTime() > new Date(c.registration_closes_at).getTime()) items.push('Correct registration dates')
  return { label: items.length ? 'Setup incomplete' : 'Configuration ready', items }
})

const canEditSelected = computed(() => canEdit.value && selectedCompetition.value?.organiser_school_id === schoolId.value && selectedCompetition.value?.competition_type === 'intra_school')
const cutoffDescription = computed(() => {
 const c=selectedCompetition.value
 if(!c)return ''
 const date=c.age_cutoff_mode==='competition_date' ? c.starts_on :
   c.age_cutoff_mode==='custom' ? c.age_cutoff_date : `${c.school_year}-12-31`
 return date ? `Sporting age is calculated on ${date}.` : 'Set a competition date or choose another cutoff.'
})
const windowValid = computed(() => !windowForm.value.opens || !windowForm.value.closes || windowForm.value.opens <= windowForm.value.closes)
const definitionName = (id:string) => definitions.value.find(d => d.id === id)?.name || 'Event'
const sportName = (id:string) => sports.value.find(s => s.id === id)?.name || 'Sport'
async function load() {
  error.value=''; loading.value=true
  try {
    const {data:{user}}=await db.auth.getUser()
    if(!user){await navigateTo('/login?redirect=%2Fschool%2Fdashboard');return}
    if(!schoolId.value) throw new Error('Select a school from the School Dashboard.')
    const member=await db.from('school_memberships').select('role,schools(name)').eq('school_id',schoolId.value).eq('user_id',user.id).maybeSingle()
    if(member.error) throw member.error
    const platform=await db.rpc('is_platform_admin')
    if(platform.error)throw platform.error
    if(!platform.data && (!member.data || !['school_admin','teacher'].includes(member.data.role))) throw new Error('You do not have access to this school.')
    isSuperAdmin.value=platform.data===true
    canEdit.value=isSuperAdmin.value || member.data?.role==='school_admin'
    if (isSuperAdmin.value) {
      const school = await db.from('schools').select('name').eq('id',schoolId.value).single()
      if (school.error) throw school.error
      schoolName.value=school.data.name
    } else schoolName.value=(member.data?.schools as any)?.name || 'School'
    const [sp,defs,owned,joined]=await Promise.all([
      db.from('sports').select('id,name').order('name'),
      db.from('event_definitions').select('id,sport_id,name,measurement').order('name'),
      db.from('competitions').select('id,name,sport_id,school_year,starts_on,status,competition_type,organiser_school_id,registration_opens_at,registration_closes_at,age_cutoff_mode,age_cutoff_date,max_events_per_student').order('created_at',{ascending:false}).limit(1000),
      db.from('competition_schools').select('competition_id,competitions(id,name,sport_id,school_year,starts_on,status,competition_type,organiser_school_id)').eq('school_id',schoolId.value).limit(200)
    ])
    const failure=[sp,defs,owned,joined].find(x=>x.error)?.error
    if(failure) throw failure
    sports.value=sp.data||[]; definitions.value=defs.data||[]
    const map=new Map<string,any>()
    for(const c of owned.data||[]) if(isSuperAdmin.value || c.organiser_school_id===schoolId.value) map.set(c.id,c)
    for(const r of joined.data||[]) {const c:any=r.competitions;if(c&&!Array.isArray(c)) map.set(c.id,{...c,joinedSchool:true})}
    competitions.value=[...map.values()]
    if(!visibleCompetitions.value.some(c=>c.id===selected.value)) selected.value=visibleCompetitions.value[0]?.id||''
    await loadEvents()
  } catch(e:any) {error.value=e.message||'Unable to load competitions'}
  finally {loading.value=false}
}
async function loadEvents() {
  events.value=[]
  if(!selected.value)return
  const r=await db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team,min_age,max_age,max_participants').eq('competition_id',selected.value).limit(500)
  if(r.error) throw r.error
  events.value=r.data||[]
  ageEdit.value=Object.fromEntries(events.value.map((e:any)=>[e.id,{min:e.min_age==null?'':String(e.min_age),max:e.max_age==null?'':String(e.max_age)}]))
  capacityEdit.value=Object.fromEntries(events.value.map((e:any)=>[e.id,e.max_participants==null?'':String(e.max_participants)]))
}
watch(showAllCompetitions,()=>{if(!visibleCompetitions.value.some(c=>c.id===selected.value))selected.value=visibleCompetitions.value[0]?.id||''})
watch(()=>route.query.school,()=>load())
watch(selected,async()=>{
  const c=selectedCompetition.value
  if(c) {
    editForm.value={name:c.name,starts_on:c.starts_on||'',status:c.status}
    windowForm.value={opens:toLocalInput(c.registration_opens_at),closes:toLocalInput(c.registration_closes_at)}
    cutoffForm.value={mode:c.age_cutoff_mode||'calendar_year',custom:c.age_cutoff_date||''}
  }
  eventForm.value={event_definition_id:'',age_group:'',division:'',is_team:false}
  if(!loading.value) {try {await loadEvents()}catch(e:any){error.value=e.message}}
})
function toLocalInput(value:string|null|undefined) {
  if(!value)return ''
  const d=new Date(value)
  if(Number.isNaN(d.getTime()))return ''
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000)
  return local.toISOString().slice(0,16)
}
async function saveRegistrationWindow(){
  if(!canEditSelected.value || !selected.value || !windowValid.value || windowSaving.value)return
  windowSaving.value=true;error.value='';notice.value=''
  try {
    const {error:err}=await db.rpc('school_set_registration_window',{
      p_school:schoolId.value,p_comp:selected.value,
      p_opens:windowForm.value.opens?new Date(windowForm.value.opens).toISOString():null,
      p_closes:windowForm.value.closes?new Date(windowForm.value.closes).toISOString():null
    })
    if(err)throw err
    notice.value='Registration dates saved.'
    await load()
  }catch(e:any){error.value=e.message||'Unable to save registration dates'}
  finally{windowSaving.value=false}
}
async function saveAgeCutoff(){
 if(!canEditSelected.value || !selected.value || cutoffSaving.value)return
 if(cutoffForm.value.mode==='custom' && !cutoffForm.value.custom){error.value='Choose a custom cutoff date.';return}
 if(cutoffForm.value.mode==='competition_date' && !selectedCompetition.value?.starts_on){error.value='Set the competition date before selecting this cutoff.';return}
 cutoffSaving.value=true;error.value='';notice.value=''
 try{
  const {error:e}=await db.rpc('school_set_age_cutoff',{
   p_school:schoolId.value,p_comp:selected.value,
   p_mode:cutoffForm.value.mode,
   p_date:cutoffForm.value.mode==='custom'?cutoffForm.value.custom:null
  })
  if(e)throw e
  notice.value='Sporting age cutoff saved.'
  await load()
 }catch(e:any){error.value=e.message||'Unable to save age cutoff'}
 finally{cutoffSaving.value=false}
}
async function perform(work:()=>Promise<any>,success:string) {
  if(saving.value)return
  saving.value=true;error.value='';notice.value=''
  try {const result=await work();if(result?.error)throw result.error;notice.value=success;dismissAction();await load()}
  catch(e:any){error.value=e.message||'Unable to save'}finally{saving.value=false}
}
function createCompetition(){
  if(!canEdit.value)return
  perform(()=>db.rpc('school_create_competition',{p_school:schoolId.value,p_name:form.value.name,p_sport:form.value.sport_id,p_year:Number(form.value.school_year),p_date:form.value.starts_on||null}).then(r=>{if(!r.error){selected.value=r.data;form.value=blank()}return r}),'Competition created.')
}
function updateCompetition(){
  if(!canEditSelected.value||!selected.value)return
  perform(()=>db.rpc('school_update_competition',{p_school:schoolId.value,p_comp:selected.value,p_name:editForm.value.name,p_date:editForm.value.starts_on||null,p_status:editForm.value.status}),'Competition updated.')
}
function addEvent(){
  if(!canEditSelected.value||!selected.value)return
  perform(()=>db.rpc('school_add_competition_event',{p_school:schoolId.value,p_comp:selected.value,p_definition:eventForm.value.event_definition_id,p_age:eventForm.value.age_group||null,p_division:eventForm.value.division||null,p_team:eventForm.value.is_team}),'Event added.')
}
async function saveCompetitionLimit(){
 if(!canEditSelected.value||limitSaving.value)return
 const raw=competitionLimit.value.trim(), n=raw===''?null:Number(raw)
 if(n!==null&&(!Number.isInteger(n)||n<1||n>100)){error.value='Enter a whole number between 1 and 100, or leave blank for unlimited.';return}
 limitSaving.value=true;error.value='';notice.value=''
 try{const {error:e}=await db.rpc('school_set_competition_entry_limit',{p_school:schoolId.value,p_comp:selected.value,p_limit:n});if(e)throw e;notice.value='Competition entry limit saved.';await load()}
 catch(e:any){error.value=e.message||'Unable to save limit'}finally{limitSaving.value=false}
}
async function saveEventCapacity(ev:any){
 if(!canEditSelected.value||capacitySaving.value)return
 const raw=(capacityEdit.value[ev.id]||'').trim(),n=raw===''?null:Number(raw)
 if(n!==null&&(!Number.isInteger(n)||n<1||n>10000)){error.value='Enter a whole number between 1 and 10000, or leave blank for unlimited.';return}
 capacitySaving.value=ev.id;error.value='';notice.value=''
 try{const {error:e}=await db.rpc('school_set_event_capacity',{p_school:schoolId.value,p_event:ev.id,p_capacity:n});if(e)throw e;notice.value='Event capacity saved.';await load()}
 catch(e:any){error.value=e.message||'Unable to save event capacity'}finally{capacitySaving.value=''}
}
async function saveEventAge(ev:any){
  if(!canEditSelected.value || ageSaving.value)return
  const v=ageEdit.value[ev.id]
  const min=v.min===''?null:Number(v.min), max=v.max===''?null:Number(v.max)
  if((min!==null&&(!Number.isInteger(min)||min<3||min>30))||(max!==null&&(!Number.isInteger(max)||max<3||max>30))||(min!==null&&max!==null&&min>max)){
    error.value='Enter valid ages between 3 and 30, with minimum not exceeding maximum.';return
  }
  ageSaving.value=ev.id;error.value='';notice.value=''
  try{
    const {error:e}=await db.rpc('school_set_event_age_limits',{p_school:schoolId.value,p_event:ev.id,p_min:min,p_max:max})
    if(e)throw e
    notice.value='Event age eligibility saved.'
    await loadEvents()
  }catch(e:any){error.value=e.message||'Could not save age limits'}
  finally{ageSaving.value=''}
}
function removeEvent(id:string){
  if(!canEditSelected.value||!confirm('Remove this event? This is only allowed before rounds or entries exist.'))return
  perform(()=>db.rpc('school_remove_competition_event',{p_school:schoolId.value,p_event:id}),'Event removed.')
}
onMounted(load)
</script>
<template>
  <div class="page"><div class="shell admin-section">
    <NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink>
    <h1>{{schoolName}} — Sports & Events</h1>
    <p class="notice">Create and configure school competitions and their events. Results and student entries will be added in later phases.</p>
    <p v-if="loading">Loading competitions…</p>
    <p v-if="error" class="error" role="alert">{{error}}</p>
    <p v-if="notice" class="notice" role="status">{{notice}}</p>
    <template v-if="!loading && !error">
      <AdminActionModal :open="actionModal && actionKind==='add' && canEdit" title="Add Competition" @close="dismissAction"><div>
        <h2>Create School Competition</h2>
        <form class="form-grid" @submit.prevent="createCompetition">
          <label class="field"><span>Competition name</span><input v-model="form.name" required minlength="3" maxlength="120" placeholder="e.g. 2027 House Athletics" /></label>
          <label class="field"><span>Sport</span><select v-model="form.sport_id" required><option value="" disabled>Select sport</option><option v-for="s in sports" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
          <label class="field"><span>School year</span><input v-model.number="form.school_year" type="number" min="2000" max="2200" required /></label>
          <label class="field"><span>Competition date (optional)</span><input v-model="form.starts_on" type="date" /></label>
          <button class="btn primary" type="submit" :disabled="saving">{{saving?'Saving…':'Create Competition'}}</button>
        </form>
      </div></AdminActionModal>
      <div class="card" style="margin-bottom:1rem">
        <h2>Competitions ({{visibleCompetitions.length}})</h2>
        <label v-if="isSuperAdmin" class="field"><input v-model="showAllCompetitions" type="checkbox" /> Show competitions across all schools</label>
        <p v-if="!visibleCompetitions.length">No competitions associated with this school yet.</p>
        <label v-else class="field"><span>Choose competition</span><select v-model="selected"><option v-for="c in visibleCompetitions" :key="c.id" :value="c.id">{{c.name}} · {{c.school_year}} · {{c.status}}</option></select></label>
      </div>
      <template v-if="selectedCompetition">
        <div class="card" style="margin-bottom:1rem">
          <h2>{{selectedCompetition.name}}</h2>
          <NuxtLink v-if="isSuperAdmin && selectedCompetition.organiser_school_id !== schoolId" :to="{path:'/school/competitions',query:{school:selectedCompetition.organiser_school_id}}">Open organising school to manage this competition</NuxtLink>
          <p>{{sportName(selectedCompetition.sport_id)}} · {{selectedCompetition.school_year}} · {{selectedCompetition.status}}</p>
          <p v-if="selectedCompetition.organiser_school_id!==schoolId || selectedCompetition.competition_type!=='intra_school'" class="notice">This competition is managed by its organiser. You can view its events but cannot edit it here.</p>
          <form v-else-if="canEdit" class="form-grid" @submit.prevent="updateCompetition">
            <label class="field"><span>Name</span><input v-model="editForm.name" required minlength="3" maxlength="120" /></label>
            <label class="field"><span>Date</span><input v-model="editForm.starts_on" type="date" /></label>
            <label class="field"><span>Status</span><select v-model="editForm.status"><option value="draft">Draft</option><option value="registration">Registration</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
            <button class="btn primary" type="submit" :disabled="saving">Save Changes</button>
          </form>
        </div>
        <div class="card" style="margin-bottom:1rem">
          <h2>Registration Window</h2>
          <p class="notice">Configure the registration schedule. Enforcement in the registration functions is a separate step. Dates are saved in your browser's local time and stored in UTC.</p>
          <form v-if="canEditSelected" class="form-grid" @submit.prevent="saveRegistrationWindow">
            <label class="field"><span>Registrations open (optional)</span><input v-model="windowForm.opens" type="datetime-local" /></label>
            <label class="field"><span>Registrations close (optional)</span><input v-model="windowForm.closes" type="datetime-local" /></label>
            <p v-if="!windowValid" class="error" role="alert">The closing date must be after the opening date.</p>
            <button class="btn primary" type="submit" :disabled="windowSaving || !windowValid">{{windowSaving?'Saving…':'Save Registration Dates'}}</button>
          </form>
          <p v-else>{{selectedCompetition.registration_opens_at ? new Date(selectedCompetition.registration_opens_at).toLocaleString() : 'No opening date'}} — {{selectedCompetition.registration_closes_at ? new Date(selectedCompetition.registration_closes_at).toLocaleString() : 'No closing date'}}</p>
        </div>
        <div class="card" style="margin-bottom:1rem">
          <h2>Sporting Age Eligibility</h2>
          <p class="notice">Age is calculated from the student's imported date of birth. Choose the cutoff used by this competition. Under 14 means students younger than 14 on the cutoff date; other age labels require explicit rules before student registration opens.</p>
          <p><strong>{{cutoffDescription}}</strong></p>
          <form v-if="canEditSelected" class="form-grid" @submit.prevent="saveAgeCutoff">
            <label class="field"><span>Age calculated on</span><select v-model="cutoffForm.mode">
              <option value="calendar_year">31 December of competition year</option>
              <option value="competition_date">Competition date</option>
              <option value="custom">Custom date</option>
            </select></label>
            <label v-if="cutoffForm.mode==='custom'" class="field"><span>Custom cutoff date</span><input v-model="cutoffForm.custom" type="date" required /></label>
            <button class="btn primary" type="submit" :disabled="cutoffSaving">{{cutoffSaving?'Saving…':'Save Age Eligibility'}}</button>
          </form>
          <p class="notice">This sets the competition-wide rule. Student-facing filtering and server-side entry validation will use this cutoff in the registration phase.</p>
        </div>
        <div class="card" style="margin-bottom:1rem">
          <h2>Student Registration Limits</h2>
          <p class="notice">Limit how many individual events a student can enter in this competition. Leave blank for unlimited. Existing registrations are not deleted if you lower a limit.</p>
          <form v-if="canEditSelected" class="form-grid" @submit.prevent="saveCompetitionLimit">
            <label class="field"><span>Maximum individual events per student</span><input v-model="competitionLimit" type="number" min="1" max="100" placeholder="Unlimited" /></label>
            <button class="btn primary" type="submit" :disabled="limitSaving">{{limitSaving?'Saving…':'Save Entry Limit'}}</button>
          </form>
          <p v-else>Maximum events: {{selectedCompetition.max_events_per_student??'Unlimited'}}</p>
        </div>
        <div class="card" style="margin-bottom:1rem">
          <h2>Competition Setup Checklist</h2>
          <p><strong>{{ registrationReadiness.label }}</strong></p>
          <ul v-if="registrationReadiness.items.length">
            <li v-for="item in registrationReadiness.items" :key="item">{{ item }}</li>
          </ul>
          <p v-else>Event definitions, registration dates and competition status are configured.</p>
          <p class="notice">This checklist checks configuration only. Student self-registration and server-side registration enforcement will be built in Phase 4D.</p>
        </div>
        <div class="card">
          <h2>Events ({{selectedEvents.length}})</h2>
          <div v-for="ev in selectedEvents" :key="ev.id" class="data-row" style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div><strong>{{definitionName(ev.event_definition_id)}}</strong><div><small>{{ev.age_group||'All ages'}} · {{ev.division||'Open'}} · {{ev.is_team?'Team':'Individual'}}</small></div>
              <div v-if="canEditSelected && ageEdit[ev.id]" style="display:flex;gap:.5rem;align-items:end;flex-wrap:wrap;margin-top:.5rem">
                <label class="field"><span>Minimum age</span><input v-model="ageEdit[ev.id]!.min" type="number" min="3" max="30" placeholder="Any" style="max-width:7rem" /></label>
                <label class="field"><span>Maximum age</span><input v-model="ageEdit[ev.id]!.max" type="number" min="3" max="30" placeholder="Any" style="max-width:7rem" /></label>
                <button class="btn" :disabled="!!ageSaving" @click="saveEventAge(ev)">{{ageSaving===ev.id?'Saving…':'Save ages'}}</button>
              </div>
              <small v-else>Eligible ages: {{ev.min_age??'Any'}}–{{ev.max_age??'Any'}}</small>
              <div v-if="canEditSelected && !ev.is_team" style="display:flex;gap:.5rem;align-items:end;flex-wrap:wrap;margin-top:.5rem">
                <label class="field"><span>Maximum participants</span><input v-model="capacityEdit[ev.id]" type="number" min="1" max="10000" placeholder="Unlimited" style="max-width:9rem" /></label>
                <button class="btn" :disabled="!!capacitySaving" @click="saveEventCapacity(ev)">{{capacitySaving===ev.id?'Saving…':'Save Capacity'}}</button>
              </div>
              <small v-else-if="!ev.is_team">Capacity: {{ev.max_participants??'Unlimited'}}</small>
            </div>
            <button v-if="canEdit && selectedCompetition.organiser_school_id===schoolId && selectedCompetition.competition_type==='intra_school'" class="btn" type="button" :disabled="saving" @click="removeEvent(ev.id)">Remove</button>
          </div>
          <p v-if="!selectedEvents.length">No events configured yet.</p>
          <AdminActionModal :open="actionModal && actionKind==='event' && canEdit && selectedCompetition.organiser_school_id===schoolId && selectedCompetition.competition_type==='intra_school'" title="Add Event" @close="dismissAction"><form class="form-grid" @submit.prevent="addEvent">
            <h3>Add Event</h3>
            <p v-if="!eligibleDefinitions.length">No event definitions exist for this sport. A platform administrator must add them to the event catalogue.</p>
            <label class="field"><span>Event</span><select v-model="eventForm.event_definition_id" required><option value="" disabled>Select event</option><option v-for="d in eligibleDefinitions" :key="d.id" :value="d.id">{{d.name}} ({{d.measurement}})</option></select></label>
            <label class="field"><span>Age group (optional)</span><input v-model="eventForm.age_group" maxlength="60" placeholder="e.g. Under 14" /></label>
            <label class="field"><span>Division (optional)</span><input v-model="eventForm.division" maxlength="60" placeholder="e.g. Girls" /></label>
            <label><input v-model="eventForm.is_team" type="checkbox" /> Team event</label>
            <button class="btn primary" type="submit" :disabled="saving || !eligibleDefinitions.length">Add Event</button>
          </form></AdminActionModal>
        </div>
      </template>
    </template>
  </div></div>
</template>
