<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const loading = ref(true), saving = ref(false), error = ref(''), notice = ref('')
const schoolName = ref(''), canEdit = ref(false), isSuperAdmin = ref(false), showAllCompetitions = ref(false)
const sports = ref<any[]>([]), definitions = ref<any[]>([]), competitions = ref<any[]>([]), events = ref<any[]>([])
const selected = ref('')
const activeTab = ref<'overview'|'events'|'registrations'|'eventday'|'results'|'settings'>('overview')
const entries = ref<any[]>([])
const roundsCount = ref<number|null>(null)
const resultCount = ref<number|null>(null)
const competitionEntries = computed(() => entries.value.filter(x => selectedEvents.value.some(e => e.id === x.event_id)))
const entryCountFor = (eventId:string) => entries.value.filter(x => x.event_id === eventId).length
const totalRegistrations = computed(() => competitionEntries.value.length)
const dateLabel = computed(() => selectedCompetition.value?.starts_on ? new Date(selectedCompetition.value.starts_on+'T12:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : 'Date not set')
const eventDayUrl = (eventId?:string) => ({path:'/school/race-day',query:{school:schoolId.value,competition:selected.value,...(eventId?{event:eventId}:{})}})
const mobileResultUrl = (eventId?:string) => ({path:'/school/mobile-results',query:{school:schoolId.value,competition:selected.value,...(eventId?{event:eventId}:{})}})
const registrationUrl = () => ({path:'/school/entries',query:{school:schoolId.value,competition:selected.value}})
const resultsUrl = () => ({path:'/school/results',query:{school:schoolId.value,competition:selected.value}})

const blank = () => ({ name:'', sport_id:'', school_year:new Date().getFullYear(), starts_on:'' })
const form = ref(blank())
const editForm = ref({name:'',starts_on:'',status:'draft'})
const windowForm = ref({opens:'',closes:''})
const windowSaving = ref(false)
const cutoffForm = ref({mode:'calendar_year',custom:''})
const cutoffSaving = ref(false)
const emptyEvent = () => ({event_definition_id:'',age_group:'',division:'',is_team:false,kind:'race',min_age:'',max_age:'',lanes:'8',heats:'3',qualification:'positions_plus_times',capacity:''})
const eventForm = ref(emptyEvent())
const newEventCapacity = computed(() => Number(eventForm.value.lanes)*Number(eventForm.value.heats))
const editingEvent = ref<any>(null)
const competitionLimit=ref('')
const limitSaving=ref(false)

const actionModal = ref(false)
const actionKind = ref('')
function closeEventModal(){editingEvent.value=null;eventForm.value=emptyEvent();dismissAction()}
function dismissAction(){
  actionModal.value=false
  if(typeof route.query.action==='string')navigateTo({path:route.path,query:{...route.query,action:undefined},replace:true})
}
watch(()=>route.query.action,(action)=>{
  if(typeof action==='string' && ['add','event'].includes(action)){if(action==='event'){editingEvent.value=null;eventForm.value=emptyEvent()}actionKind.value=action;actionModal.value=true}
},{immediate:true})
const selectedCompetition = computed(() => competitions.value.find(c => c.id === selected.value))
watch(selectedCompetition,(c)=>{competitionLimit.value=c?.max_events_per_student==null?'':String(c.max_events_per_student)},{immediate:true})
const visibleCompetitions = computed(() => isSuperAdmin.value && showAllCompetitions.value ? competitions.value : competitions.value.filter(c => c.organiser_school_id === schoolId.value || c.joinedSchool === true))
const eligibleDefinitions = computed(() => definitions.value.filter(d => d.sport_id === selectedCompetition.value?.sport_id))
const selectedEvents = computed(() => events.value.filter(e => e.competition_id === selected.value))
// Registration availability is derived from the stored UTC window, not just the manual competition status.
const registrationClock = ref(Date.now())
let registrationClockTimer: ReturnType<typeof setInterval> | undefined
if (import.meta.client) {
  onMounted(() => { registrationClock.value = Date.now(); registrationClockTimer = setInterval(() => { registrationClock.value = Date.now() }, 60000) })
  onBeforeUnmount(() => { if (registrationClockTimer) clearInterval(registrationClockTimer) })
}
const registrationWindowState = computed(() => {
  const c = selectedCompetition.value
  if (!c) return { code: 'unknown', label: 'No competition', detail: 'Select a competition.' }
  const start = c.registration_opens_at ? Date.parse(c.registration_opens_at) : NaN
  const end = c.registration_closes_at ? Date.parse(c.registration_closes_at) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { code: 'unconfigured', label: 'Dates not configured', detail: 'Set both registration dates in Settings.' }
  if (start >= end) return { code: 'invalid', label: 'Invalid registration dates', detail: 'Closing date must be after opening date.' }
  if (registrationClock.value < start) return { code: 'upcoming', label: 'Not yet open', detail: 'Registration opening date has not been reached.' }
  if (registrationClock.value >= end) return { code: 'closed', label: 'Registration closed', detail: 'The registration closing date has passed.' }
  return { code: 'open', label: 'Registration open', detail: 'Registration is within the configured window.' }
})
const registrationDateText = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not configured'
const registrationReadiness = computed(() => {
  const c = selectedCompetition.value
  if (!c) return { label: 'No competition selected', items: [] as string[] }
  const items: string[] = []
  if (!selectedEvents.value.length) items.push('Add at least one event')
  if(c.age_cutoff_mode==='competition_date' && !c.starts_on)items.push('Set a competition date for the age cutoff')
  if(c.age_cutoff_mode==='custom' && !c.age_cutoff_date)items.push('Set the custom age cutoff date')
  if (!c.registration_opens_at || !c.registration_closes_at) items.push('Set both registration opening and closing dates')
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
      db.from('competition_schools').select('competition_id,competitions(id,name,sport_id,school_year,starts_on,status,competition_type,organiser_school_id,registration_opens_at,registration_closes_at,age_cutoff_mode,age_cutoff_date,max_events_per_student)').eq('school_id',schoolId.value).limit(200)
    ])
    const failure=[sp,defs,owned,joined].find(x=>x.error)?.error
    if(failure) throw failure
    sports.value=sp.data||[]; definitions.value=defs.data||[]
    const map=new Map<string,any>()
    for(const c of owned.data||[]) if(isSuperAdmin.value || c.organiser_school_id===schoolId.value) map.set(c.id,c)
    for(const r of joined.data||[]) {const c:any=r.competitions;if(c&&!Array.isArray(c)) map.set(c.id,{...map.get(c.id),...c,joinedSchool:true})}
    competitions.value=[...map.values()]
    if(!visibleCompetitions.value.some(c=>c.id===selected.value)) selected.value=visibleCompetitions.value[0]?.id||''
    await loadEvents()
  } catch(e:any) {error.value=e.message||'Unable to load competitions'}
  finally {loading.value=false}
}
async function loadEvents() {
  events.value=[]
  if(!selected.value)return
  const r=await db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team,min_age,max_age,max_participants,race_lanes,race_max_heats,race_qualification').eq('competition_id',selected.value).limit(500)
  if(r.error) throw r.error
  events.value=r.data||[]
  await loadMetrics()
}
async function loadMetrics(){
  error.value=''
  entries.value=[]; roundsCount.value=null; resultCount.value=null
  const ids=events.value.map(e=>e.id)
  if(!ids.length){roundsCount.value=0;resultCount.value=0;return}
  // Canonical registration records use competition_event_id, not event_id.
  // A failed read must never be presented as a valid zero registration count.
  const entryRes=await db.from('event_entries')
    .select('id,competition_event_id').in('competition_event_id',ids).limit(10000)
  if(entryRes.error) throw new Error(`Unable to load registrations: ${entryRes.error.message}`)
  if((entryRes.data?.length??0)===10000) throw new Error('Registration count reached the 10,000-row safety limit. Contact the administrator for paginated totals.')
  entries.value=(entryRes.data||[]).map(row=>({id:row.id,event_id:row.competition_event_id}))

  // Use the same authorised RPC as the Event Day screen. Direct table reads
  // may fail because race data is exposed through SECURITY DEFINER functions.
  const uniqueRounds = new Set<string>()
  const recordedResults = new Set<string>()
  for (const eventId of ids) {
    const { data: raceRows, error: raceError } = await db.rpc('school_race_rounds', {
      p_school: schoolId.value,
      p_event: eventId
    })
    if (raceError) throw new Error(`Unable to load Event Day rounds: ${raceError.message}`)
    for (const row of raceRows || []) {
      if (!row.round_id) continue
      uniqueRounds.add(String(row.round_id))
      // The Event Day RPC reports a result_status for each competitor. A
      // pending result has not yet been entered, even if a lane is assigned.
      if (row.entry_id && row.result_status && row.result_status !== 'pending') {
        recordedResults.add(`${row.round_id}:${row.entry_id}`)
      } else if (row.entry_id && row.time_ms != null) {
        recordedResults.add(`${row.round_id}:${row.entry_id}`)
      }
    }
  }
  roundsCount.value = uniqueRounds.size
  resultCount.value = recordedResults.size
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
  eventForm.value=emptyEvent()
  if(!loading.value) {try {await loadEvents()}catch(e:any){error.value=e.message||'Unable to load competition statistics'}}
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
function editEvent(ev:any){
 editingEvent.value=ev
 eventForm.value={event_definition_id:ev.event_definition_id,age_group:ev.age_group||'',division:ev.division||'',is_team:ev.is_team,
 kind:ev.race_lanes?'race':'field',min_age:ev.min_age==null?'':String(ev.min_age),max_age:ev.max_age==null?'':String(ev.max_age),
 lanes:String(ev.race_lanes||8),heats:String(ev.race_max_heats||3),qualification:ev.race_qualification||'positions_plus_times',capacity:ev.max_participants==null?'':String(ev.max_participants)}
 actionKind.value='event';actionModal.value=true
}
async function addEvent(){
 if(!canEditSelected.value||!selected.value||saving.value)return
 const v=eventForm.value
 const min=v.min_age===''?null:Number(v.min_age),max=v.max_age===''?null:Number(v.max_age)
 const lanes=Number(v.lanes),heats=Number(v.heats),capacity=v.capacity===''?null:Number(v.capacity)
 if(!v.event_definition_id){error.value='Choose an event.';return}
 if(v.kind==='race' && v.is_team){error.value='Individual races cannot be team events.';return}
 if((min!==null&&(!Number.isInteger(min)||min<3||min>30))||(max!==null&&(!Number.isInteger(max)||max<3||max>30))||(min!==null&&max!==null&&min>max)){error.value='Check minimum and maximum ages.';return}
 if(v.kind==='race'&&(!Number.isInteger(lanes)||lanes<1||lanes>20||!Number.isInteger(heats)||heats<1||heats>30)){error.value='Enter 1–20 lanes and 1–30 heats.';return}
 if(v.kind==='field'&&capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>10000)){error.value='Invalid participant limit.';return}
 saving.value=true;error.value='';notice.value=''
 try{
  const {error:e}=await db.rpc('school_save_configured_competition_event',{
   p_school:schoolId.value,p_comp:selected.value,p_event:editingEvent.value?.id||null,p_definition:v.event_definition_id,
   p_age:v.age_group||null,p_division:v.division||null,p_team:v.is_team,p_min_age:min,p_max_age:max,
   p_kind:v.kind,p_lanes:v.kind==='race'?lanes:null,p_max_heats:v.kind==='race'?heats:null,
   p_qualification:v.kind==='race'?v.qualification:null,p_capacity:v.kind==='field'?capacity:null
  })
  if(e)throw e
  notice.value=editingEvent.value?'Event updated.':'Event and configuration saved.'
  editingEvent.value=null;eventForm.value=emptyEvent();dismissAction();await loadEvents()
 }catch(e:any){error.value=e.message||'Unable to save event'}
 finally{saving.value=false}
}
async function saveCompetitionLimit(){
 if(!canEditSelected.value||limitSaving.value)return
 const raw=competitionLimit.value.trim(), n=raw===''?null:Number(raw)
 if(n!==null&&(!Number.isInteger(n)||n<1||n>100)){error.value='Enter a whole number between 1 and 100, or leave blank for unlimited.';return}
 limitSaving.value=true;error.value='';notice.value=''
 try{const {error:e}=await db.rpc('school_set_competition_entry_limit',{p_school:schoolId.value,p_comp:selected.value,p_limit:n});if(e)throw e;notice.value='Competition entry limit saved.';await load()}
 catch(e:any){error.value=e.message||'Unable to save limit'}finally{limitSaving.value=false}
}
function removeEvent(id:string){
  if(!canEditSelected.value||!confirm('Remove this event? This is only allowed before rounds or entries exist.'))return
  perform(()=>db.rpc('school_remove_competition_event',{p_school:schoolId.value,p_event:id}),'Event removed.')
}
onMounted(load)
</script>
<template>
  <div class="page competition-page"><div class="shell admin-section competition-shell">
    <div class="competition-breadcrumb"><NuxtLink :to="{path:'/school/dashboard',query:{school:schoolId}}">Dashboard</NuxtLink><span>›</span><span>Competitions</span><template v-if="selectedCompetition"><span>›</span><strong>{{selectedCompetition.name}}</strong></template></div>
    <p v-if="loading" class="competition-loading">Loading competition workspace…</p>
    <p v-if="error" class="error" role="alert">{{error}}</p>
    <p v-if="notice" class="notice" role="status">{{notice}}</p>
    <template v-if="!loading">
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

      <div class="competition-switcher">
        <label class="field"><span>Competition</span><select v-model="selected"><option v-for="c in visibleCompetitions" :key="c.id" :value="c.id">{{c.name}}</option></select></label>
        <label v-if="isSuperAdmin" class="switcher-toggle"><input v-model="showAllCompetitions" type="checkbox" /> All schools</label>
        <button v-if="canEdit" class="btn competition-add" type="button" @click="actionKind='add';actionModal=true">+ New Competition</button>
      </div>
      <p v-if="!selectedCompetition" class="competition-empty">No competition selected. Choose a competition or create one.</p>
      <template v-else>
        <header class="competition-heading">
          <div class="competition-sport-icon" aria-hidden="true">{{ /swim/i.test(sportName(selectedCompetition.sport_id))?'🏊':/athlet|track|run/i.test(sportName(selectedCompetition.sport_id))?'🏃':'🏆' }}</div>
          <div class="competition-heading-main"><h1>{{selectedCompetition.name}}</h1><div class="competition-meta"><span>▦ {{dateLabel}}</span><span>♧ {{schoolName}}</span><span>♙ {{totalRegistrations}} Registrations</span><span>🏆 {{selectedEvents.length}} Events</span></div></div>
          <div class="competition-status-stack"><span class="competition-status">{{selectedCompetition.status}}</span><span class="window-state" :class="registrationWindowState.code">{{registrationWindowState.label}}</span></div>
        </header>
        <nav class="competition-tabs" aria-label="Competition workspace">
          <button v-for="tab in [{id:'overview',label:'Overview',icon:'⌂'},{id:'events',label:'Events',icon:'☷'},{id:'registrations',label:'Registrations',icon:'♧'},{id:'eventday',label:'Event Day',icon:'⚑'},{id:'results',label:'Results',icon:'🏆'},{id:'settings',label:'Settings',icon:'⚙'}]" :key="tab.id" type="button" :class="{active:activeTab===tab.id}" @click="activeTab=tab.id as any"><span aria-hidden="true">{{tab.icon}}</span> {{tab.label}}<span v-if="tab.id==='events'"> ({{selectedEvents.length}})</span><span v-if="tab.id==='registrations'"> ({{totalRegistrations}})</span></button>
        </nav>
        <template v-if="activeTab==='overview'">
          <div class="competition-metrics">
            <div class="metric-card"><span class="metric-icon blue">♟</span><div><strong>{{totalRegistrations}}</strong><span>Registrations</span></div></div>
            <div class="metric-card"><span class="metric-icon gold">🏆</span><div><strong>{{selectedEvents.length}}</strong><span>Events</span></div></div>
            <div class="metric-card"><span class="metric-icon purple">◴</span><div><strong>{{roundsCount===null?'—':roundsCount}}</strong><span>Rounds Generated</span></div></div>
            <div class="metric-card"><span class="metric-icon pale">⚑</span><div><strong>{{resultCount===null?'—':resultCount}}</strong><span>Results Recorded</span></div></div>
          </div>
          <div class="competition-main-grid">
            <section class="competition-panel"><div class="panel-heading"><h2>🏆 Competition Events</h2><button v-if="canEditSelected" class="btn competition-add" type="button" @click="editingEvent=null;eventForm=emptyEvent();actionKind='event';actionModal=true">+ Add Event</button></div>
              <div v-for="ev in selectedEvents" :key="ev.id" class="competition-event-row"><div class="event-symbol">{{ev.race_lanes ? (/swim/i.test(sportName(selectedCompetition.sport_id)) ? '🏊' : /athlet|track|run/i.test(sportName(selectedCompetition.sport_id)) ? '🏃' : '🏁') : '🏅'}}</div><div class="event-details"><strong>{{definitionName(ev.event_definition_id)}}</strong><span>{{ev.age_group||'All ages'}} · {{ev.division||'Open'}} · {{ev.is_team?'Team':'Individual'}}</span><span v-if="ev.race_lanes">{{ev.race_lanes}} lanes × {{ev.race_max_heats}} heats ({{ev.max_participants}} places)</span><span v-else>Capacity: {{ev.max_participants??'Unlimited'}}</span></div><div class="event-row-actions"><span class="entry-chip">{{entryCountFor(ev.id)}} / {{ev.max_participants??'∞'}} Registered</span><div class="action-buttons"><NuxtLink class="action-link primary" :to="eventDayUrl(ev.id)">⚑ Event Day</NuxtLink><NuxtLink class="action-link" :to="registrationUrl()">♧ Registrations</NuxtLink><button v-if="canEditSelected" class="action-link" type="button" @click="editEvent(ev)">✎ Edit</button></div></div></div>
              <p v-if="!selectedEvents.length" class="panel-empty">No events configured yet. Add an event to get started.</p>
            </section>
            <section class="competition-panel progress-panel"><div class="panel-heading"><h2>☷ Competition Progress</h2></div><div class="progress-step done"><span>✓</span><div><strong>Setup Competition</strong><small>Competition created</small></div></div><div class="progress-step" :class="{done:selectedEvents.length>0}"><span>{{selectedEvents.length?'✓':'○'}}</span><div><strong>Add Events</strong><small>{{selectedEvents.length}} events added</small></div></div><div class="progress-step" :class="{current:selectedCompetition.status==='registration'}"><span>○</span><div><strong>Registration</strong><small>{{totalRegistrations}} registrations · {{selectedCompetition.status}}</small></div></div><div class="progress-step" :class="{current:selectedCompetition.status==='active'}"><span>○</span><div><strong>Event Day</strong><small>Manage heats, runs and results</small></div></div><div class="progress-step" :class="{done:selectedCompetition.status==='completed'}"><span>{{selectedCompetition.status==='completed'?'✓':'○'}}</span><div><strong>Complete</strong><small>Finalise results and house points</small></div></div></section>
          </div>
          <div class="competition-bottom-grid"><section class="competition-panel"><div class="panel-heading"><h2>◷ Registration Status</h2></div><div class="registration-summary"><span class="window-state" :class="registrationWindowState.code">{{registrationWindowState.label}}</span><p class="panel-description">{{registrationWindowState.detail}}</p><div class="registration-dates"><div><small>Opens</small><strong>{{registrationDateText(selectedCompetition.registration_opens_at)}}</strong></div><div><small>Closes</small><strong>{{registrationDateText(selectedCompetition.registration_closes_at)}}</strong></div></div><p class="registration-timezone">Times displayed in your device's local timezone.</p></div><div v-if="registrationReadiness.items.length" class="registration-warnings"><strong>Configuration checks</strong><ul><li v-for="warning in registrationReadiness.items" :key="warning">{{warning}}</li></ul></div><p v-else class="panel-description">Registration configuration is ready.</p></section><section class="competition-panel"><div class="panel-heading"><h2>ϟ Quick Actions</h2></div><div class="quick-actions"><NuxtLink class="action-link primary" :to="eventDayUrl()">⚑ Event Day</NuxtLink><NuxtLink class="action-link" :to="registrationUrl()">♧ View Registrations</NuxtLink><NuxtLink class="action-link" :to="mobileResultUrl()">🏆 Enter Results</NuxtLink></div></section></div>
        </template>
        <section v-if="activeTab==='events'" class="competition-panel full-panel"><div class="panel-heading"><h2>Competition Events ({{selectedEvents.length}})</h2><button v-if="canEditSelected" class="btn competition-add" type="button" @click="editingEvent=null;eventForm=emptyEvent();actionKind='event';actionModal=true">+ Add Event</button></div><div v-for="ev in selectedEvents" :key="ev.id" class="competition-event-row"><div class="event-symbol">{{ev.race_lanes ? (/swim/i.test(sportName(selectedCompetition.sport_id)) ? '🏊' : /athlet|track|run/i.test(sportName(selectedCompetition.sport_id)) ? '🏃' : '🏁') : '🏅'}}</div><div class="event-details"><strong>{{definitionName(ev.event_definition_id)}}</strong><span>{{ev.age_group||'All ages'}} · {{ev.division||'Open'}} · {{ev.is_team?'Team':'Individual'}}</span><span v-if="ev.race_lanes">{{ev.race_lanes}} lanes × {{ev.race_max_heats}} heats · {{ev.max_participants}} places</span><span v-else>Capacity {{ev.max_participants??'Unlimited'}}</span></div><div class="event-row-actions"><span class="entry-chip">{{entryCountFor(ev.id)}} / {{ev.max_participants??'∞'}} Registered</span><div class="action-buttons"><NuxtLink class="action-link primary" :to="eventDayUrl(ev.id)">⚑ Event Day</NuxtLink><NuxtLink class="action-link" :to="mobileResultUrl(ev.id)">🏆 Results</NuxtLink><button v-if="canEditSelected" class="action-link" @click="editEvent(ev)">✎ Edit</button><button v-if="canEditSelected" class="action-link danger" :disabled="saving" @click="removeEvent(ev.id)">Remove</button></div></div></div><p v-if="!selectedEvents.length" class="panel-empty">No events configured yet.</p></section>
        <section v-if="activeTab==='registrations'" class="competition-panel full-panel"><div class="panel-heading"><h2>Registrations</h2></div><p class="panel-description">{{totalRegistrations}} current event entries across {{selectedEvents.length}} events.</p><NuxtLink class="action-link primary" :to="registrationUrl()">Open Registration Management</NuxtLink></section>
        <section v-if="activeTab==='eventday'" class="competition-panel full-panel"><div class="panel-heading"><h2>⚑ Event Day</h2></div><p class="panel-description">Manage heats, lane assignments and live competition operations.</p><div class="quick-actions"><NuxtLink class="action-link primary" :to="eventDayUrl()">Open Event Day</NuxtLink><NuxtLink class="action-link" :to="mobileResultUrl()">Mobile Results Entry</NuxtLink></div></section>
        <section v-if="activeTab==='results'" class="competition-panel full-panel"><div class="panel-heading"><h2>🏆 Results</h2></div><p class="panel-description">Record times, distances, placings and house points.</p><div class="quick-actions"><NuxtLink class="action-link primary" :to="mobileResultUrl()">Mobile Results Entry</NuxtLink><NuxtLink class="action-link" :to="resultsUrl()">View Results &amp; House Points</NuxtLink></div></section>
        <section v-if="activeTab==='settings'" class="competition-settings"><div class="competition-panel full-panel"><div class="panel-heading"><h2>Competition Details</h2></div><p class="panel-description">{{sportName(selectedCompetition.sport_id)}} · School year {{selectedCompetition.school_year}} · {{selectedCompetition.status}}</p><p v-if="!canEditSelected">This competition is managed by its organiser.</p>          <form v-if="canEditSelected" class="form-grid" @submit.prevent="updateCompetition">
            <label class="field"><span>Name</span><input v-model="editForm.name" required minlength="3" maxlength="120" /></label>
            <label class="field"><span>Date</span><input v-model="editForm.starts_on" type="date" /></label>
            <label class="field"><span>Status</span><select v-model="editForm.status"><option value="draft">Draft</option><option value="registration">Registration</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
            <button class="btn primary" type="submit" :disabled="saving">Save Changes</button>
          </form></div>        <div id="competition-settings" class="card" style="margin-bottom:1rem">
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
</section>
          <AdminActionModal :open="actionModal && actionKind==='event' && canEdit && selectedCompetition.organiser_school_id===schoolId && selectedCompetition.competition_type==='intra_school'"  :title="editingEvent?'Edit Event':'Add Event'" @close="closeEventModal"><form class="form-grid" @submit.prevent="addEvent">
            <h3>{{editingEvent?'Edit Event':'Add Event'}}</h3>
            <p v-if="!eligibleDefinitions.length">No event definitions exist for this sport. A platform administrator must add them to the event catalogue.</p>
            <label class="field"><span>Event</span><select v-model="eventForm.event_definition_id" :disabled="!!editingEvent" required><option value="" disabled>Select event</option><option v-for="d in eligibleDefinitions" :key="d.id" :value="d.id">{{d.name}} ({{d.measurement}})</option></select></label>
            <label class="field"><span>Age group (optional)</span><input v-model="eventForm.age_group" maxlength="60" placeholder="e.g. Under 14" /></label>
            <label class="field"><span>Division (optional)</span><input v-model="eventForm.division" maxlength="60" placeholder="e.g. Girls" /></label>
                         <label v-if="eventForm.kind==='field'"><input v-model="eventForm.is_team" type="checkbox" /> Team event</label>
             <div class="form-grid">
               <label class="field"><span>Minimum age</span><input v-model="eventForm.min_age" type="number" min="3" max="30" placeholder="Any" /></label>
               <label class="field"><span>Maximum age</span><input v-model="eventForm.max_age" type="number" min="3" max="30" placeholder="Any" /></label>
             </div>
             <label class="field"><span>Event type</span><select v-model="eventForm.kind"><option value="race">Race (swimming / athletics)</option><option value="field">Field event / other</option></select></label>
             <template v-if="eventForm.kind==='race'">
               <div class="form-grid">
                 <label class="field"><span>Available lanes</span><input v-model="eventForm.lanes" type="number" min="1" max="20" required /></label>
                 <label class="field"><span>Maximum heats</span><input v-model="eventForm.heats" type="number" min="1" max="30" required /></label>
                 <label class="field"><span>Final qualification</span><select v-model="eventForm.qualification"><option value="positions_plus_times">Heat positions + fastest remaining</option><option value="fastest_times">Fastest overall times</option><option value="positions">Heat finishing positions</option></select></label>
               </div>
               <p class="notice">Calculated capacity: <strong>{{newEventCapacity}}</strong> students. Unused heats are omitted on race day.</p>
             </template>
             <template v-else>
               <label class="field"><span>Maximum participants</span><input v-model="eventForm.capacity" type="number" min="1" max="10000" placeholder="Unlimited" /></label>
             </template>
             <button class="btn primary" type="submit" :disabled="saving || !eligibleDefinitions.length">{{saving?'Saving…':editingEvent?'Save Event Changes':'Add Event to Competition'}}</button>
</form></AdminActionModal>
      </template>
    </template>
  </div></div>
</template>
<style scoped>
.competition-page{color:#e9f2ff}.competition-shell{max-width:none!important;width:100%;padding:20px 22px 40px}.competition-breadcrumb{display:flex;align-items:center;gap:12px;color:#a6bedb;font-size:13px;margin-bottom:15px;flex-wrap:wrap}.competition-breadcrumb a{color:#83c8ff;text-decoration:none}.competition-breadcrumb strong{font-weight:500;color:#e4efff}.competition-switcher{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:18px}.competition-switcher .field{margin:0;min-width:230px;max-width:410px;flex:1}.competition-switcher .field span{font-size:12px;color:#aac4e5}.competition-switcher select{width:100%;background:#102b4d;color:#f5faff;border:1px solid #375d89;border-radius:9px;padding:10px}.switcher-toggle{display:flex;gap:7px;align-items:center;font-size:13px}.competition-add{background:#0962cf!important;color:white!important;border:1px solid #2c88f7!important;border-radius:8px!important;font-weight:650!important}.competition-heading{display:flex;align-items:center;gap:20px;margin-bottom:22px;min-height:104px}.competition-sport-icon,.event-symbol{background:#0756b5;border:1px solid #1d75e1;border-radius:12px;display:grid;place-items:center;flex-shrink:0}.competition-sport-icon{width:76px;height:76px;font-size:37px}.competition-heading-main{flex:1;min-width:0}.competition-heading h1{font-family:Inter,Arial,sans-serif!important;font-size:clamp(23px,2.5vw,35px);letter-spacing:-.03em;line-height:1.2;margin:0 0 12px;font-weight:780}.competition-meta{display:flex;gap:12px;flex-wrap:wrap;color:#c4d6ec;font-size:14px}.competition-meta span+span{border-left:1px solid #547393;padding-left:12px}.competition-status{align-self:flex-start;background:#b5d8ff;color:#073a78;text-transform:capitalize;border-radius:10px;padding:11px 16px;font-weight:800;white-space:nowrap}.competition-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));background:#0e2b4f;border:1px solid #2e527c;border-radius:12px;overflow:hidden;margin-bottom:20px}.competition-tabs button{border:0;border-right:1px solid #31537b;background:transparent;color:#e9f3ff;padding:16px 8px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}.competition-tabs button:last-child{border-right:0}.competition-tabs button.active{background:#0b5fc9;color:white;border-radius:10px}.competition-tabs button:hover:not(.active){background:#1b416e}.competition-tabs button span:first-child{font-size:19px;margin-right:6px}.competition-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:20px}.metric-card,.competition-panel{background:linear-gradient(135deg,#102b4c,#0b203a);border:1px solid #2c5683;border-radius:14px;box-shadow:0 3px 10px #020c1b25}.metric-card{min-height:90px;display:flex;align-items:center;gap:19px;padding:17px 22px}.metric-card div{display:flex;flex-direction:column;gap:4px}.metric-card strong{font-size:31px;line-height:1;font-weight:800}.metric-card div span{font-size:14px;color:#e2efff}.metric-icon{font-size:34px}.metric-icon.blue{color:#44b8ff}.metric-icon.gold{color:#ffc62d}.metric-icon.purple{color:#c88bff}.metric-icon.pale{color:#f1f5ff}.competition-main-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(280px,1fr);gap:20px;margin-bottom:20px}.competition-bottom-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:20px}.competition-panel{padding:20px 22px;min-width:0}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #284d77;padding-bottom:15px;margin-bottom:7px}.panel-heading h2{font-size:18px;margin:0;font-weight:780;color:#f5f8ff}.panel-heading .btn{font-size:13px;padding:8px 11px}.competition-event-row{display:flex;align-items:center;gap:14px;padding:18px 3px;border-bottom:1px solid #294b70}.competition-event-row:last-child{border-bottom:0}.event-symbol{width:53px;height:53px;font-size:26px}.event-details{display:flex;flex-direction:column;gap:5px;flex:1;min-width:130px}.event-details strong{font-size:16px;color:#fff}.event-details span{font-size:13px;color:#d4e3f7}.event-row-actions{display:flex;align-items:flex-end;flex-direction:column;gap:10px}.entry-chip{background:#a8efca;color:#063825;border-radius:8px;padding:6px 10px;font-weight:750;font-size:12px;white-space:nowrap}.action-buttons,.quick-actions{display:flex;flex-wrap:wrap;gap:9px}.action-link{display:inline-flex;align-items:center;justify-content:center;gap:5px;text-decoration:none!important;background:#173252;color:#f4f9ff!important;border:1px solid #567597;border-radius:8px;padding:9px 12px;font:inherit;font-size:13px;font-weight:650;cursor:pointer;white-space:nowrap}.action-link.primary{background:#0a5fc8;border-color:#198cff;color:white!important}.action-link.danger{color:#ffb9b9!important}.action-link:hover{filter:brightness(1.18)}.progress-step{display:flex;align-items:center;gap:15px;border-bottom:1px solid #2b507a;padding:13px 5px}.progress-step:last-child{border:0}.progress-step>span{width:29px;height:29px;flex-shrink:0;border:2px solid #c7dbf0;border-radius:50%;display:grid;place-items:center;font-size:17px}.progress-step.done>span{background:#28b34b;border-color:#28b34b;color:white;font-weight:900}.progress-step.current{background:#174578;border-radius:8px}.progress-step.current>span{border-color:#57b5ff;color:#57b5ff}.progress-step div{display:flex;flex-direction:column;gap:3px}.progress-step strong{font-size:14px}.progress-step small{color:#bcd0e9;font-size:12px}.panel-description,.panel-empty{color:#c2d6ee;line-height:1.6}.full-panel{margin-top:0;min-height:200px}.competition-settings{display:grid;gap:16px}.competition-settings>.card{background:#102b4c;border:1px solid #31577d;border-radius:13px;padding:20px}.competition-settings .form-grid{max-width:850px}.competition-empty{padding:25px}.competition-loading{padding:20px}
@media(max-width:1150px){.competition-main-grid{grid-template-columns:1fr}.competition-bottom-grid{grid-template-columns:1fr}.competition-event-row{flex-wrap:wrap}.event-row-actions{flex-direction:row;align-items:center;flex-wrap:wrap}}
@media(max-width:760px){.competition-shell{padding:14px 10px 35px}.competition-heading{gap:10px;flex-wrap:wrap}.competition-sport-icon{width:52px;height:52px;font-size:26px}.competition-heading-main{flex-basis:calc(100% - 70px)}.competition-heading h1{font-size:22px}.competition-status{padding:7px 11px;font-size:12px}.competition-meta{font-size:12px;gap:7px}.competition-meta span+span{padding-left:7px}.competition-tabs{display:flex;overflow-x:auto;scrollbar-width:thin}.competition-tabs button{min-width:125px;flex-shrink:0;padding:12px}.competition-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric-card{padding:14px;min-height:76px;gap:10px}.metric-card strong{font-size:25px}.metric-card div span{font-size:12px}.metric-icon{font-size:26px}.competition-panel{padding:15px}.competition-event-row{align-items:flex-start}.event-details{min-width:calc(100% - 70px)}.event-row-actions{width:100%;align-items:flex-start;flex-direction:column}.action-buttons{width:100%}.action-buttons .action-link{flex:1}.competition-switcher .field{min-width:100%}}

.competition-status-stack{align-self:flex-start;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.window-state{display:inline-flex;align-items:center;border:1px solid #6387af;background:#1c4169;color:#e5f3ff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:750}
.window-state.open{background:#0f543b;border-color:#3dbe8b;color:#c8ffe3}
.window-state.closed,.window-state.invalid{background:#602d39;border-color:#c46d7d;color:#ffe1e4}
.window-state.upcoming{background:#4c3d18;border-color:#cba94e;color:#fff0bf}
.registration-summary{padding-top:12px}.registration-summary>.panel-description{margin:10px 0}
.registration-dates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
.registration-dates>div{display:flex;flex-direction:column;gap:6px;border:1px solid #32577f;background:#0b2441;border-radius:10px;padding:13px}
.registration-dates small,.registration-timezone{color:#a9c4e4;font-size:12px}.registration-dates strong{font-size:14px;font-weight:650}
.registration-warnings{border-top:1px solid #345478;margin-top:15px;padding-top:12px;color:#f5d7aa;font-size:13px}
.registration-warnings ul{padding-left:20px;line-height:1.7}
@media(max-width:760px){.competition-status-stack{align-items:flex-start}.registration-dates{grid-template-columns:1fr}}
</style>