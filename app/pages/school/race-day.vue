<script setup lang="ts">
definePageMeta({layout:'workspace'})
const db=useSupabaseClient()
const {schoolId}=useSchool()
const competitions=ref<any[]>([]),events=ref<any[]>([]),rounds=ref<any[]>([]),entries=ref<any[]>([]),results=ref<any[]>([]),houses=ref<any[]>([]),totals=ref<any[]>([])
const competitionId=ref(''),eventId=ref(''),roundId=ref('')
const loading=ref(false),busy=ref(false),error=ref(''),notice=ref(''),confirm=ref(false)
const form=reactive({entry_id:'',placing_position:'',performance_value:'',status:'valid',published:false})
const selectedEvent=computed(()=>events.value.find(e=>e.id===eventId.value))
const selectedRound=computed(()=>rounds.value.find(r=>r.id===roundId.value))
const selectedResult=computed(()=>results.value.find(r=>r.entry_id===form.entry_id))
const houseName=(id:string)=>houses.value.find(h=>h.id===id)?.name||'Unassigned'
const eventLabel=(e:any)=>[e.event_definitions?.name||'Event',e.age_group,e.division].filter(Boolean).join(' · ')
const orderedTotals=computed(()=>[...totals.value].sort((a,b)=>Number(b.total_points)-Number(a.total_points)))
async function query(table:string,select:string,field:string,value:string){
 const {data,error:e}=await db.from(table).select(select).eq(field,value)
 if(e)throw e
 return data||[]
}
async function loadCompetitions(){
 error.value='';competitionId.value='';events.value=[];eventId.value='';roundId.value=''
 if(!schoolId.value)return
 loading.value=true
 try{
  const [c,h]=await Promise.all([
   query('competitions','id,name,status,organiser_school_id','organiser_school_id',schoolId.value),
   query('school_houses','id,name,colour','school_id',schoolId.value)
  ])
  competitions.value=c;houses.value=h
 }catch(e:any){error.value=e.message||'Unable to load competitions'}finally{loading.value=false}
}
async function loadEvents(){
 eventId.value='';roundId.value='';events.value=[];totals.value=[]
 if(!competitionId.value)return
 loading.value=true;error.value=''
 try{
  const [e,t]=await Promise.all([
   query('competition_events','id,competition_id,age_group,division,is_team,event_definitions(name)','competition_id',competitionId.value),
   query('competition_house_totals','competition_id,school_id,house_id,total_points,scored_results','competition_id',competitionId.value)
  ])
  events.value=e;totals.value=t.filter((v:any)=>v.school_id===schoolId.value)
 }catch(e:any){error.value=e.message||'Unable to load events'}finally{loading.value=false}
}
async function loadRounds(){
 roundId.value='';rounds.value=[];entries.value=[];results.value=[]
 if(!eventId.value)return
 loading.value=true;error.value=''
 try{
  const [r,en]=await Promise.all([
   query('event_rounds','id,name,round_order','competition_event_id',eventId.value),
   query('event_entries','id,house_id,team_name,school_id','competition_event_id',eventId.value)
  ])
  rounds.value=r.sort((a:any,b:any)=>(a.round_order||0)-(b.round_order||0))
  entries.value=en.filter((v:any)=>v.school_id===schoolId.value)
 }catch(e:any){error.value=e.message||'Unable to load rounds'}finally{loading.value=false}
}
async function loadResults(){
 results.value=[];form.entry_id=''
 if(!roundId.value)return
 try{results.value=await query('event_results','id,entry_id,placing_position,performance_value,status,points,published_at','round_id',roundId.value)}
 catch(e:any){error.value=e.message||'Unable to load results'}
}
function editEntry(entry:any){
 const result=results.value.find(r=>r.entry_id===entry.id)
 Object.assign(form,{entry_id:entry.id,placing_position:result?.placing_position==null?'':String(result.placing_position),performance_value:result?.performance_value==null?'':String(result.performance_value),status:result?.status||'valid',published:!!result?.published_at})
 notice.value='';error.value=''
}
function validate(){
 if(!roundId.value||!form.entry_id)throw new Error('Select a round and participant')
 if(form.status==='valid'&&(!form.performance_value||!/^\d+$/.test(form.performance_value)))throw new Error('Valid results require a whole-number performance value in the event measurement unit')
 if(form.placing_position!==''&&(!Number.isInteger(Number(form.placing_position))||Number(form.placing_position)<1))throw new Error('Placing must be a positive whole number')
 if(form.published&&form.placing_position==='')throw new Error('Set a placing before publishing')
}
function askSave(){try{validate();error.value='';confirm.value=true}catch(e:any){error.value=e.message}}
async function save(){
 if(busy.value)return
 busy.value=true;confirm.value=false;error.value=''
 try{
  validate()
  const payload:any={round_id:roundId.value,entry_id:form.entry_id,status:form.status,placing_position:form.placing_position===''?null:Number(form.placing_position),performance_value:form.performance_value===''?null:Number(form.performance_value),published_at:form.published?(selectedResult.value?.published_at||new Date().toISOString()):null}
  const old=selectedResult.value
  const r=old?await db.from('event_results').update(payload).eq('id',old.id):await db.from('event_results').insert(payload)
  if(r.error)throw r.error
  await loadResults()
  const {data,error:e}=await db.from('competition_house_totals').select('competition_id,school_id,house_id,total_points,scored_results').eq('competition_id',competitionId.value)
  if(e)throw e
  totals.value=(data||[]).filter((v:any)=>v.school_id===schoolId.value)
  notice.value='Result saved successfully'
 }catch(e:any){error.value=e.message||'Unable to save result'}finally{busy.value=false}
}
watch(schoolId,loadCompetitions,{immediate:true})
</script>
<template>
<div class="space-y-6">
 <header><h1 class="text-3xl font-extrabold">Race Day</h1><p class="mt-2 text-[var(--muted)]">Enter results, publish placings and monitor house points.</p></header>
 <p v-if="error" role="alert" class="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">{{error}}</p>
 <p v-if="notice" role="status" class="rounded-xl border border-green-300 bg-green-50 p-4 text-green-800">{{notice}}</p>
 <UiPanel>
  <div class="grid gap-4 md:grid-cols-3">
   <label class="block font-semibold">Competition<select v-model="competitionId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadEvents"><option value="">Choose competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}}</option></select></label>
   <label class="block font-semibold">Event<select v-model="eventId" :disabled="!competitionId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadRounds"><option value="">Choose event</option><option v-for="e in events" :key="e.id" :value="e.id">{{eventLabel(e)}}</option></select></label>
   <label class="block font-semibold">Round<select v-model="roundId" :disabled="!eventId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadResults"><option value="">Choose round</option><option v-for="r in rounds" :key="r.id" :value="r.id">{{r.name}}</option></select></label>
  </div>
  <p v-if="loading" class="mt-4 text-sm text-[var(--muted)]">Loading…</p>
  <p v-else-if="eventId&&!rounds.length" class="mt-4 text-sm text-[var(--muted)]">No rounds have been created for this event yet.</p>
 </UiPanel>
 <div v-if="roundId" class="grid gap-6 lg:grid-cols-2">
  <UiPanel>
   <h2 class="mb-4 text-xl font-bold">Record a result</h2>
   <p v-if="!entries.length" class="text-[var(--muted)]">No participants are registered for this event yet.</p>
   <form v-else class="space-y-4" @submit.prevent="askSave">
    <label class="block font-semibold">Participant / team<select v-model="form.entry_id" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" required @change="editEntry(entries.find(e=>e.id===form.entry_id))"><option value="">Select participant</option><option v-for="e in entries" :key="e.id" :value="e.id">{{e.team_name||'Entry '+e.id.slice(0,8)}} — {{houseName(e.house_id)}}</option></select></label>
    <label class="block font-semibold">Placing<input v-model="form.placing_position" type="number" min="1" step="1" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block font-semibold">Performance (stored measurement value)<input v-model="form.performance_value" type="number" min="0" step="1" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block font-semibold">Status<select v-model="form.status" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="valid">Valid</option><option value="dns">Did not start</option><option value="dnf">Did not finish</option><option value="dq">Disqualified</option></select></label>
    <label class="flex items-center gap-3"><input v-model="form.published" type="checkbox" class="h-5 w-5"/> Publish result and award points</label>
    <div class="flex justify-end"><button type="submit" aria-label="Save result" class="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white" :disabled="busy">Save result</button></div>
   </form>
  </UiPanel>
  <UiPanel><h2 class="mb-4 text-xl font-bold">Round results</h2><div v-if="!results.length" class="text-[var(--muted)]">No results recorded.</div><div v-for="r in results" :key="r.id" class="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3"><div><strong>{{r.placing_position||'—'}} · {{entries.find(e=>e.id===r.entry_id)?.team_name||'Entry '+r.entry_id.slice(0,8)}}</strong><p class="text-xs text-[var(--muted)]">{{r.published_at?'Published':'Draft'}} · {{r.status}}</p></div><div class="flex items-center gap-3"><strong>{{r.points||0}} pts</strong><button type="button" :aria-label="'Edit result for '+r.entry_id" class="rounded-lg border border-[var(--border)] px-3 py-2 text-blue-500" @click="editEntry(entries.find(e=>e.id===r.entry_id))">✎</button></div></div></UiPanel>
 </div>
 <UiPanel v-if="competitionId"><h2 class="mb-4 text-xl font-bold">House leaderboard</h2><p v-if="!orderedTotals.length" class="text-[var(--muted)]">House points will appear when valid results are published.</p><div v-for="(t,i) in orderedTotals" :key="t.house_id" class="flex items-center justify-between border-b border-[var(--border)] py-3"><div class="flex items-center gap-3"><strong>{{i+1}}</strong><span class="h-4 w-4 rounded-full" :style="{background:houses.find(h=>h.id===t.house_id)?.colour||'#64748b'}"/><span>{{houseName(t.house_id)}}</span></div><strong>{{t.total_points}} points</strong></div></UiPanel>
 <div v-if="confirm" class="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"><h2 class="text-xl font-bold">Save result?</h2><p class="mt-3 text-[var(--muted)]">Confirm {{form.published?'publishing this result and awarding points':'saving this result as a draft'}}.</p><div class="mt-6 flex justify-end gap-3"><button type="button" aria-label="Cancel" class="rounded-xl border border-[var(--border)] px-4 py-2" @click="confirm=false">Cancel</button><button type="button" aria-label="Confirm save" :disabled="busy" class="rounded-xl bg-blue-600 px-4 py-2 text-white" @click="save">Confirm save</button></div></section></div>
</div>
</template>
