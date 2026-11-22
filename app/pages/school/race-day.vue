<script setup lang="ts">
definePageMeta({layout:'workspace'})
const db=useSupabaseClient()
const {schoolId}=useSchool()
const competitions=ref<any[]>([]),events=ref<any[]>([]),rounds=ref<any[]>([]),entries=ref<any[]>([]),results=ref<any[]>([]),houses=ref<any[]>([]),totals=ref<any[]>([])
const competitionId=ref(''),eventId=ref(''),roundId=ref('')
const loading=ref(false),busy=ref(false),error=ref(''),notice=ref(''),confirm=ref(false)
const students=ref<any[]>([]),participants=ref<any[]>([]),entryDialog=ref(false),entryConfirm=ref(false),entryBusy=ref(false),entryStudentId=ref(''),entryTeamName=ref(''),entryTeamStudents=ref<string[]>([]),entryDeleteConfirm=ref(false),editingEntry=ref<any|null>(null)
const studentName=(id:string)=>{const s=students.value.find(v=>v.id===id);return s?[s.given_name,s.family_name].filter(Boolean).join(' '):'Unknown student'}
const entryMembers=(id:string)=>participants.value.filter(p=>p.entry_id===id).sort((a,b)=>(a.leg_order||0)-(b.leg_order||0)).map(p=>studentName(p.student_id))
const entryName=(e:any)=>e?(e.team_name||entryMembers(e.id).join(', ')||'Entry '+e.id.slice(0,8)):'Unknown entry'
const competitionSettings=computed(()=>competitions.value.find(c=>c.id===competitionId.value))
function studentEligibility(student:any):string[]{
 const issues:string[]=[]
 const c=competitionSettings.value,e=selectedEvent.value
 if(!c||!e)return issues
 const cutoff=c.age_cutoff_mode==='custom_date'&&c.age_cutoff_date?c.age_cutoff_date:`${c.school_year}-12-31`
 const age=student.date_of_birth?Number(cutoff.slice(0,4))-Number(student.date_of_birth.slice(0,4))-(cutoff.slice(5)<student.date_of_birth.slice(5)?1:0):null
 if((e.min_age!=null||e.max_age!=null||/^Under \\d+$/i.test(e.age_group||''))&&age===null)issues.push('Date of birth is required')
 if(age!==null){
  if(e.min_age!=null&&age<e.min_age)issues.push('Below minimum age '+e.min_age)
  if(e.max_age!=null&&age>e.max_age)issues.push('Above maximum age '+e.max_age)
  const under=/^Under (\\d+)$/i.exec(e.age_group||'')
  if(under&&age>=Number(under[1]))issues.push('Not eligible for '+e.age_group)
 }
 const year=/^Year (\\d+)$/i.exec(e.age_group||'')
 if(year&&String(student.year_level||'').replace(/^Year /i,'')!==year[1])issues.push('Not enrolled in '+e.age_group)
 if(e.age_group==='Prep'&&!['Prep','Foundation','0'].includes(String(student.year_level)))issues.push('Not enrolled in Prep')
 const division=(e.division||'').toLowerCase()
 const studentDivision=String(student.sporting_division||student.gender||'').toLowerCase()
 if(division==='boys'&&!['boys','boy','male','m'].includes(studentDivision))issues.push('Boys division eligibility not confirmed')
 if(division==='girls'&&!['girls','girl','female','f'].includes(studentDivision))issues.push('Girls division eligibility not confirmed')
 if(!student.house_id)issues.push('No house assigned')
 return issues
}
const availableStudents=computed(()=>students.value.filter(s=>!entries.value.some(e=>participants.value.some(p=>p.entry_id===e.id&&p.student_id===s.id&&e.id!==editingEntry.value?.id))))
const eligibleStudents=computed(()=>availableStudents.value.filter(s=>!studentEligibility(s).length))
const ineligibleStudents=computed(()=>availableStudents.value.filter(s=>studentEligibility(s).length))
async function loadStudents(){
 students.value=[]
 if(!schoolId.value||!competitionId.value)return
 const competition=competitions.value.find(c=>c.id===competitionId.value)
 const year=competition?.school_year||new Date().getFullYear()
 const {data,error:e}=await db.from('student_enrolments').select('student_id,house_id,year_level,students(id,given_name,family_name,is_active,date_of_birth,gender,sporting_division)').eq('school_id',schoolId.value).eq('school_year',year)
 if(e)throw e
 students.value=(data||[]).filter((v:any)=>v.students?.is_active).map((v:any)=>({...v.students,house_id:v.house_id,year_level:v.year_level})).sort((a:any,b:any)=>a.family_name.localeCompare(b.family_name))
}
async function loadParticipants(){
 participants.value=[]
 if(!entries.value.length)return
 const {data,error:e}=await db.from('entry_participants').select('entry_id,student_id,leg_order').in('entry_id',entries.value.map(e=>e.id))
 if(e)throw e
 participants.value=data||[]
}
function openEntry(entry:any=null){
 editingEntry.value=entry
 entryStudentId.value=entry&&!selectedEvent.value?.is_team?entryMembers(entry.id).length?participants.value.find(p=>p.entry_id===entry.id)?.student_id||'':'':''
 entryTeamStudents.value=entry?participants.value.filter(p=>p.entry_id===entry.id).sort((a,b)=>(a.leg_order||0)-(b.leg_order||0)).map(p=>p.student_id):[]
 entryTeamName.value=entry?.team_name||''
 entryConfirm.value=false;entryDeleteConfirm.value=false;entryDialog.value=true;error.value=''
}
function askEntrySave(){
 if(selectedEvent.value?.is_team){
  if(!entryTeamName.value.trim()||!entryTeamStudents.value.length){error.value='Enter a team name and select at least one student';return}
 }else if(!entryStudentId.value){error.value='Select a student';return}
 error.value='';entryConfirm.value=true
}
async function saveEntry(){
 if(entryBusy.value||!eventId.value)return
 entryBusy.value=true;entryConfirm.value=false;error.value=''
 try{
  const ids=selectedEvent.value?.is_team?entryTeamStudents.value:[entryStudentId.value]
  for(const id of ids){const student=students.value.find(s=>s.id===id);if(student&&studentEligibility(student).length)throw new Error(studentName(id)+': '+studentEligibility(student).join('; '))}
  if(!ids.length||ids.some(id=>!students.value.some(s=>s.id===id)))throw new Error('Select valid enrolled students')
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate student in team')
  const assigned=students.value.filter(s=>ids.includes(s.id))
  if(selectedEvent.value?.max_participants!=null&&!editingEntry.value&&entries.value.length>=selectedEvent.value.max_participants)throw new Error('Event has reached its participant limit')
  const houseIds=[...new Set(assigned.map(s=>s.house_id))]
  if(houseIds.length!==1||!houseIds[0])throw new Error('All participants must be assigned to the same house')
  if(entries.value.some(e=>e.id!==editingEntry.value?.id&&participants.value.some(p=>p.entry_id===e.id&&ids.includes(p.student_id))))throw new Error('A student is already registered for this event')
  const payload={competition_event_id:eventId.value,school_id:schoolId.value,house_id:houseIds[0],team_name:selectedEvent.value?.is_team?entryTeamName.value.trim():null}
  let id=editingEntry.value?.id
  if(id){
   const {error:e}=await db.from('event_entries').update(payload).eq('id',id)
   if(e)throw e
   const {error:de}=await db.from('entry_participants').delete().eq('entry_id',id)
   if(de)throw de
  }else{
   const {data,error:e}=await db.from('event_entries').insert(payload).select('id').single()
   if(e)throw e
   id=data.id
  }
  const {error:pe}=await db.from('entry_participants').insert(ids.map((student_id,i)=>({entry_id:id,student_id,leg_order:i+1})))
  if(pe)throw pe
  entryDialog.value=false;await loadRounds();notice.value='Participant registration saved'
 }catch(e:any){error.value=e.message||'Unable to save participant registration'}
 finally{entryBusy.value=false}
}
async function deleteEntry(){
 if(!editingEntry.value||entryBusy.value)return
 entryBusy.value=true;entryDeleteConfirm.value=false;error.value=''
 try{
  const {count,error:e}=await db.from('event_results').select('id',{count:'exact',head:true}).eq('entry_id',editingEntry.value.id)
  if(e)throw e
  if(count)throw new Error('This entry has results. Remove those results before deleting the registration.')
  const {error:de}=await db.from('event_entries').delete().eq('id',editingEntry.value.id)
  if(de)throw de
  entryDialog.value=false;await loadRounds();notice.value='Registration deleted'
 }catch(e:any){error.value=e.message||'Unable to delete registration'}finally{entryBusy.value=false}
}
const roundDialog=ref(false),roundConfirm=ref(false),roundDeleteConfirm=ref(false),roundBusy=ref(false)
const editingRound=ref<any|null>(null)
const roundForm=reactive({name:'',round_order:'1'})
function openRound(r:any=null){
 editingRound.value=r
 roundForm.name=r?.name||'Final'
 roundForm.round_order=String(r?.round_order??(rounds.value.length+1))
 roundConfirm.value=false;roundDeleteConfirm.value=false;roundDialog.value=true;error.value=''
}
function requestRoundSave(){
 if(!roundForm.name.trim()||roundForm.name.trim().length>80){error.value='Round name must be 1 to 80 characters';return}
 if(!Number.isInteger(Number(roundForm.round_order))||Number(roundForm.round_order)<1){error.value='Round order must be a positive whole number';return}
 error.value='';roundConfirm.value=true
}
async function saveRound(){
 if(!eventId.value||roundBusy.value)return
 roundBusy.value=true;roundConfirm.value=false;error.value=''
 try{
  const payload={name:roundForm.name.trim(),round_order:Number(roundForm.round_order)}
  const r=editingRound.value
   ?await db.from('event_rounds').update(payload).eq('id',editingRound.value.id).eq('competition_event_id',eventId.value).select('id').single()
   :await db.from('event_rounds').insert({...payload,competition_event_id:eventId.value}).select('id').single()
  if(r.error)throw r.error
  const savedId=r.data.id
  roundDialog.value=false
  await loadRounds()
  roundId.value=savedId
  await loadResults()
  notice.value=editingRound.value?'Round updated':'Round created'
 }catch(e:any){error.value=e.message||'Unable to save round'}
 finally{roundBusy.value=false}
}
async function deleteRound(){
 if(!editingRound.value||roundBusy.value)return
 roundBusy.value=true;roundDeleteConfirm.value=false;error.value=''
 try{
  const {count,error:countError}=await db.from('event_results').select('id',{count:'exact',head:true}).eq('round_id',editingRound.value.id)
  if(countError)throw countError
  if(count){throw new Error('This round has recorded results. Remove or relocate those results before deleting the round.')}
  const {error:e}=await db.from('event_rounds').delete().eq('id',editingRound.value.id).eq('competition_event_id',eventId.value)
  if(e)throw e
  roundDialog.value=false;await loadRounds();notice.value='Round deleted'
 }catch(e:any){error.value=e.message||'Unable to delete round'}
 finally{roundBusy.value=false}
}
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
   query('competitions','id,name,status,organiser_school_id,school_year,age_cutoff_mode,age_cutoff_date,max_events_per_student','organiser_school_id',schoolId.value),
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
   query('competition_events','id,competition_id,age_group,division,is_team,min_age,max_age,max_participants,event_definitions(name)','competition_id',competitionId.value),
   query('competition_house_totals','competition_id,school_id,house_id,total_points,scored_results','competition_id',competitionId.value)
  ])
  events.value=e;totals.value=t.filter((v:any)=>v.school_id===schoolId.value)
  await loadStudents()
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
  await loadParticipants()
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
  <div v-if="eventId" class="mt-4 flex flex-wrap items-center gap-2">
   <button type="button" aria-label="Add round" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" @click="openRound()">+ Add round</button>
   <button v-if="!rounds.length" type="button" aria-label="Create final round" class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold" @click="openRound()">Create single Final</button>
   <button v-if="selectedRound" type="button" aria-label="Edit selected round" class="rounded-lg border border-[var(--border)] px-3 py-2 text-blue-500" @click="openRound(selectedRound)">✎ Edit round</button>
  </div>
  <p v-if="!loading&&eventId&&!rounds.length" class="mt-4 text-sm text-[var(--muted)]">No rounds yet. Create a Final for a single-round event, or add Heat 1, Heat 2 and Final separately.</p>
 </UiPanel>
 <UiPanel v-if="eventId">
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 class="text-xl font-bold">Event registrations ({{entries.length}})</h2><button type="button" aria-label="Register participant" class="rounded-lg bg-blue-600 px-4 py-2 text-white" @click="openEntry()">+ Register {{selectedEvent?.is_team?'team':'student'}}</button></div>
  <p v-if="!entries.length" class="text-sm text-[var(--muted)]">No participants registered. Register students or teams to enter results.</p>
  <div v-for="e in entries" :key="e.id" class="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3"><div><strong>{{entryName(e)}}</strong><p class="text-xs text-[var(--muted)]">{{houseName(e.house_id)}}<span v-if="selectedEvent?.is_team"> · {{entryMembers(e.id).join(', ')}}</span></p></div><button type="button" :aria-label="'Edit registration '+entryName(e)" class="rounded-lg border border-[var(--border)] px-3 py-2 text-blue-500" @click="openEntry(e)">✎</button></div>
 </UiPanel>
 <div v-if="roundId" class="grid gap-6 lg:grid-cols-2">
  <UiPanel>
   <h2 class="mb-4 text-xl font-bold">Record a result</h2>
   <p v-if="!entries.length" class="text-[var(--muted)]">No participants are registered for this event yet.</p>
   <form v-else class="space-y-4" @submit.prevent="askSave">
    <label class="block font-semibold">Participant / team<select v-model="form.entry_id" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" required @change="editEntry(entries.find(e=>e.id===form.entry_id))"><option value="">Select participant</option><option v-for="e in entries" :key="e.id" :value="e.id">{{entryName(e)}} — {{houseName(e.house_id)}}</option></select></label>
    <label class="block font-semibold">Placing<input v-model="form.placing_position" type="number" min="1" step="1" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block font-semibold">Performance (stored measurement value)<input v-model="form.performance_value" type="number" min="0" step="1" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block font-semibold">Status<select v-model="form.status" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="valid">Valid</option><option value="dns">Did not start</option><option value="dnf">Did not finish</option><option value="dq">Disqualified</option></select></label>
    <label class="flex items-center gap-3"><input v-model="form.published" type="checkbox" class="h-5 w-5"/> Publish result and award points</label>
    <div class="flex justify-end"><button type="submit" aria-label="Save result" class="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white" :disabled="busy">Save result</button></div>
   </form>
  </UiPanel>
  <UiPanel><h2 class="mb-4 text-xl font-bold">Round results</h2><div v-if="!results.length" class="text-[var(--muted)]">No results recorded.</div><div v-for="r in results" :key="r.id" class="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3"><div><strong>{{r.placing_position||'—'}} · {{entryName(entries.find(e=>e.id===r.entry_id))}}</strong><p class="text-xs text-[var(--muted)]">{{r.published_at?'Published':'Draft'}} · {{r.status}}</p></div><div class="flex items-center gap-3"><strong>{{r.points||0}} pts</strong><button type="button" :aria-label="'Edit result for '+r.entry_id" class="rounded-lg border border-[var(--border)] px-3 py-2 text-blue-500" @click="editEntry(entries.find(e=>e.id===r.entry_id))">✎</button></div></div></UiPanel>
 </div>
 <UiPanel v-if="competitionId"><h2 class="mb-4 text-xl font-bold">House leaderboard</h2><p v-if="!orderedTotals.length" class="text-[var(--muted)]">House points will appear when valid results are published.</p><div v-for="(t,i) in orderedTotals" :key="t.house_id" class="flex items-center justify-between border-b border-[var(--border)] py-3"><div class="flex items-center gap-3"><strong>{{i+1}}</strong><span class="h-4 w-4 rounded-full" :style="{background:houses.find(h=>h.id===t.house_id)?.colour||'#64748b'}"/><span>{{houseName(t.house_id)}}</span></div><strong>{{t.total_points}} points</strong></div></UiPanel>
 <div v-if="entryDialog" class="fixed inset-0 z-[65] grid place-items-center bg-black/65 p-4"><section role="dialog" aria-modal="true" aria-label="Participant registration" class="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
  <h2 class="mb-4 text-xl font-bold">{{editingEntry?'Edit':'Register'}} {{selectedEvent?.is_team?'team':'student'}}</h2>
  <form class="space-y-4" @submit.prevent="askEntrySave">
   <template v-if="selectedEvent?.is_team"><label class="block font-semibold">Team name<input v-model="entryTeamName" required maxlength="100" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <p class="text-sm text-[var(--muted)]">Select students from the same house.</p><div class="max-h-56 space-y-2 overflow-auto rounded-lg border border-[var(--border)] p-3"><label v-for="s in eligibleStudents" :key="s.id" class="flex items-center gap-3"><input v-model="entryTeamStudents" type="checkbox" :value="s.id"/>{{studentName(s.id)}} · {{houseName(s.house_id)}}</label></div>
   </template>
   <label v-else class="block font-semibold">Student<select v-model="entryStudentId" required class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="">Select student</option><option v-for="s in availableStudents" :key="s.id" :value="s.id">{{studentName(s.id)}} · {{houseName(s.house_id)}}</option></select></label>
   <p v-if="ineligibleStudents.length" class="text-sm text-[var(--muted)]">{{ineligibleStudents.length}} students are unavailable because they do not meet the event eligibility checks.</p><div class="flex justify-between gap-3"><button v-if="editingEntry" type="button" aria-label="Delete registration" class="rounded-lg border border-red-500 px-3 py-2 text-red-500" @click="entryDeleteConfirm=true">Delete</button><span v-else/><div class="flex gap-2"><button type="button" aria-label="Cancel registration" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="entryDialog=false">Cancel</button><button type="submit" aria-label="Save registration" :disabled="entryBusy" class="rounded-lg bg-blue-600 px-4 py-2 text-white">Save</button></div></div>
  </form>
 </section></div>
 <div v-if="entryConfirm||entryDeleteConfirm" class="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"><h2 class="text-xl font-bold">{{entryDeleteConfirm?'Delete registration?':'Save registration?'}}</h2><p class="mt-3 text-[var(--muted)]">{{entryDeleteConfirm?'This will remove the entry and its participants.':'Confirm this event registration.'}}</p><div class="mt-6 flex justify-end gap-3"><button type="button" aria-label="Cancel confirmation" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="entryConfirm=false;entryDeleteConfirm=false">Cancel</button><button type="button" :aria-label="entryDeleteConfirm?'Confirm delete registration':'Confirm save registration'" :disabled="entryBusy" class="rounded-lg px-4 py-2 text-white" :class="entryDeleteConfirm?'bg-red-600':'bg-blue-600'" @click="entryDeleteConfirm?deleteEntry():saveEntry()">{{entryDeleteConfirm?'Delete':'Save'}}</button></div></section></div>
 <div v-if="roundDialog" class="fixed inset-0 z-[65] grid place-items-center bg-black/65 p-4"><section role="dialog" aria-modal="true" aria-label="Round settings" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
  <h2 class="mb-4 text-xl font-bold">{{editingRound?'Edit round':'Add round'}}</h2>
  <form class="space-y-4" @submit.prevent="requestRoundSave">
   <label class="block font-semibold">Round name<input v-model="roundForm.name" maxlength="80" required class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" placeholder="Final or Heat 1"/></label>
   <label class="block font-semibold">Round order<input v-model="roundForm.round_order" type="number" min="1" step="1" required class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   <div class="flex justify-between gap-2">
    <button v-if="editingRound" type="button" aria-label="Delete round" class="rounded-lg border border-red-500 px-3 py-2 text-red-500" @click="roundDeleteConfirm=true">Delete</button>
    <span v-else/>
    <div class="flex gap-2"><button type="button" aria-label="Cancel round changes" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="roundDialog=false">Cancel</button><button type="submit" aria-label="Save round" class="rounded-lg bg-blue-600 px-4 py-2 text-white" :disabled="roundBusy">Save</button></div>
   </div>
  </form>
 </section></div>
 <div v-if="roundConfirm||roundDeleteConfirm" class="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-2xl">
  <h2 class="text-xl font-bold">{{roundDeleteConfirm?'Delete round?':'Save round?'}}</h2>
  <p class="mt-3 text-[var(--muted)]">{{roundDeleteConfirm?'Delete '+roundForm.name+'? This cannot be undone.':'Save '+roundForm.name+' for this event?'}}</p>
  <div class="mt-6 flex justify-end gap-3"><button type="button" aria-label="Cancel confirmation" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="roundConfirm=false;roundDeleteConfirm=false">Cancel</button><button type="button" :aria-label="roundDeleteConfirm?'Confirm delete round':'Confirm save round'" :disabled="roundBusy" class="rounded-lg px-4 py-2 text-white" :class="roundDeleteConfirm?'bg-red-600':'bg-blue-600'" @click="roundDeleteConfirm?deleteRound():saveRound()">{{roundDeleteConfirm?'Delete':'Save'}}</button></div>
 </section></div>
 <div v-if="confirm" class="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"><h2 class="text-xl font-bold">Save result?</h2><p class="mt-3 text-[var(--muted)]">Confirm {{form.published?'publishing this result and awarding points':'saving this result as a draft'}}.</p><div class="mt-6 flex justify-end gap-3"><button type="button" aria-label="Cancel" class="rounded-xl border border-[var(--border)] px-4 py-2" @click="confirm=false">Cancel</button><button type="button" aria-label="Confirm save" :disabled="busy" class="rounded-xl bg-blue-600 px-4 py-2 text-white" @click="save">Confirm save</button></div></section></div>
</div>
</template>
