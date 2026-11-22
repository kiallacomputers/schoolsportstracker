<script setup lang="ts">
const props=withDefaults(defineProps<{initialCompetitionId?:string}>(),{initialCompetitionId:''})
const db=useSupabaseClient()
const {schoolId}=useSchool()
const competitions=ref<any[]>([]),events=ref<any[]>([]),entries=ref<any[]>([]),houses=ref<any[]>([])
const competitionId=ref(''),eventId=ref('')
const loading=ref(false),error=ref(''),notice=ref('')
const students=ref<any[]>([]),participants=ref<any[]>([]),entryDialog=ref(false),entryConfirm=ref(false),entryBusy=ref(false),entryStudentId=ref(''),entryStudentIds=ref<string[]>([]),entrySearch=ref(''),entryTeamName=ref(''),entryTeamStudents=ref<string[]>([]),entryDeleteConfirm=ref(false),editingEntry=ref<any|null>(null)
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
const filteredEligibleStudents=computed(()=>eligibleStudents.value.filter(s=>studentName(s.id).toLowerCase().includes(entrySearch.value.trim().toLowerCase())))
const remainingSlots=computed(()=>selectedEvent.value?.max_participants==null?null:Math.max(0,selectedEvent.value.max_participants-entries.value.length))
function toggleAllVisible(){
 const ids=filteredEligibleStudents.value.map(s=>s.id)
 const all=ids.length>0&&ids.every(id=>entryStudentIds.value.includes(id))
 entryStudentIds.value=all?entryStudentIds.value.filter(id=>!ids.includes(id)):[...new Set([...entryStudentIds.value,...ids])]
}
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
 entryStudentIds.value=[];entrySearch.value=''
 entryConfirm.value=false;entryDeleteConfirm.value=false;entryDialog.value=true;error.value=''
}
function askEntrySave(){
 if(selectedEvent.value?.is_team){
  if(!entryTeamName.value.trim()||!entryTeamStudents.value.length){error.value='Enter a team name and select at least one student';return}
 }else if(!(editingEntry.value?entryStudentId.value:entryStudentIds.value.length)){error.value='Select at least one student';return}
 error.value='';entryConfirm.value=true
}
async function saveEntry(){
 if(entryBusy.value||!eventId.value||!canRegister.value)return
 entryBusy.value=true;entryConfirm.value=false;error.value=''
 try{
  const ids=selectedEvent.value?.is_team?entryTeamStudents.value:editingEntry.value?[entryStudentId.value]:entryStudentIds.value
  for(const id of ids){const student=students.value.find(s=>s.id===id);if(student&&studentEligibility(student).length)throw new Error(studentName(id)+': '+studentEligibility(student).join('; '))}
  if(!ids.length||ids.some(id=>!students.value.some(s=>s.id===id)))throw new Error('Select valid enrolled students')
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate student in team')
  const assigned=students.value.filter(s=>ids.includes(s.id))
  if(selectedEvent.value?.max_participants!=null&&!editingEntry.value&&entries.value.length+(selectedEvent.value.is_team?1:ids.length)>selectedEvent.value.max_participants)throw new Error('Event has reached its participant limit')
  const houseIds=[...new Set(assigned.map(s=>s.house_id))]
  if(houseIds.includes(null)||houseIds.includes(undefined)||!houseIds.length)throw new Error('Every participant needs a house')
  if(selectedEvent.value?.is_team&&houseIds.length!==1)throw new Error('All team members must be assigned to the same house')
  if(entries.value.some(e=>e.id!==editingEntry.value?.id&&participants.value.some(p=>p.entry_id===e.id&&ids.includes(p.student_id))))throw new Error('A student is already registered for this event')
  if(!selectedEvent.value?.is_team&&!editingEntry.value){
   let completed=0
   const failures:string[]=[]
   for(const student of assigned){
    const {data,error:e}=await db.from('event_entries').insert({competition_event_id:eventId.value,school_id:schoolId.value,house_id:student.house_id,team_name:null}).select('id').single()
    if(e){failures.push(studentName(student.id)+': '+e.message);continue}
    const {error:pe}=await db.from('entry_participants').insert({entry_id:data.id,student_id:student.id,leg_order:1})
    if(pe){
     const {error:cleanupError}=await db.from('event_entries').delete().eq('id',data.id)
     failures.push(studentName(student.id)+': '+pe.message+(cleanupError?' (cleanup failed: '+cleanupError.message+')':''))
    }else completed++
   }
   await loadEntries()
   if(failures.length)throw new Error(completed+' registered; '+failures.length+' failed. '+failures.join(' | '))
   entryDialog.value=false
   notice.value=completed+' students registered successfully'
   return
  }
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
  entryDialog.value=false;await loadEntries();notice.value='Participant registration saved'
 }catch(e:any){error.value=e.message||'Unable to save participant registration'}
 finally{entryBusy.value=false}
}
async function deleteEntry(){
 if(!editingEntry.value||entryBusy.value||!canRegister.value)return
 entryBusy.value=true;entryDeleteConfirm.value=false;error.value=''
 try{
  const {count,error:e}=await db.from('event_results').select('id',{count:'exact',head:true}).eq('entry_id',editingEntry.value.id)
  if(e)throw e
  if(count)throw new Error('This entry has results. Remove those results before deleting the registration.')
  const {error:de}=await db.from('event_entries').delete().eq('id',editingEntry.value.id)
  if(de)throw de
  entryDialog.value=false;await loadEntries();notice.value='Registration deleted'
 }catch(e:any){error.value=e.message||'Unable to delete registration'}finally{entryBusy.value=false}
}

const selectedEvent=computed(()=>events.value.find(e=>e.id===eventId.value))
const canRegister=computed(()=>competitionSettings.value?.status==='registration')
const houseName=(id:string)=>houses.value.find(h=>h.id===id)?.name||'Unassigned'
const eventLabel=(e:any)=>[e.event_definitions?.name||'Event',e.age_group,e.division].filter(Boolean).join(' · ')
async function loadCompetitions(){
 error.value='';competitionId.value='';eventId.value='';entries.value=[];events.value=[]
 if(!schoolId.value)return
 loading.value=true
 try{
  const [c,h]=await Promise.all([
   db.from('competitions').select('id,name,status,organiser_school_id,school_year,age_cutoff_mode,age_cutoff_date,max_events_per_student').eq('organiser_school_id',schoolId.value),
   db.from('school_houses').select('id,name,colour').eq('school_id',schoolId.value)
  ])
  if(c.error||h.error)throw c.error||h.error
  competitions.value=(c.data||[]).filter((v:any)=>['draft','registration','active','completed'].includes(v.status))
  houses.value=h.data||[]
  const eligible=competitions.value.filter(c=>c.status==='registration')
  if(props.initialCompetitionId&&competitions.value.some(c=>c.id===props.initialCompetitionId)){competitionId.value=props.initialCompetitionId;await loadEvents()}
  else if(eligible.length===1){competitionId.value=eligible[0].id;await loadEvents()}
 }catch(e:any){error.value=e.message||'Unable to load competitions'}finally{loading.value=false}
}
async function loadEvents(){
 eventId.value='';entries.value=[];events.value=[];students.value=[]
 if(!competitionId.value)return
 loading.value=true
 try{
  const {data,error:e}=await db.from('competition_events').select('id,competition_id,age_group,division,is_team,min_age,max_age,max_participants,event_definitions(name,measurement)').eq('competition_id',competitionId.value)
  if(e)throw e
  events.value=data||[]
  await loadStudents()
 }catch(e:any){error.value=e.message||'Unable to load events'}finally{loading.value=false}
}
async function loadEntries(){
 entries.value=[];participants.value=[]
 if(!eventId.value)return
 loading.value=true
 try{
  const {data,error:e}=await db.from('event_entries').select('id,house_id,team_name,school_id').eq('competition_event_id',eventId.value)
  if(e)throw e
  entries.value=(data||[]).filter((v:any)=>v.school_id===schoolId.value)
  await loadParticipants()
 }catch(e:any){error.value=e.message||'Unable to load registrations'}finally{loading.value=false}
}
watch(schoolId,loadCompetitions,{immediate:true})
</script>
<template><div class="space-y-5">
<header><h1 class="text-3xl font-extrabold">Registrations</h1><p class="mt-2 text-[var(--muted)]">Stage 2 · Register students and teams before activating the competition.</p></header>
<p v-if="error" role="alert" class="rounded-lg border border-red-400 p-3 text-red-600">{{error}}</p><p v-if="notice" role="status" class="rounded-lg border border-green-400 p-3 text-green-700">{{notice}}</p>
<UiPanel><div class="grid gap-3 md:grid-cols-2">
<label class="text-sm font-semibold">Competition<select v-model="competitionId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadEvents"><option value="">Choose competition</option><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} · {{c.status}}</option></select></label>
<label v-if="competitionId" class="text-sm font-semibold">Event<select v-model="eventId" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3" @change="loadEntries"><option value="">Choose event</option><option v-for="e in events" :key="e.id" :value="e.id">{{eventLabel(e)}}</option></select></label>
</div><p v-if="competitionId&&!canRegister" class="mt-3 text-sm text-amber-700">Registrations are locked while the competition is {{competitionSettings?.status}}. Only competitions in Registrations can be edited.</p><p v-if="loading" class="mt-3 text-sm">Loading…</p></UiPanel>
<UiPanel v-if="eventId"><div class="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-bold">Registered competitors ({{entries.length}})</h2><button v-if="canRegister" type="button" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" @click="openEntry()">+ Register {{selectedEvent?.is_team?'team':'students'}}</button></div>
<p v-if="!entries.length" class="text-sm text-[var(--muted)]">No registrations for this event.</p>
<div v-for="e in entries" :key="e.id" class="flex items-center justify-between gap-2 border-b border-[var(--border)] py-2"><div><strong>{{entryName(e)}}</strong><p class="text-xs text-[var(--muted)]">{{houseName(e.house_id)}}</p></div><button v-if="canRegister" type="button" class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-blue-500" :aria-label="'Edit '+entryName(e)" @click="openEntry(e)">✎</button></div></UiPanel>
<div v-if="entryDialog" class="fixed inset-0 z-[65] grid place-items-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-label="Register competitors" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-5 text-[var(--ink)] shadow-xl"><h2 class="mb-4 text-xl font-bold">{{editingEntry?'Edit':'Register'}} {{selectedEvent?.is_team?'team':'students'}}</h2><form class="space-y-3" @submit.prevent="askEntrySave">
<template v-if="selectedEvent?.is_team"><label class="block text-sm font-semibold">Team name<input v-model="entryTeamName" required class="mt-1 w-full rounded-lg border p-2"/></label><p class="text-xs">Select students from the same house.</p><div class="max-h-52 overflow-y-auto"><label v-for="s in eligibleStudents" :key="s.id" class="flex gap-2 py-1 text-sm"><input v-model="entryTeamStudents" type="checkbox" :value="s.id"/>{{studentName(s.id)}} · {{houseName(s.house_id)}}</label></div></template>
<template v-else-if="editingEntry"><label class="block text-sm font-semibold">Student<select v-model="entryStudentId" class="mt-1 w-full rounded-lg border p-2"><option value="">Select student</option><option v-for="s in eligibleStudents" :key="s.id" :value="s.id">{{studentName(s.id)}}</option></select></label></template>
<template v-else><label class="block text-sm font-semibold">Search<input v-model="entrySearch" type="search" class="mt-1 w-full rounded-lg border p-2"/></label><div class="flex items-center justify-between text-xs"><span>{{entryStudentIds.length}} selected</span><button type="button" class="text-blue-500" @click="toggleAllVisible">Select / deselect visible</button></div><div class="max-h-56 overflow-y-auto"><label v-for="s in filteredEligibleStudents" :key="s.id" class="flex gap-2 py-1 text-sm"><input v-model="entryStudentIds" type="checkbox" :value="s.id"/>{{studentName(s.id)}} · {{houseName(s.house_id)}}</label></div></template>
<p v-if="ineligibleStudents.length" class="text-xs text-[var(--muted)]">{{ineligibleStudents.length}} students excluded by eligibility checks.</p><div class="flex justify-between"><button v-if="editingEntry" type="button" class="rounded-lg border border-red-500 px-3 py-2 text-red-600" @click="entryDeleteConfirm=true">Delete</button><span v-else/><div class="flex gap-2"><button type="button" class="rounded-lg border px-3 py-2" @click="entryDialog=false">Cancel</button><button type="submit" class="rounded-lg bg-blue-600 px-3 py-2 text-white">Save</button></div></div></form></section></div>
<div v-if="entryConfirm||entryDeleteConfirm" class="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-xl bg-[var(--surface)] p-5"><h2 class="text-lg font-bold">{{entryDeleteConfirm?'Delete registration?':'Save registration?'}}</h2><p class="mt-2 text-sm">Confirm this change to the event registrations.</p><div class="mt-4 flex justify-end gap-2"><button type="button" class="rounded-lg border px-3 py-2" @click="entryConfirm=false;entryDeleteConfirm=false">Cancel</button><button type="button" class="rounded-lg bg-blue-600 px-3 py-2 text-white" :disabled="entryBusy" @click="entryDeleteConfirm?deleteEntry():saveEntry()">Confirm</button></div></section></div>
</div></template>