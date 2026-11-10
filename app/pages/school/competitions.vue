<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const loading = ref(true), saving = ref(false), error = ref(''), notice = ref('')
const schoolName = ref(''), canEdit = ref(false)
const sports = ref<any[]>([]), definitions = ref<any[]>([]), competitions = ref<any[]>([]), events = ref<any[]>([])
const selected = ref('')
const blank = () => ({ name:'', sport_id:'', school_year:new Date().getFullYear(), starts_on:'' })
const form = ref(blank())
const editForm = ref({name:'',starts_on:'',status:'draft'})
const eventForm = ref({event_definition_id:'',age_group:'',division:'',is_team:false})
const selectedCompetition = computed(() => competitions.value.find(c => c.id === selected.value))
const eligibleDefinitions = computed(() => definitions.value.filter(d => d.sport_id === selectedCompetition.value?.sport_id))
const selectedEvents = computed(() => events.value.filter(e => e.competition_id === selected.value))
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
    if(!member.data || !['school_admin','teacher'].includes(member.data.role)) throw new Error('You do not have access to this school.')
    canEdit.value=member.data.role==='school_admin'
    schoolName.value=(member.data.schools as any)?.name || 'School'
    const [sp,defs,owned,joined]=await Promise.all([
      db.from('sports').select('id,name').order('name'),
      db.from('event_definitions').select('id,sport_id,name,measurement').order('name'),
      db.from('competitions').select('id,name,sport_id,school_year,starts_on,status,competition_type,organiser_school_id').eq('organiser_school_id',schoolId.value).order('created_at',{ascending:false}).limit(200),
      db.from('competition_schools').select('competition_id,competitions(id,name,sport_id,school_year,starts_on,status,competition_type,organiser_school_id)').eq('school_id',schoolId.value).limit(200)
    ])
    const failure=[sp,defs,owned,joined].find(x=>x.error)?.error
    if(failure) throw failure
    sports.value=sp.data||[]; definitions.value=defs.data||[]
    const map=new Map<string,any>()
    for(const c of owned.data||[]) map.set(c.id,c)
    for(const r of joined.data||[]) {const c:any=r.competitions;if(c&&!Array.isArray(c)) map.set(c.id,c)}
    competitions.value=[...map.values()]
    if(!competitions.value.some(c=>c.id===selected.value)) selected.value=competitions.value[0]?.id||''
    await loadEvents()
  } catch(e:any) {error.value=e.message||'Unable to load competitions'}
  finally {loading.value=false}
}
async function loadEvents() {
  events.value=[]
  if(!selected.value)return
  const r=await db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team').eq('competition_id',selected.value).limit(500)
  if(r.error) throw r.error
  events.value=r.data||[]
}
watch(selected,async()=>{
  const c=selectedCompetition.value
  if(c) editForm.value={name:c.name,starts_on:c.starts_on||'',status:c.status}
  eventForm.value={event_definition_id:'',age_group:'',division:'',is_team:false}
  if(!loading.value) {try {await loadEvents()}catch(e:any){error.value=e.message}}
})
async function perform(work:()=>Promise<any>,success:string) {
  if(saving.value)return
  saving.value=true;error.value='';notice.value=''
  try {const result=await work();if(result?.error)throw result.error;notice.value=success;await load()}
  catch(e:any){error.value=e.message||'Unable to save'}finally{saving.value=false}
}
function createCompetition(){
  if(!canEdit.value)return
  perform(()=>db.rpc('school_create_competition',{p_school:schoolId.value,p_name:form.value.name,p_sport:form.value.sport_id,p_year:Number(form.value.school_year),p_date:form.value.starts_on||null}).then(r=>{if(!r.error){selected.value=r.data;form.value=blank()}return r}),'Competition created.')
}
function updateCompetition(){
  if(!canEdit.value||!selected.value)return
  perform(()=>db.rpc('school_update_competition',{p_school:schoolId.value,p_comp:selected.value,p_name:editForm.value.name,p_date:editForm.value.starts_on||null,p_status:editForm.value.status}),'Competition updated.')
}
function addEvent(){
  if(!canEdit.value||!selected.value)return
  perform(()=>db.rpc('school_add_competition_event',{p_school:schoolId.value,p_comp:selected.value,p_definition:eventForm.value.event_definition_id,p_age:eventForm.value.age_group||null,p_division:eventForm.value.division||null,p_team:eventForm.value.is_team}),'Event added.')
}
function removeEvent(id:string){
  if(!canEdit.value||!confirm('Remove this event? This is only allowed before rounds or entries exist.'))return
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
      <div v-if="canEdit" class="card" style="margin-bottom:1rem">
        <h2>Create School Competition</h2>
        <form class="form-grid" @submit.prevent="createCompetition">
          <label class="field"><span>Competition name</span><input v-model="form.name" required minlength="3" maxlength="120" placeholder="e.g. 2027 House Athletics" /></label>
          <label class="field"><span>Sport</span><select v-model="form.sport_id" required><option value="" disabled>Select sport</option><option v-for="s in sports" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
          <label class="field"><span>School year</span><input v-model.number="form.school_year" type="number" min="2000" max="2200" required /></label>
          <label class="field"><span>Competition date (optional)</span><input v-model="form.starts_on" type="date" /></label>
          <button class="btn primary" type="submit" :disabled="saving">{{saving?'Saving…':'Create Competition'}}</button>
        </form>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <h2>Competitions ({{competitions.length}})</h2>
        <p v-if="!competitions.length">No competitions associated with this school yet.</p>
        <label v-else class="field"><span>Choose competition</span><select v-model="selected"><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} · {{c.school_year}} · {{c.status}}</option></select></label>
      </div>
      <template v-if="selectedCompetition">
        <div class="card" style="margin-bottom:1rem">
          <h2>{{selectedCompetition.name}}</h2>
          <p>{{sportName(selectedCompetition.sport_id)}} · {{selectedCompetition.school_year}} · {{selectedCompetition.status}}</p>
          <p v-if="selectedCompetition.organiser_school_id!==schoolId || selectedCompetition.competition_type!=='intra_school'" class="notice">This competition is managed by its organiser. You can view its events but cannot edit it here.</p>
          <form v-else-if="canEdit" class="form-grid" @submit.prevent="updateCompetition">
            <label class="field"><span>Name</span><input v-model="editForm.name" required minlength="3" maxlength="120" /></label>
            <label class="field"><span>Date</span><input v-model="editForm.starts_on" type="date" /></label>
            <label class="field"><span>Status</span><select v-model="editForm.status"><option value="draft">Draft</option><option value="registration">Registration</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
            <button class="btn primary" type="submit" :disabled="saving">Save Changes</button>
          </form>
        </div>
        <div class="card">
          <h2>Events ({{selectedEvents.length}})</h2>
          <div v-for="ev in selectedEvents" :key="ev.id" class="data-row" style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div><strong>{{definitionName(ev.event_definition_id)}}</strong><div><small>{{ev.age_group||'All ages'}} · {{ev.division||'Open'}} · {{ev.is_team?'Team':'Individual'}}</small></div></div>
            <button v-if="canEdit && selectedCompetition.organiser_school_id===schoolId && selectedCompetition.competition_type==='intra_school'" class="btn" type="button" :disabled="saving" @click="removeEvent(ev.id)">Remove</button>
          </div>
          <p v-if="!selectedEvents.length">No events configured yet.</p>
          <form v-if="canEdit && selectedCompetition.organiser_school_id===schoolId && selectedCompetition.competition_type==='intra_school'" class="form-grid" style="margin-top:1rem" @submit.prevent="addEvent">
            <h3>Add Event</h3>
            <p v-if="!eligibleDefinitions.length">No event definitions exist for this sport. A platform administrator must add them to the event catalogue.</p>
            <label class="field"><span>Event</span><select v-model="eventForm.event_definition_id" required><option value="" disabled>Select event</option><option v-for="d in eligibleDefinitions" :key="d.id" :value="d.id">{{d.name}} ({{d.measurement}})</option></select></label>
            <label class="field"><span>Age group (optional)</span><input v-model="eventForm.age_group" maxlength="60" placeholder="e.g. Under 14" /></label>
            <label class="field"><span>Division (optional)</span><input v-model="eventForm.division" maxlength="60" placeholder="e.g. Girls" /></label>
            <label><input v-model="eventForm.is_team" type="checkbox" /> Team event</label>
            <button class="btn primary" type="submit" :disabled="saving || !eligibleDefinitions.length">Add Event</button>
          </form>
        </div>
      </template>
    </template>
  </div></div>
</template>
