<script setup lang="ts">
// Touch-first event results entry. Uses the same authorised RPCs as the existing Results page.
const db = useSupabaseClient()
const route = useRoute()
const school = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const loading = ref(true), busy = ref(false), error = ref(''), notice = ref(''), canEdit = ref(false)
const competitions = ref<any[]>([]), events = ref<any[]>([]), definitions = ref<any[]>([]), entrants = ref<any[]>([])
const competitionId = ref(''), eventId = ref(''), roundId = ref('')
const selectedCompetition = computed(() => competitions.value.find(c => c.id === competitionId.value))
const selectedEvent = computed(() => events.value.find(e => e.id === eventId.value))
const eventName = (e:any) => definitions.value.find(d => d.id === e?.event_definition_id)?.name || 'Event'
const eventLabel = (e:any) => `${eventName(e)} · ${e.age_group || 'All ages'} · ${e.division || 'Open'}`
const measurementLabel = (r:any) => r.measurement === 'time_ms' ? 'Time (seconds)' : r.measurement === 'distance_mm' ? 'Distance (metres)' : 'Points'
const isOpen = computed(() => canEdit.value && ['active','completed'].includes(selectedCompetition.value?.status))
const drafts = ref<Record<string,{status:string,value:string,placing:string,publish:boolean}>>({})
const editing = ref('')
function toDisplay(r:any){
  if(r.performance_value == null)return ''
  return r.measurement === 'time_ms' || r.measurement === 'distance_mm' ? String(r.performance_value/1000) : String(r.performance_value)
}
function toStored(r:any,v:string){
  const n=Number(v)
  if(!v.trim() || !Number.isFinite(n) || n<0)return null
  const stored=(r.measurement === 'time_ms' || r.measurement === 'distance_mm')?Math.round(n*1000):n
  return Number.isSafeInteger(stored)?stored:null
}
async function load(){
  loading.value=true;error.value=''
  try{
    const {data:{user}}=await db.auth.getUser()
    if(!user){await navigateTo('/login');return}
    if(!school.value)throw new Error('Select a school from the dashboard first.')
    const [m,p,c,d]=await Promise.all([
      db.from('school_memberships').select('role').eq('school_id',school.value).eq('user_id',user.id).maybeSingle(),
      db.rpc('is_platform_admin'),
      db.from('competitions').select('id,name,school_year,status').eq('organiser_school_id',school.value).eq('competition_type','intra_school').order('school_year',{ascending:false}),
      db.from('event_definitions').select('id,name,measurement')
    ])
    for(const result of [m,p,c,d])if(result.error)throw result.error
    if(!p.data && !['school_admin','teacher'].includes(m.data?.role))throw new Error('School staff access required.')
    canEdit.value=!!p.data || ['school_admin','teacher'].includes(m.data?.role)
    competitions.value=c.data||[];definitions.value=d.data||[]
    competitionId.value=competitions.value.some(c=>c.id===route.query.competition)?String(route.query.competition):(competitions.value[0]?.id||'')
    await loadEvents()
  }catch(e:any){error.value=e.message||'Unable to load results'}
  finally{loading.value=false}
}
async function loadEvents(){
  events.value=[];entrants.value=[];eventId.value='';roundId.value=''
  if(!competitionId.value)return
  const r=await db.from('competition_events').select('id,event_definition_id,age_group,division,is_team').eq('competition_id',competitionId.value).eq('is_team',false)
  if(r.error)throw r.error
  events.value=r.data||[]
  eventId.value=events.value.some(e=>e.id===route.query.event)?String(route.query.event):(events.value[0]?.id||'')
  await loadEntrants()
}
async function loadEntrants(){
  entrants.value=[];drafts.value={};roundId.value='';editing.value='';notice.value=''
  if(!eventId.value)return
  const [r,rd]=await Promise.all([
    db.rpc('school_event_results',{p_school:school.value,p_event:eventId.value}),
    db.rpc('school_results_round',{p_school:school.value,p_event:eventId.value})
  ])
  if(r.error)throw r.error
  if(rd.error)throw rd.error
  roundId.value=rd.data||'';entrants.value=r.data||[]
  for(const x of entrants.value)drafts.value[x.entry_id]={status:x.result_status||'valid',value:toDisplay(x),placing:x.placing_position==null?'':String(x.placing_position),publish:!!x.published}
}
async function save(r:any){
  if(!isOpen.value||busy.value)return
  const d=drafts.value[r.entry_id];if(!d)return
  error.value='';notice.value=''
  const performance=d.status==='valid'?toStored(r,d.value):null
  if(d.status==='valid'&&performance===null){error.value='Enter a valid non-negative performance.';return}
  const place=d.status==='valid'&&d.placing.trim()?Number(d.placing):null
  if(place!==null&&(!Number.isSafeInteger(place)||place<1)){error.value='Placing must be a positive whole number.';return}
  busy.value=true
  try{
    let rd=roundId.value
    if(!rd){const x=await db.rpc('school_ensure_results_round',{p_school:school.value,p_event:eventId.value});if(x.error)throw x.error;rd=x.data;roundId.value=rd}
    const x=await db.rpc('school_save_event_result',{p_school:school.value,p_round:rd,p_entry:r.entry_id,p_status:d.status,p_performance:performance,p_placing:place,p_publish:d.publish})
    if(x.error)throw x.error
    await loadEntrants()
    notice.value=`Saved result for ${r.student_name}.`
  }catch(e:any){error.value=e.message||'Unable to save result'}
  finally{busy.value=false}
}
async function changedCompetition(){error.value='';try{await loadEvents()}catch(e:any){error.value=e.message||'Unable to load events'}}
async function changedEvent(){error.value='';try{await loadEntrants()}catch(e:any){error.value=e.message||'Unable to load entrants'}}
onMounted(load)
</script>
<template>
  <div class="mobile-results">
    <div class="mobile-results-heading sports-page-heading">
      <NuxtLink :to="{path:'/school/competitions',query:{school}}">← Competitions</NuxtLink>
      <h1>Enter Results</h1>
      <p>Touch-friendly entry for swimming, running and field events.</p>
    </div>
    <p v-if="error" class="result-error" role="alert">{{error}}</p>
    <p v-if="notice" class="result-success" role="status">{{notice}}</p>
    <p v-if="loading">Loading results…</p>
    <template v-else>
      <section class="result-panel selection-panel" aria-label="Select event">
        <label>Competition
          <select v-model="competitionId" @change="changedCompetition"><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}}</option></select>
        </label>
        <label>Event
          <select v-model="eventId" @change="changedEvent"><option v-for="e in events" :key="e.id" :value="e.id">{{eventLabel(e)}}</option></select>
        </label>
        <div class="result-meta"><span>{{entrants.length}} entrants</span><span>{{selectedCompetition?.status||'No competition'}}</span></div>
      </section>
      <p v-if="!isOpen" class="result-warning">Results entry is available to authorised staff when the competition is Active or Completed. Existing results remain visible.</p>
      <p v-if="eventId&&!entrants.length" class="result-panel">No registered students for this event.</p>
      <section v-if="eventId" class="entrant-list" aria-label="Event entrants">
        <article v-for="(r,index) in entrants" :key="r.entry_id" class="result-panel entrant-card">
          <div class="entrant-header"><div><small>Entrant {{index+1}} of {{entrants.length}}</small><h2>{{r.student_name}}</h2><p>{{r.house_name||'No house'}}</p></div><span class="result-state">{{r.published?'Published':r.result_status?'Draft':'Not entered'}}</span></div>
          <div v-if="editing===r.entry_id && drafts[r.entry_id] && isOpen" class="result-form">
            <label>Result status<select v-model="drafts[r.entry_id]!.status"><option value="valid">Valid result</option><option value="dns">Did not start</option><option value="dnf">Did not finish</option><option value="dq">Disqualified</option></select></label>
            <label v-if="drafts[r.entry_id]!.status==='valid'">{{measurementLabel(r)}}<input v-model="drafts[r.entry_id]!.value" type="number" min="0" step="any" inputmode="decimal" placeholder="0.000" /></label>
            <label v-if="drafts[r.entry_id]!.status==='valid'">Placing (optional)<input v-model="drafts[r.entry_id]!.placing" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 1" /></label>
            <label>Publication<select v-model="drafts[r.entry_id]!.publish"><option :value="false">Save as draft</option><option :value="true">Publish result</option></select></label>
            <div class="result-actions"><button class="result-save" :disabled="busy" @click="save(r)">{{busy?'Saving…':'Save Result'}}</button><button class="result-cancel" :disabled="busy" @click="editing=''">Cancel</button></div>
          </div>
          <div v-else class="entrant-footer"><span>{{r.result_status||'No result'}} <template v-if="r.performance_value!=null"> · {{toDisplay(r)}} {{r.measurement==='time_ms'?'sec':r.measurement==='distance_mm'?'m':'pts'}}</template></span><button v-if="isOpen" class="result-edit" @click="editing=r.entry_id">{{r.result_status?'Edit':'Enter'}} Result</button></div>
        </article>
      </section>
      <div class="result-bottom"><NuxtLink :to="{path:'/school/results',query:{school}}">House standings and full results →</NuxtLink></div>
    </template>
  </div>
</template>
<style scoped>
.mobile-results{max-width:900px;margin:0 auto;color:#f2f7ff;padding:4px 0 48px}
.mobile-results-heading{margin-bottom:18px}.mobile-results-heading a,.result-bottom a{color:#a9d1ff}.mobile-results-heading h1{font-size:clamp(1.65rem,4vw,2.4rem);margin:10px 0 6px}.mobile-results-heading p{color:#b7cce6;margin:0}
.result-panel{background:#102744;border:1px solid #315579;border-radius:16px;padding:18px;margin:12px 0;box-shadow:0 8px 24px #0002}
.selection-panel{display:grid;grid-template-columns:1fr 1fr;gap:14px}.selection-panel .result-meta{grid-column:1/-1;display:flex;justify-content:space-between;color:#bdd4f0;font-size:.88rem}
.mobile-results label{display:flex;flex-direction:column;gap:8px;color:#d7e6f8;font-size:.92rem;font-weight:650;min-width:0}
.mobile-results input,.mobile-results select{box-sizing:border-box;width:100%;min-width:0;min-height:50px;padding:12px;background:#091b34;border:1px solid #54769c;border-radius:10px;color:white;font:inherit;font-size:16px}
.mobile-results input:focus,.mobile-results select:focus{outline:2px solid #74adff;outline-offset:1px}
.entrant-header{display:flex;justify-content:space-between;align-items:start;gap:12px}.entrant-header h2{font-size:1.18rem;margin:4px 0}.entrant-header p{margin:0;color:#c1d5eb}.entrant-header small{color:#a8c6e8}.result-state{font-size:.75rem;padding:6px 10px;background:#213e61;border-radius:20px;white-space:nowrap}
.entrant-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;flex-wrap:wrap}.entrant-footer span{color:#bdd3ee}.result-form{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.result-actions{display:flex;gap:10px;grid-column:1/-1}.result-actions button,.result-edit{border:0;border-radius:10px;padding:12px 16px;min-height:48px;font:inherit;font-weight:700;cursor:pointer}.result-save,.result-edit{background:#2479e9;color:white}.result-save{flex:2}.result-cancel{flex:1;background:#2c4565;color:white}.result-actions button:disabled{opacity:.55;cursor:wait}
.result-warning,.result-error,.result-success{padding:14px;border-radius:10px;background:#273b57;color:#f6e5be}.result-error{background:#542a36;color:#fff}.result-success{background:#164837;color:#d8ffeb}.result-bottom{margin-top:24px;text-align:center}
@media(max-width:650px){.mobile-results{padding:0 0 80px}.selection-panel,.result-form{grid-template-columns:1fr}.selection-panel .result-meta{grid-column:auto}.result-panel{padding:15px}.entrant-card{margin:10px 0}.result-actions{grid-column:auto}.result-actions button{min-width:0}}
</style>
