<script setup lang="ts">
definePageMeta({layout:'workspace'})
const route=useRoute()
const db=useSupabaseClient()
const {schoolId}=useSchool()
const competitions=ref<any[]>([]),events=ref<any[]>([]),rounds=ref<any[]>([]),results=ref<any[]>([]),entries=ref<any[]>([]),participants=ref<any[]>([]),students=ref<any[]>([]),houses=ref<any[]>([]),totals=ref<any[]>([])
const competitionId=ref(''),eventId=ref(''),roundId=ref('')
const busy=ref(false),error=ref('')
const selectedCompetition=computed(()=>competitions.value.find(c=>c.id===competitionId.value))
const showHouse=computed(()=>selectedCompetition.value?.scoring_format!=='individual')
const showIndividual=computed(()=>['individual','both'].includes(selectedCompetition.value?.scoring_format))
const individualTotals=ref<any[]>([]),individualError=ref('')
async function loadIndividual(){
 individualTotals.value=[];individualError.value=''
 if(!showIndividual.value)return
 const cid=competitionId.value
 try{
  const {data,error:e}=await db.rpc('competition_individual_standings',{p_competition_id:cid,p_school_id:schoolId.value})
  if(e)throw e
  if(cid===competitionId.value)individualTotals.value=data||[]
 }catch(e:any){if(cid===competitionId.value)individualError.value=e.message||'Unable to load individual standings'}
}
const selectedEvent=computed(()=>events.value.find(e=>e.id===eventId.value))
const selectedRound=computed(()=>rounds.value.find(r=>r.id===roundId.value))
const eventName=(e:any)=>[e.event_definitions?.name,e.age_group,e.division].filter(Boolean).join(' · ')
const houseName=(id:string)=>houses.value.find(h=>h.id===id)?.name||'Unassigned'
const memberNames=(entryId:string)=>participants.value.filter(p=>p.entry_id===entryId).sort((a,b)=>(a.leg_order||0)-(b.leg_order||0)).map(p=>{const s=students.value.find(s=>s.id===p.student_id);return s?[s.given_name,s.family_name].filter(Boolean).join(' '):'Unknown student'})
const entryName=(entryId:string)=>{const e=entries.value.find(e=>e.id===entryId);return e?.team_name||memberNames(entryId).join(', ')||'Unknown participant'}
const recordBaselines=ref<any[]>([]),recordError=ref('')
async function loadRecordBaselines(){
 recordBaselines.value=[];recordError.value=''
 const ev=selectedEvent.value
 if(!schoolId.value||!ev)return
 const {data,error:e}=await db.from('school_records').select('record_scope,performance_value,source_result_id').eq('school_id',schoolId.value).eq('event_definition_id',ev.event_definition_id).eq('age_group',ev.age_group).eq('division',ev.division).in('record_scope',['SR','ISR'])
 if(e){recordError.value='Unable to check record benchmarks: '+e.message;return}
 recordBaselines.value=data||[]
}
function resultRecordStatus(r:any,scope:string){
 if((scope==='SR'&&r.placing_position!==1)||r.status!=='valid'||r.performance_value==null)return ''
 const b=recordBaselines.value.find(x=>x.record_scope===scope)
 if(!b||b.performance_value==null)return ''
 if(b.source_result_id===r.id)return scope==='SR'?'Confirmed SR':'Recorded ISR'
 const time=/^(time|duration)/i.test(String(selectedEvent.value?.event_definitions?.measurement||''))
 const n=Number(r.performance_value),v=Number(b.performance_value)
 if(time?n<v:n>v)return scope==='ISR'?'ISR Standard':'Potential SR'
 if(n===v)return 'Equals '+scope+' benchmark'
 return ''
}
const publishedResults=computed(()=>results.value.filter(r=>r.published_at).sort((a,b)=>(a.placing_position??9999)-(b.placing_position??9999)||entryName(a.entry_id).localeCompare(entryName(b.entry_id))))
const orderedTotals=computed(()=>[...totals.value].sort((a,b)=>Number(b.total_points)-Number(a.total_points)||houseName(a.house_id).localeCompare(houseName(b.house_id))))
const publishedCount=computed(()=>publishedResults.value.length)
function performance(r:any){if(r.status!=='valid'||r.performance_value==null)return r.status.toUpperCase();const measurement=selectedEvent.value?.event_definitions?.measurement||'';const n=Number(r.performance_value);if(measurement==='distance_mm')return (n/1000).toFixed(3)+' m';if(measurement==='time_ms'||measurement==='duration_ms')return (n/1000).toFixed(3)+' s';return String(n)}
async function get(table:string,fields:string,key:string,value:string){const {data,error:e}=await db.from(table).select(fields).eq(key,value);if(e)throw e;return data||[]}
async function loadCompetitions(){
 competitionId.value='';eventId.value='';roundId.value='';events.value=[];rounds.value=[];results.value=[];totals.value=[];error.value=''
 if(!schoolId.value)return
 busy.value=true
 try{
  const [c,h]=await Promise.all([get('competitions','id,name,status,organiser_school_id,school_year,scoring_format','organiser_school_id',schoolId.value),get('school_houses','id,name,colour','school_id',schoolId.value)])
  competitions.value=c.sort((a,b)=>a.name.localeCompare(b.name));houses.value=h
  const requested=typeof route.query.competition==='string'?route.query.competition:''
  competitionId.value=requested?(c.find(x=>x.id===requested)?.id||''):(c.find(x=>x.status==='active')?.id||c[0]?.id||'')
  if(requested&&!competitionId.value)error.value='The selected competition is unavailable for this school.'
  if(competitionId.value)await loadEvents()
 }catch(e:any){error.value=e.message||'Unable to load competitions'}finally{busy.value=false}
}
async function loadEvents(){
 eventId.value='';roundId.value='';events.value=[];rounds.value=[];results.value=[];totals.value=[]
 if(!competitionId.value)return
 busy.value=true;error.value=''
 try{
  const [ev,t]=await Promise.all([get('competition_events','id,competition_id,event_definition_id,age_group,division,event_definitions(name,measurement)','competition_id',competitionId.value),get('competition_house_totals','competition_id,school_id,house_id,total_points,scored_results','competition_id',competitionId.value)])
  events.value=ev.sort((a,b)=>eventName(a).localeCompare(eventName(b)));totals.value=t.filter(x=>x.school_id===schoolId.value)
  eventId.value=events.value[0]?.id||''
  await loadIndividual();if(eventId.value)await loadRounds()
 }catch(e:any){error.value=e.message||'Unable to load event results'}finally{busy.value=false}
}
async function loadRounds(){
 roundId.value='';rounds.value=[];results.value=[];entries.value=[];participants.value=[];students.value=[]
 if(!eventId.value)return
 busy.value=true;error.value=''
 try{
  const [r,en]=await Promise.all([get('event_rounds','id,name,round_order','competition_event_id',eventId.value),get('event_entries','id,house_id,team_name,school_id','competition_event_id',eventId.value)])
  rounds.value=r.sort((a,b)=>a.round_order-b.round_order);entries.value=en.filter(x=>x.school_id===schoolId.value)
  roundId.value=rounds.value[0]?.id||''
  const ids=entries.value.map(x=>x.id)
  if(ids.length){
   const {data:p,error:pe}=await db.from('entry_participants').select('entry_id,student_id,leg_order').in('entry_id',ids)
   if(pe)throw pe
   participants.value=p||[]
   const studentIds=[...new Set(participants.value.map(x=>x.student_id))]
   if(studentIds.length){const {data:st,error:se}=await db.from('students').select('id,given_name,family_name').in('id',studentIds);if(se)throw se;students.value=st||[]}
  }
  await loadRecordBaselines();if(roundId.value)await loadResults()
 }catch(e:any){error.value=e.message||'Unable to load rounds'}finally{busy.value=false}
}
async function loadResults(){
 results.value=[]
 if(!roundId.value)return
 busy.value=true;error.value=''
 try{results.value=await get('event_results','id,round_id,entry_id,status,performance_value,placing_position,points,published_at,record_badge','round_id',roundId.value)}
 catch(e:any){error.value=e.message||'Unable to load results'}finally{busy.value=false}
}
watch([schoolId,()=>route.query.competition],loadCompetitions,{immediate:true})
</script>
<template>
<div class="space-y-6">
 <UiPageHeader title="Results & Leaderboards" description="Published competition results and championship standings."/>
 <p v-if="error" role="alert" class="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">{{error}}</p>
 <UiPanel>
  <div class="grid gap-4 md:grid-cols-3">
   <label class="text-sm font-semibold">Competition<select v-model="competitionId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadEvents"><option value="">Select competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} ({{c.status}})</option></select></label>
   <label class="text-sm font-semibold">Event<select v-model="eventId" :disabled="!competitionId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadRounds"><option value="">Select event</option><option v-for="e in events" :key="e.id" :value="e.id">{{eventName(e)}}</option></select></label>
   <label class="text-sm font-semibold">Round<select v-model="roundId" :disabled="!eventId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadResults"><option value="">Select round</option><option v-for="r in rounds" :key="r.id" :value="r.id">{{r.name}}</option></select></label>
  </div>
 </UiPanel>
 <div v-if="competitionId" class="grid gap-6 lg:grid-cols-2">
  <UiPanel>
   <h2 class="mb-3 text-xl font-bold">Published results</h2>
   <p class="mb-3 text-sm text-[var(--muted)]">{{selectedEvent?eventName(selectedEvent):'Select an event'}}{{selectedRound?' · '+selectedRound.name:''}} · {{publishedCount}} published</p>
   <p v-if="recordError" role="alert" class="mb-2 text-xs text-red-600">{{recordError}}</p><p class="mb-2 text-xs text-[var(--muted)]">Potential SR is shown for first place (including ties); ISR Standard is shown for every qualifying performance, regardless of placing. ISR-standard performances outside interschool events require official verification.</p><p v-if="busy" class="text-sm text-[var(--muted)]">Loading results…</p>
   <p v-else-if="!publishedResults.length" class="text-sm text-[var(--muted)]">No published results for this round. Publish results from Event Day to display them here.</p>
   <div v-for="r in publishedResults" :key="r.id" class="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3">
    <div><strong>{{r.placing_position?'#'+r.placing_position:'—'}} · {{entryName(r.entry_id)}} <span v-if="r.placing_position===1&&r.record_badge" class="ml-2 inline-flex rounded-md border px-2 py-0.5 text-xs font-extrabold tracking-wide" :class="r.record_badge==='SR'?'border-[#8C6500] bg-[#C99700] text-[#1F1700] shadow-sm':'border-violet-400 bg-violet-100 text-violet-900'" :title="r.record_badge==='SR'?'School Record':'Inter-School Record'">{{r.record_badge}}</span></strong><p class="text-xs text-[var(--muted)]">House: {{houseName(entries.find(e=>e.id===r.entry_id)?.house_id)}} · {{performance(r)}}</p></div>
    <strong class="whitespace-nowrap">{{Number(r.points||0)}} pts</strong>
   </div>
  </UiPanel>
  <UiPanel v-if="showHouse">
   <h2 class="mb-3 text-xl font-bold">House leaderboard</h2>
   <p class="mb-3 text-sm text-[var(--muted)]">{{selectedCompetition?.name}} · Published points only</p>
   <p v-if="!orderedTotals.length" class="text-sm text-[var(--muted)]">No house points have been published yet.</p>
   <div v-for="(t,i) in orderedTotals" :key="t.house_id" class="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3">
    <div class="flex items-center gap-3"><strong class="w-6">{{i+1}}</strong><span class="h-4 w-4 shrink-0 rounded-full" :style="{background:houses.find(h=>h.id===t.house_id)?.colour||'#64748b'}"/><span class="font-semibold">{{houseName(t.house_id)}}</span></div>
    <strong>{{Number(t.total_points)}} pts</strong>
   </div>
  </UiPanel>
 <UiPanel v-if="showIndividual"><h2 class="mb-3 text-xl font-bold">Individual championships</h2><p class="mb-3 text-sm text-[var(--muted)]">Published individual final results only. Relay points excluded.</p><p v-if="individualError" class="text-red-600">{{individualError}}</p><p v-else-if="!individualTotals.length">No individual championship points published yet.</p><div v-for="t in individualTotals" :key="t.student_id+'|'+t.age_group+'|'+t.division" class="flex justify-between gap-3 border-b border-[var(--border)] py-3"><div><strong>{{t.rank}} · {{t.student_name}}</strong><p class="text-xs text-[var(--muted)]">{{t.age_group}} · {{t.division}}</p></div><strong>{{t.total_points}} pts</strong></div></UiPanel>
 </div>
 <p v-else-if="!busy" class="text-sm text-[var(--muted)]">No competitions found for this school.</p>
</div>
</template>