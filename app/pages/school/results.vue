<script setup lang="ts">
const db=useSupabaseClient(),route=useRoute()
const schoolId=computed(()=>typeof route.query.school==='string'?route.query.school:'')
const loading=ref(true),saving=ref(false),error=ref(''),notice=ref(''),canEdit=ref(false)
const competitions=ref<any[]>([]),events=ref<any[]>([]),definitions=ref<any[]>([]),results=ref<any[]>([]),standings=ref<any[]>([])
const competitionId=ref(''),eventId=ref(''),roundId=ref('')

const actionModal = ref(false)
const actionKind = ref('')
function dismissAction(){
  editingResult.value=null
  actionModal.value=false
  if(typeof route.query.action==='string')navigateTo({path:route.path,query:{...route.query,action:undefined},replace:true})
}
watch(()=>route.query.action,(action)=>{
  if(typeof action==='string' && action==='add'){actionKind.value=action;actionModal.value=true}
},{immediate:true})
const editingResult = ref<any | null>(null)
function editResult(r:any){editingResult.value=r;actionKind.value='add';actionModal.value=true}
const competition=computed(()=>competitions.value.find(x=>x.id===competitionId.value))
const event=computed(()=>events.value.find(x=>x.id===eventId.value))
const eventLabel=(e:any)=>definitions.value.find(x=>x.id===e.event_definition_id)?.name||'Event'
const edits=ref<Record<string,{status:string,performance:string,placing:string,publish:boolean}>>({})
const formatPerformance=(r:any)=>r.measurement==='time_ms'?'Milliseconds':r.measurement==='distance_mm'?'Millimetres':'Points (whole number)'
async function fetchStandings(){standings.value=[];if(!competitionId.value)return;const r=await db.rpc('school_house_standings',{p_school:schoolId.value,p_comp:competitionId.value});if(r.error)throw r.error;standings.value=r.data||[]}
async function fetchResults(){results.value=[];roundId.value='';edits.value={};if(!eventId.value)return
 const [r,rd]=await Promise.all([db.rpc('school_event_results',{p_school:schoolId.value,p_event:eventId.value}),db.rpc('school_results_round',{p_school:schoolId.value,p_event:eventId.value})]);if(r.error)throw r.error;if(rd.error)throw rd.error
 roundId.value=rd.data||'';results.value=r.data||[]
 for(const x of results.value)edits.value[x.entry_id]={status:x.result_status||'valid',performance:x.performance_value==null?'':String(x.performance_value),placing:x.placing_position==null?'':String(x.placing_position),publish:!!x.published}
}
async function fetchEvents(){events.value=[];eventId.value='';results.value=[];if(!competitionId.value)return
 const r=await db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team').eq('competition_id',competitionId.value).order('id');if(r.error)throw r.error;events.value=r.data||[];eventId.value=events.value.find(x=>!x.is_team)?.id||'';await Promise.all([fetchResults(),fetchStandings()])}
async function load(){loading.value=true;error.value='';try{
 const {data:{user}}=await db.auth.getUser();if(!user){await navigateTo('/login');return}
 if(!schoolId.value)throw new Error('Select a school from the School Dashboard.')
 const member=await db.from('school_memberships').select('role').eq('user_id',user.id).eq('school_id',schoolId.value).maybeSingle();if(member.error)throw member.error;const platform=await db.rpc('is_platform_admin');if(platform.error)throw platform.error;if(!platform.data && !member.data)throw new Error('You do not have access to this school.')
 canEdit.value=platform.data===true || ['school_admin','teacher'].includes(member.data?.role)
 const [c,d]=await Promise.all([db.from('competitions').select('id,name,school_year,status').eq('organiser_school_id',schoolId.value).eq('competition_type','intra_school').order('school_year',{ascending:false}),db.from('event_definitions').select('id,name')]);if(c.error)throw c.error;if(d.error)throw d.error
 competitions.value=c.data||[];definitions.value=d.data||[];competitionId.value=competitions.value[0]?.id||'';await fetchEvents()
 }catch(e:any){error.value=e.message||'Unable to load results.'}finally{loading.value=false}}
watch(competitionId,async()=>{if(!loading.value){error.value='';try{await fetchEvents()}catch(e:any){error.value=e.message}}})
watch(eventId,async()=>{if(!loading.value){error.value='';try{await fetchResults()}catch(e:any){error.value=e.message}}})
async function save(r:any){if(!canEdit.value||saving.value)return;const v=edits.value[r.entry_id];if(!v)return
 saving.value=true;error.value='';notice.value='';try{
 let rd=roundId.value;if(!rd){const x=await db.rpc('school_ensure_results_round',{p_school:schoolId.value,p_event:eventId.value});if(x.error)throw x.error;rd=x.data;roundId.value=rd}
 const perf=v.status==='valid'&&v.performance.trim()!==''?Number(v.performance):null;const place=v.status==='valid'&&v.placing.trim()!==''?Number(v.placing):null
 if(v.status==='valid'&&(perf===null||!Number.isSafeInteger(perf)||perf<0))throw new Error('Enter a valid non-negative whole-number performance.')
 if(place!==null&&(!Number.isSafeInteger(place)||place<1))throw new Error('Placing must be a positive whole number.')
 const x=await db.rpc('school_save_event_result',{p_school:schoolId.value,p_round:rd,p_entry:r.entry_id,p_status:v.status,p_performance:perf,p_placing:place,p_publish:v.publish});if(x.error)throw x.error
 notice.value=`Saved result for ${r.student_name}.`;dismissAction();editingResult.value=null;await Promise.all([fetchResults(),fetchStandings()])
 }catch(e:any){error.value=e.message||'Unable to save result.'}finally{saving.value=false}}
onMounted(load)
</script>
<template>
 <div class="page"><div class="shell admin-section">
  <NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink>
  <h1>Results &amp; House Points</h1>
  <p class="notice">Record individual event performances and placings. Only published results count towards house standings. Enter times in milliseconds (e.g. 12.45 seconds = 12450) and distances in millimetres (e.g. 4.25 m = 4250).</p>
  <p v-if="loading">Loading…</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
  <template v-if="!loading">
   <div class="card" style="margin-bottom:1rem">
    <label class="field"><span>Competition</span><select v-model="competitionId"><option value="">Select competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} ({{c.school_year}}) — {{c.status}}</option></select></label>
    <label class="field"><span>Individual event</span><select v-model="eventId"><option value="">Select event</option><option v-for="e in events.filter(x=>!x.is_team)" :key="e.id" :value="e.id">{{eventLabel(e)}} · {{e.age_group||'All ages'}} · {{e.division||'Open'}}</option></select></label>
   </div>
   <div v-if="competitionId" class="card" style="margin-bottom:1rem"><h2>House Standings</h2>
    <p v-if="!standings.length">No houses available.</p>
    <div v-for="(h,i) in standings" :key="h.house_id" class="data-row" style="display:flex;justify-content:space-between;gap:1rem"><span>{{i+1}}. {{h.house_name}}</span><strong>{{h.total_points}} pts</strong></div>
   </div>
   <div v-if="eventId" class="card"><h2>{{eventLabel(event)}} — Results</h2>
    <p v-if="!['active','completed'].includes(competition?.status)">Change the competition status to Active in Sports &amp; Events before recording results.</p>
    <p v-if="!results.length">No registered students for this event.</p>
    <div v-for="r in results" :key="r.entry_id" class="data-row" style="margin-bottom:1rem">
     <strong>{{r.student_name}}</strong> <small>— {{r.house_name}}</small>
     <button v-if="canEdit&&['active','completed'].includes(competition?.status)" class="btn" type="button" @click="editResult(r)">Enter / Edit Result</button>
     <small v-if="r.result_status">Current: {{r.result_status}} · Place {{r.placing_position??'—'}} · {{r.points??0}} points · {{r.published?'Published':'Draft'}}</small>
    </div>
   </div>
  </template>
  <AdminActionModal :open="actionModal && canEdit && !editingResult" title="Select Student Result" @close="dismissAction">
    <p>Select a registered student to enter or edit their result.</p>
    <p v-if="!['active','completed'].includes(competition?.status)">The competition must be Active or Completed before results can be entered.</p>
    <div v-for="r in results" :key="r.entry_id" class="data-row">
      <button type="button" class="btn" :disabled="!['active','completed'].includes(competition?.status)" @click="editResult(r)">{{r.student_name}} — {{r.house_name}}</button>
    </div>
    <p v-if="!results.length">Select an event with registered students first.</p>
  </AdminActionModal>
  <AdminActionModal :open="actionModal && canEdit && !!editingResult" :title="editingResult ? 'Result — '+editingResult.student_name : 'Enter Result'" @close="dismissAction">
    <div v-if="editingResult && edits[editingResult.entry_id]" class="form-grid">

      <label class="field"><span>Status</span><select v-model="edits[editingResult.entry_id]!.status"><option value="valid">Valid</option><option value="dns">Did not start</option><option value="dnf">Did not finish</option><option value="dq">Disqualified</option></select></label>
      <label v-if="edits[editingResult.entry_id]!.status==='valid'" class="field"><span>{{formatPerformance(editingResult)}}</span><input v-model="edits[editingResult.entry_id]!.performance" type="number" min="0" step="1" /></label>
      <label v-if="edits[editingResult.entry_id]!.status==='valid'" class="field"><span>Placing</span><input v-model="edits[editingResult.entry_id]!.placing" type="number" min="1" step="1" /></label>
      <label class="field"><span>Publication</span><select v-model="edits[editingResult.entry_id]!.publish"><option :value="false">Draft / Unpublished</option><option :value="true">Published</option></select></label>
      <button v-if="canEdit&&['active','completed'].includes(competition?.status)" class="btn primary" type="button" :disabled="saving" @click="save(editingResult)">{{saving?'Saving…':'Save Result'}}</button>
    </div>
  </AdminActionModal>
 </div></div>
</template>
