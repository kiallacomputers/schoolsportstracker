<script setup lang="ts">
definePageMeta({layout:'workspace'})
const db=useSupabaseClient()
const {schoolId}=useSchool()
const definitions=ref<any[]>([]),records=ref<any[]>([]),candidates=ref<any[]>([]),schoolEvents=ref<any[]>([])
const selectedDefinition=ref(''),ageGroup=ref(''),division=ref(''),holder=ref(''),value=ref(''),achieved=ref('')
const busy=ref(false),error=ref(''),notice=ref(''),confirm=ref(false),recordScope=ref('SR')
const definition=computed(()=>definitions.value.find(d=>d.id===selectedDefinition.value))
const availableDefinitions=computed(()=>definitions.value.filter(d=>schoolEvents.value.some(e=>e.event_definition_id===d.id)))
const availableAges=computed(()=>[...new Set(schoolEvents.value.filter(e=>e.event_definition_id===selectedDefinition.value).map(e=>e.age_group||''))].sort())
const availableDivisions=computed(()=>[...new Set(schoolEvents.value.filter(e=>e.event_definition_id===selectedDefinition.value&&(e.age_group||'')===ageGroup.value).map(e=>e.division||''))].sort())
function selectFirstAge(){if(!availableAges.value.includes(ageGroup.value))ageGroup.value=availableAges.value[0]||'';selectFirstDivision()}
function selectFirstDivision(){if(!availableDivisions.value.includes(division.value))division.value=availableDivisions.value[0]||''}
const selectedRecordContext=computed(()=>[definition.value?.name,ageGroup.value||'All ages',division.value||'All divisions',recordScope.value].filter(Boolean).join(' · '))
const orderedRecords=computed(()=>[...records.value].sort((a,b)=>String(a.event_definition_id).localeCompare(String(b.event_definition_id))||String(a.age_group).localeCompare(String(b.age_group))||String(a.division).localeCompare(String(b.division))))
const current=computed(()=>records.value.find(r=>r.event_definition_id===selectedDefinition.value&&r.age_group===ageGroup.value&&r.division===division.value&&r.record_scope===recordScope.value))
const timeBased=computed(()=>definition.value?.measurement?.startsWith('time'))
const format=(v:number)=>definition.value?.measurement==='distance_mm'?(v/1000).toFixed(3)+' m':definition.value?.measurement==='time_ms'?(v/1000).toFixed(3)+' s':String(v)
const matching=computed(()=>candidates.value.filter(r=>r.competition_type===(recordScope.value==='ISR'?'inter_school':'intra_school')&&r.event_definition_id===selectedDefinition.value&&r.age_group===ageGroup.value&&r.division===division.value&&r.status==='valid'&&r.published_at&&r.performance_value>0))
const improved=computed(()=>current.value?matching.value.filter(r=>timeBased.value?r.performance_value<current.value.performance_value:r.performance_value>current.value.performance_value).sort((a,b)=>timeBased.value?a.performance_value-b.performance_value:b.performance_value-a.performance_value):[])
function downloadRecordCsvTemplate(){
 const columns=['record_type','event','age_group','division','performance','holder_name','achieved_on','notes']
 const csv=columns.join(',')+'\r\n'+'SR,100m Spirit,Under 13,Boys,0:14:52,John Smith,2025-03-15,Example record - delete before importing'+'\r\n'+'ISR,100m Spirit,Under 13,Boys,0:13:85,Jane Example,2025-04-10,Example ISR record - delete before importing'+'\r\n'
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}))
 const link=document.createElement('a')
 link.href=url;link.download='sportstracker-school-records-template.csv'
 document.body.appendChild(link);link.click();link.remove()
 URL.revokeObjectURL(url)
}
function resetForm(){holder.value=current.value?.holder_name||'';value.value=String(current.value?.performance_value||'');achieved.value=current.value?.achieved_on||''}
async function load(){
 if(!schoolId.value)return
 busy.value=true;error.value=''
 try{
  const [d,r,c]=await Promise.all([
   db.from('event_definitions').select('id,name,measurement').order('name'),
   db.from('school_records').select('*').eq('school_id',schoolId.value),
   db.from('competition_events').select('id,event_definition_id,age_group,division,competitions!inner(organiser_school_id,competition_type),event_rounds(id,event_results(id,status,published_at,performance_value,entry_id,event_entries(team_name,entry_participants(student_id,students(given_name,family_name)))))').eq('competitions.organiser_school_id',schoolId.value)
  ])
  for(const q of [d,r,c])if(q.error)throw q.error
  definitions.value=d.data||[];records.value=r.data||[];schoolEvents.value=c.data||[]
  candidates.value=(c.data||[]).flatMap((e:any)=>(e.event_rounds||[]).flatMap((round:any)=>(round.event_results||[]).map((result:any)=>({...result,event_definition_id:e.event_definition_id,age_group:e.age_group||'',division:e.division||'',competition_type:e.competitions?.competition_type,holder_name:result.event_entries?.team_name||(result.event_entries?.entry_participants||[]).map((p:any)=>[p.students?.given_name,p.students?.family_name].filter(Boolean).join(' ')).join(', ')||'Unknown student'}))))
  if(!availableDefinitions.value.some(d=>d.id===selectedDefinition.value))selectedDefinition.value=availableDefinitions.value[0]?.id||''
  selectFirstAge()
  resetForm()
 }catch(e:any){error.value=e.message||'Unable to load school records'}finally{busy.value=false}
}
function reviewCandidate(r:any){holder.value=r.holder_name;value.value=String(r.performance_value);achieved.value=new Date().toISOString().slice(0,10);confirm.value=true}
async function save(){
 if(busy.value||!schoolId.value||!selectedDefinition.value)return
 busy.value=true;error.value='';notice.value=''
 try{
  if(!ageGroup.value||!division.value||!schoolEvents.value.some(e=>e.event_definition_id===selectedDefinition.value&&e.age_group===ageGroup.value&&e.division===division.value))throw new Error('Select a configured event, age group and division before saving the record')
  const n=Number(value.value)
  if(!holder.value.trim()||!Number.isSafeInteger(n)||n<=0)throw new Error('Enter a holder and a positive whole-number performance')
  const {error:e}=await db.from('school_records').upsert({school_id:schoolId.value,event_definition_id:selectedDefinition.value,age_group:ageGroup.value,division:division.value,record_scope:recordScope.value,holder_name:holder.value.trim(),performance_value:n,achieved_on:achieved.value||null},{onConflict:'school_id,event_definition_id,age_group,division,record_scope'})
  if(e)throw e
  confirm.value=false;await load();notice.value='School record saved'
 }catch(e:any){error.value=e.message||'Unable to save record'}finally{busy.value=false}
}
watch(schoolId,load,{immediate:true})
watch(selectedDefinition,selectFirstAge)
watch(ageGroup,selectFirstDivision)
watch([selectedDefinition,ageGroup,division,recordScope],resetForm)
</script>
<template>
<div class="space-y-6">
 <UiPageHeader title="School Records" description="Maintain historical baselines; publishing results automatically updates verified records."/>
 <div class="flex flex-col items-start gap-2"><button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" @click="downloadRecordCsvTemplate">Download CSV template</button><span class="max-w-3xl break-words text-sm text-[var(--muted)]">Use SR or ISR for record_type. Enter race times as M:SS:HH, dates as YYYY-MM-DD, and one record per row.</span></div>
 <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-700">{{error}}</p>
 <p v-if="notice" role="status" class="text-green-600">{{notice}}</p>
 <UiPanel>
  <p class="mb-3 text-sm text-[var(--muted)]">Event, age group and division are populated from competitions configured for this school.</p>
  <div class="grid gap-4 md:grid-cols-4">
   <label class="text-sm font-semibold">Record type<select v-model="recordScope" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="SR">SR — School Record</option><option value="ISR">ISR — Inter-School Record</option></select></label>
   <label class="text-sm font-semibold">Event<select v-model="selectedDefinition" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option v-for="d in availableDefinitions" :key="d.id" :value="d.id">{{d.name}}</option></select></label>
   <label class="text-sm font-semibold">Age group<select v-model="ageGroup" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option v-for="a in availableAges" :key="a" :value="a">{{a||"All ages"}}</option></select></label>
   <label class="text-sm font-semibold">Division<select v-model="division" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option v-for="d in availableDivisions" :key="d" :value="d">{{d||"All divisions"}}</option></select></label>
  </div>
 </UiPanel>
 <UiPanel>
  <h2 class="mb-3 text-xl font-bold">Verified record</h2>
  <p class="mb-3 text-sm font-semibold text-blue-600">{{selectedRecordContext}}</p>
  <p v-if="current"><strong>{{current.holder_name}}</strong> · {{format(Number(current.performance_value))}}{{current.achieved_on?' · '+current.achieved_on:''}}</p>
  <p v-else class="text-sm text-[var(--muted)]">No verified historical record exists for this exact event, age group and division. Enter one before checking for record breakers.</p>
  <button type="button" :disabled="!selectedDefinition||!ageGroup||!division" class="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 font-semibold disabled:opacity-40" @click="resetForm();confirm=true">{{current?'Edit verified record':'Enter historical record'}}</button>
 </UiPanel>
 <UiPanel>
  <h2 class="mb-3 text-xl font-bold">Record comparisons</h2>
  <p v-if="!current" class="text-sm text-[var(--muted)]">Record comparisons are unavailable until a verified baseline is entered.</p>
  <p v-else-if="!improved.length" class="text-sm text-[var(--muted)]">No published performance exceeds this verified record.</p>
  <div v-for="r in improved" :key="r.id" class="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3"><div><strong>{{r.holder_name}}</strong><p class="text-sm text-[var(--muted)]">{{format(Number(r.performance_value))}} · Published result</p></div><button type="button" class="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white" @click="reviewCandidate(r)">Review</button></div>
 </UiPanel>
 <UiPanel>
  <h2 class="mb-3 text-lg font-bold">Saved record baselines</h2>
  <p class="mb-3 text-xs text-[var(--muted)]">Every record is linked to a specific event, age group and division. Select a row to review or edit it.</p>
  <div class="overflow-x-auto"><table class="w-full min-w-[570px] text-left text-sm"><thead class="bg-[var(--panel)]"><tr><th class="p-2">Event</th><th class="p-2">Age group</th><th class="p-2">Division</th><th class="p-2">Type</th><th class="p-2">Holder</th><th class="p-2">Performance</th><th class="p-2 text-right">Action</th></tr></thead><tbody><tr v-for="r in orderedRecords" :key="r.id" class="border-t border-[var(--border)]"><td class="p-2">{{definitions.find(d=>d.id===r.event_definition_id)?.name||'Unknown'}}</td><td class="p-2">{{r.age_group||'All ages'}}</td><td class="p-2">{{r.division||'All divisions'}}</td><td class="p-2">{{r.record_scope}}</td><td class="p-2">{{r.holder_name}}</td><td class="p-2">{{r.performance_value}}</td><td class="p-2 text-right"><button type="button" class="rounded-lg border border-[var(--border)] px-2 py-1 text-blue-600" title="View record" @click="selectedDefinition=r.event_definition_id;ageGroup=r.age_group;division=r.division;recordScope=r.record_scope;resetForm()">View</button></td></tr></tbody></table><p v-if="!orderedRecords.length" class="p-3 text-sm text-[var(--muted)]">No record baselines have been entered.</p></div>
 </UiPanel>
 <div v-if="confirm" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="confirm=false"><section role="dialog" aria-modal="true" aria-label="Confirm school record" class="w-full max-w-lg space-y-4 rounded-xl bg-[var(--surface)] p-6 text-[var(--ink)]">
  <h2 class="text-xl font-bold">Confirm school record</h2><div class="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-950"><p class="font-bold">Record applies to:</p><p>{{selectedRecordContext}}</p><p class="mt-1 text-xs">Only results matching this event, age group and division will be compared against this record.</p></div><p class="text-sm text-[var(--muted)]">Verify the official result before saving. Measurements are stored as {{definition?.measurement}}. This does not change scoring.</p>
  <label class="block text-sm font-semibold">Record holder<input v-model="holder" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
  <label class="block text-sm font-semibold">Performance ({{definition?.measurement}})<input v-model="value" type="number" min="1" step="1" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
  <label class="block text-sm font-semibold">Date achieved<input v-model="achieved" type="date" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
  <div class="flex justify-end gap-3"><button type="button" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="confirm=false">Cancel</button><button type="button" :disabled="busy" class="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50" @click="save">Confirm & save</button></div>
 </section></div>
</div>
</template>