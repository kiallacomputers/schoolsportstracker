<script setup lang="ts">
definePageMeta({layout:'workspace'})
type Competition={id:string;name:string;sport_id:string|null;competition_type:string;management_mode:string;organiser_school_id:string|null;school_year:number;starts_on:string|null;status:string}
type Sport={id:string;name:string}
const db=useSupabaseClient()
const {schoolId,platformAdmin}=useSchool()
const {has}=useSchoolPermissions()
const competitions=ref<Competition[]>([])
const sports=ref<Sport[]>([])
const loading=ref(false),busy=ref(false),error=ref(''),notice=ref('')
const search=ref(''),statusFilter=ref('all'),dialog=ref(false),confirmSave=ref(false),selected=ref<Competition|null>(null)
type EventDefinition={id:string;sport_id:string;name:string;measurement:string}
type CompetitionEvent={id:string;competition_id:string;event_definition_id:string;age_group:string|null;division:string|null;is_team:boolean;min_age:number|null;max_age:number|null;max_participants:number|null}
type AgeGroup={id:string;competition_id:string;name:string;min_age:number|null;max_age:number|null}
type Division={id:string;competition_id:string;name:string}
const ageGroups=ref<AgeGroup[]>([]),divisions=ref<Division[]>([])
const setupDialog=ref(false),setupConfirm=ref(false),setupDelete=ref(false),setupKind=ref<'age'|'division'>('age'),setupSelected=ref<AgeGroup|Division|null>(null),setupBusy=ref(false)
const setupForm=reactive({name:'',min_age:'',max_age:''})
async function loadGroups(c:Competition){
 const [a,d]=await Promise.all([db.from('competition_age_groups').select('id,competition_id,name,min_age,max_age').eq('competition_id',c.id).order('name'),db.from('competition_divisions').select('id,competition_id,name').eq('competition_id',c.id).order('name')])
 if(a.error||d.error)throw a.error||d.error
 ageGroups.value=a.data||[];divisions.value=d.data||[]
}
function openSetup(kind:'age'|'division',item:AgeGroup|Division|null=null){
 setupKind.value=kind;setupSelected.value=item;setupForm.name=item?.name||''
 setupForm.min_age=kind==='age'&&item&&'min_age'in item&&item.min_age!==null?String(item.min_age):''
 setupForm.max_age=kind==='age'&&item&&'max_age'in item&&item.max_age!==null?String(item.max_age):''
 setupConfirm.value=false;setupDelete.value=false;setupDialog.value=true
}
async function saveSetup(){
 const c=eventCompetition.value;if(!c||!canEdit(c)||setupBusy.value)return
 setupBusy.value=true;error.value=''
 try{
  const name=setupForm.name.trim();if(!name||name.length>80)throw new Error('Name must be 1 to 80 characters')
  const table=setupKind.value==='age'?'competition_age_groups':'competition_divisions'
  const payload:any={name}
  if(setupKind.value==='age'){
   const min=setupForm.min_age===''?null:Number(setupForm.min_age),max=setupForm.max_age===''?null:Number(setupForm.max_age)
   if([min,max].some(n=>n!==null&&(!Number.isInteger(n)||n<3||n>30))||(min!==null&&max!==null&&min>max))throw new Error('Enter valid ages from 3 to 30')
   payload.min_age=min;payload.max_age=max
  }
  const result=setupSelected.value?await db.from(table).update(payload).eq('id',setupSelected.value.id).eq('competition_id',c.id):await db.from(table).insert({...payload,competition_id:c.id})
  if(result.error)throw result.error
  setupConfirm.value=false;setupDialog.value=false;await loadGroups(c)
  notice.value='Group settings saved'
 }catch(e:any){error.value=e.message||'Unable to save group';setupConfirm.value=false}
 finally{setupBusy.value=false}
}
async function removeSetup(){
 const c=eventCompetition.value;if(!c||!canEdit(c)||!setupSelected.value||setupBusy.value)return
 setupBusy.value=true;error.value=''
 try{
  const table=setupKind.value==='age'?'competition_age_groups':'competition_divisions'
  const {error:e}=await db.from(table).delete().eq('id',setupSelected.value.id).eq('competition_id',c.id)
  if(e)throw e
  setupDelete.value=false;setupDialog.value=false;await loadGroups(c);notice.value='Group removed'
 }catch(e:any){error.value=e.message||'Unable to remove group';setupDelete.value=false}
 finally{setupBusy.value=false}
}
const definitions=ref<EventDefinition[]>([]),events=ref<CompetitionEvent[]>([])
const eventCompetition=ref<Competition|null>(null),eventDialog=ref(false),eventConfirm=ref(false),eventDelete=ref(false),eventSelected=ref<CompetitionEvent|null>(null),eventBusy=ref(false),eventLoading=ref(false)
const eventForm=reactive({event_definition_id:'',age_group:'',division:'',is_team:false,min_age:'',max_age:'',max_participants:''})
const availableDefinitions=computed(()=>definitions.value.filter(d=>d.sport_id===eventCompetition.value?.sport_id))
function eventName(id:string){return definitions.value.find(d=>d.id===id)?.name||'Unknown event'}
function eventMeasurement(id:string){return definitions.value.find(d=>d.id===id)?.measurement||''}
async function openEvents(c:Competition){
 eventCompetition.value=c;setupDialog.value=false;ageGroups.value=[];divisions.value=[];eventDialog.value=false;eventConfirm.value=false;eventDelete.value=false;eventSelected.value=null;events.value=[];error.value='';eventLoading.value=true
 try{
  const [d,e]=await Promise.all([db.from('event_definitions').select('id,sport_id,name,measurement').eq('sport_id',c.sport_id||''),db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team,min_age,max_age,max_participants').eq('competition_id',c.id)])
  if(d.error||e.error)throw d.error||e.error
  definitions.value=d.data||[];events.value=e.data||[];await loadGroups(c)
 }catch(e:any){error.value=e.message||'Unable to load events'}
 finally{eventLoading.value=false}
}
function newEvent(){eventSelected.value=null;Object.assign(eventForm,{event_definition_id:availableDefinitions.value[0]?.id||'',age_group:'',division:'',is_team:false,min_age:'',max_age:'',max_participants:''});eventConfirm.value=false;eventDialog.value=true}
function editEvent(e:CompetitionEvent){eventSelected.value=e;Object.assign(eventForm,{event_definition_id:e.event_definition_id,age_group:e.age_group||'',division:e.division||'',is_team:e.is_team,min_age:e.min_age?.toString()||'',max_age:e.max_age?.toString()||'',max_participants:e.max_participants?.toString()||''});eventConfirm.value=false;eventDialog.value=true}
function requestEventSave(){if(!eventBusy.value)eventConfirm.value=true}
async function saveEvent(){
 if(eventBusy.value||!eventCompetition.value||!canEdit(eventCompetition.value))return
 eventBusy.value=true;error.value=''
 try{
  if(!availableDefinitions.value.some(d=>d.id===eventForm.event_definition_id))throw new Error('Select a valid event for this sport')
  const min=eventForm.min_age===''?null:Number(eventForm.min_age),max=eventForm.max_age===''?null:Number(eventForm.max_age),cap=eventForm.max_participants===''?null:Number(eventForm.max_participants)
  if([min,max].some(n=>n!==null&&(!Number.isInteger(n)||n<3||n>30))||(min!==null&&max!==null&&min>max))throw new Error('Age limits must be between 3 and 30, with minimum not exceeding maximum')
  if(cap!==null&&(!Number.isInteger(cap)||cap<1||cap>10000))throw new Error('Participant limit must be between 1 and 10000')
  const payload={event_definition_id:eventForm.event_definition_id,age_group:eventForm.age_group.trim()||null,division:eventForm.division.trim()||null,is_team:eventForm.is_team,min_age:min,max_age:max,max_participants:cap}
  const result=eventSelected.value?await db.from('competition_events').update(payload).eq('id',eventSelected.value.id).eq('competition_id',eventCompetition.value.id):await db.from('competition_events').insert({...payload,competition_id:eventCompetition.value.id})
  if(result.error)throw result.error
  eventConfirm.value=false;eventDialog.value=false;notice.value=eventSelected.value?'Event updated successfully':'Event added successfully'
  await openEvents(eventCompetition.value)
 }catch(e:any){error.value=e.message||'Unable to save event';eventConfirm.value=false}
 finally{eventBusy.value=false}
}
async function deleteEvent(){
 if(eventBusy.value||!eventSelected.value||!eventCompetition.value||!canEdit(eventCompetition.value))return
 eventBusy.value=true;error.value=''
 try{
  const {error:e}=await db.from('competition_events').delete().eq('id',eventSelected.value.id).eq('competition_id',eventCompetition.value.id)
  if(e)throw e
  eventDelete.value=false;eventDialog.value=false;notice.value='Event removed successfully'
  await openEvents(eventCompetition.value)
 }catch(e:any){error.value=e.message||'Unable to remove event';eventDelete.value=false}
 finally{eventBusy.value=false}
}
const statuses=['draft','registration','active','completed','archived']
const form=reactive({name:'',sport_id:'',school_year:new Date().getFullYear(),starts_on:'',status:'draft'})
const visible=computed(()=>competitions.value.filter(c=>(statusFilter.value==='all'||c.status===statusFilter.value)&&[c.name,c.school_year,sportName(c.sport_id)].join(' ').toLowerCase().includes(search.value.toLowerCase())))
const canCreate=computed(()=>!!schoolId.value&&has('competitions.create'))
const canEdit=(c:Competition)=>c.competition_type==='intra_school'&&c.organiser_school_id===schoolId.value&&has('competitions.manage')
function sportName(id:string|null){return sports.value.find(s=>s.id===id)?.name||'Not specified'}
function reset(){selected.value=null;Object.assign(form,{name:'',sport_id:sports.value[0]?.id||'',school_year:new Date().getFullYear(),starts_on:'',status:'draft'});dialog.value=true;confirmSave.value=false;error.value=''}
function edit(c:Competition){selected.value=c;Object.assign(form,{name:c.name,sport_id:c.sport_id||'',school_year:c.school_year,starts_on:c.starts_on||'',status:c.status});dialog.value=true;error.value=''}
function close(){if(!busy.value){confirmSave.value=false;dialog.value=false}}
async function load(){
 if(!schoolId.value){competitions.value=[];return}
 loading.value=true;error.value=''
 try{
  const [c,s]=await Promise.all([
   db.from('competitions').select('id,name,sport_id,competition_type,management_mode,organiser_school_id,school_year,starts_on,status').eq('organiser_school_id',schoolId.value).order('school_year',{ascending:false}).order('starts_on',{ascending:false}),
   db.from('sports').select('id,name').order('name')
  ])
  if(c.error||s.error)throw c.error||s.error
  competitions.value=(c.data||[]) as Competition[]
  sports.value=(s.data||[]) as Sport[]
 }catch(e:any){error.value=e.message||'Unable to load competitions'}
 finally{loading.value=false}
}
function requestSave(){if(!busy.value)confirmSave.value=true}
async function save(){
 if(busy.value||!schoolId.value)return
 if(selected.value?!canEdit(selected.value):!canCreate.value)return
 busy.value=true;error.value='';notice.value=''
 try{
  const name=form.name.trim()
  if(name.length<3||name.length>180)throw new Error('Competition name must be 3 to 180 characters')
  if(!Number.isInteger(form.school_year)||form.school_year<2000||form.school_year>2100)throw new Error('Enter a valid school year')
  if(!sports.value.some(s=>s.id===form.sport_id))throw new Error('Select a sport')
  if(selected.value){
   const {data,error:e}=await db.from('competitions').update({name,sport_id:form.sport_id,school_year:form.school_year,starts_on:form.starts_on||null,status:form.status}).eq('id',selected.value.id).eq('organiser_school_id',schoolId.value).select('id').single()
   if(e)throw e
   if(!data)throw new Error('Competition could not be updated')
  }else{
   const {data,error:e}=await db.rpc('create_school_competition',{p_school_id:schoolId.value,p_name:name,p_sport_id:form.sport_id,p_school_year:form.school_year,p_starts_on:form.starts_on||null})
   if(e)throw e
   if(!data)throw new Error('Competition could not be created')
  }
  confirmSave.value=false
  dialog.value=false
  notice.value=selected.value?'Competition updated successfully':'Competition created as a draft'
  await load()
 }catch(e:any){error.value=e.message||'Unable to save competition'}
 finally{busy.value=false}
}
watch(schoolId,()=>{confirmSave.value=false;dialog.value=false;void load()},{immediate:true})
</script>
<template>
<div class="space-y-6">
 <UiPageHeader title="Competitions" description="Create and manage your school's athletics, swimming and other sporting competitions.">
  <template #actions><button v-if="canCreate" aria-label="New competition" title="New competition" class="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700" @click="reset"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></template>
 </UiPageHeader>
 <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{error}}</p>
 <p v-if="notice" role="status" class="text-sm text-green-700">{{notice}}</p>
 <div class="grid gap-4 sm:grid-cols-3"><UiStatCard title="Competitions" :value="competitions.length"/><UiStatCard title="Active" :value="competitions.filter(c=>c.status==='active').length"/><UiStatCard title="Draft / Registration" :value="competitions.filter(c=>['draft','registration'].includes(c.status)).length"/></div>
 <UiPanel>
  <div class="mb-5 flex flex-wrap gap-3">
   <input v-model="search" aria-label="Search competitions" placeholder="Search competitions" type="search" class="min-w-48 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"/>
   <select v-model="statusFilter" aria-label="Filter competition status" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"><option value="all">All statuses</option><option v-for="s in statuses" :key="s" :value="s">{{s.replaceAll('_',' ')}}</option></select>
  </div>
  <p v-if="loading">Loading competitions…</p>
  <div v-else class="overflow-x-auto"><table class="w-full min-w-[650px] text-left text-sm">
   <thead><tr class="border-b border-[var(--border)] text-[var(--muted)]"><th class="py-3">Competition</th><th class="p-3">Sport</th><th class="p-3">School year</th><th class="p-3">Date</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead>
   <tbody><tr v-for="c in visible" :key="c.id" class="border-b border-[var(--border)]"><td class="py-4 font-semibold">{{c.name}}</td><td class="p-3">{{sportName(c.sport_id)}}</td><td class="p-3">{{c.school_year}}</td><td class="p-3">{{c.starts_on||'Not scheduled'}}</td><td class="p-3 capitalize">{{c.status.replaceAll('_',' ')}}</td><td class="p-3"><div class="flex items-center gap-2"><button :aria-label="'Manage events for '+c.name" :title="'Manage events for '+c.name" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="openEvents(c)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h1M3 12h1M3 18h1"/></svg></button><button v-if="canEdit(c)"  :aria-label="'Edit '+c.name" :title="'Edit '+c.name" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="edit(c)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg></button><span v-else class="text-xs text-[var(--muted)]">View only</span></div></td></tr></tbody>
  </table><p v-if="!visible.length" class="py-8 text-center text-sm text-[var(--muted)]">No matching competitions.</p></div>
 </UiPanel>
 <div v-if="dialog" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="close"><section role="dialog" aria-modal="true" aria-label="Competition details" class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
  <header class="mb-5 flex items-center justify-between"><h2 class="text-xl font-bold">{{selected?'Edit competition':'New competition'}}</h2><button aria-label="Close" title="Close" class="text-[#991B1B]" @click="close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg></button></header>
  <form class="space-y-4" @submit.prevent="requestSave">
   <label class="block text-sm font-semibold">Competition name<input v-model="form.name" required minlength="3" maxlength="180" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   <label class="block text-sm font-semibold">Sport<select v-model="form.sport_id" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option disabled value="">Select a sport</option><option v-for="s in sports" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
   <div class="grid gap-4 sm:grid-cols-2">
    <label class="block text-sm font-semibold">School year<input v-model.number="form.school_year" type="number" min="2000" max="2100" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block text-sm font-semibold">Competition date<input v-model="form.starts_on" type="date" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   </div>
   <label v-if="selected" class="block text-sm font-semibold">Status<select v-model="form.status" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option v-for="s in statuses" :key="s" :value="s">{{s.replaceAll('_',' ')}}</option></select></label>
   <p v-else class="text-sm text-[var(--muted)]">New competitions are created as drafts. Registration and event settings will be configured in the next stage.</p>
   <div class="flex justify-end gap-3"><button type="button" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-[#991B1B]" @click="close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg></button><button type="submit" aria-label="Save competition" title="Save competition" :disabled="busy||!sports.length" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg></button></div>
  </form>
 </section></div>
 <div v-if="confirmSave" class="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
  <section role="alertdialog" aria-modal="true" aria-labelledby="competition-confirm-title" aria-describedby="competition-confirm-description" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl">
   <h3 id="competition-confirm-title" class="text-lg font-bold">{{selected?'Save competition changes?':'Create draft competition?'}}</h3>
   <p id="competition-confirm-description" class="mt-3 text-sm">Are you sure you want to {{selected?'save changes to':'create'}} <strong>{{form.name.trim()}}</strong>{{selected?'':' as a draft competition'}}?</p>
   <div class="mt-6 flex justify-end gap-3"><button type="button" :disabled="busy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-[#991B1B]" @click="confirmSave=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg></button><button type="button" :disabled="busy" aria-label="Confirm save" title="Confirm save" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50" @click="save"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg></button></div>
  </section>
 </div>
 <div v-if="eventCompetition" class="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" @click.self="eventCompetition=null">
  <section role="dialog" aria-modal="true" aria-label="Competition events" class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
   <header class="mb-5 flex items-center justify-between gap-3"><div><h2 class="text-xl font-bold">Competition events</h2><p class="text-sm text-[var(--muted)]">{{eventCompetition.name}}</p></div><div class="flex gap-2">
    <button v-if="canEdit(eventCompetition)" aria-label="Add event" title="Add event" class="rounded-xl bg-blue-600 p-3 text-white" @click="newEvent"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
    <button aria-label="Close" title="Close" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="eventCompetition=null"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
   </div></header>
   <div v-if="canEdit(eventCompetition)" class="mb-5 grid gap-4 sm:grid-cols-2">
    <div class="rounded-xl border border-[var(--border)] p-4"><div class="mb-2 flex items-center justify-between"><h3 class="font-semibold">Age groups</h3><button aria-label="Add age group" title="Add age group" class="rounded-lg bg-blue-600 p-2 text-white" @click="openSetup('age')">＋</button></div><p v-if="!ageGroups.length" class="text-sm text-[var(--muted)]">No saved age groups</p><div v-for="g in ageGroups" :key="g.id" class="flex items-center justify-between gap-2 py-1 text-sm"><span>{{g.name}} <span class="text-[var(--muted)]">{{g.min_age??'–'}}–{{g.max_age??'–'}}</span></span><div class="flex gap-2"><button :aria-label="'Edit '+g.name" title="Edit" class="text-blue-600" @click="openSetup('age',g)">✎</button><button :aria-label="'Delete '+g.name" title="Delete" class="text-red-700" @click="openSetup('age',g);setupDelete=true">▤</button></div></div></div>
    <div class="rounded-xl border border-[var(--border)] p-4"><div class="mb-2 flex items-center justify-between"><h3 class="font-semibold">Divisions</h3><button aria-label="Add division" title="Add division" class="rounded-lg bg-blue-600 p-2 text-white" @click="openSetup('division')">＋</button></div><p v-if="!divisions.length" class="text-sm text-[var(--muted)]">No saved divisions</p><div v-for="d in divisions" :key="d.id" class="flex items-center justify-between gap-2 py-1 text-sm"><span>{{d.name}}</span><div class="flex gap-2"><button :aria-label="'Edit '+d.name" title="Edit" class="text-blue-600" @click="openSetup('division',d)">✎</button><button :aria-label="'Delete '+d.name" title="Delete" class="text-red-700" @click="openSetup('division',d);setupDelete=true">▤</button></div></div></div>
   </div>
   <p v-if="eventLoading">Loading events…</p>
   <div v-else class="overflow-x-auto"><table class="w-full min-w-[540px] text-left text-sm"><thead><tr class="border-b border-[var(--border)] text-[var(--muted)]"><th class="py-3">Event</th><th class="p-3">Age group</th><th class="p-3">Division</th><th class="p-3">Type</th><th class="p-3">Actions</th></tr></thead><tbody><tr v-for="e in events" :key="e.id" class="border-b border-[var(--border)]"><td class="py-3 font-semibold">{{eventName(e.event_definition_id)}}</td><td class="p-3">{{e.age_group||'All ages'}}</td><td class="p-3">{{e.division||'Open'}}</td><td class="p-3">{{e.is_team?'Team':'Individual'}}</td><td class="p-3"><div v-if="canEdit(eventCompetition)" class="flex gap-2"><button :aria-label="'Edit '+eventName(e.event_definition_id)" title="Edit event" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="editEvent(e)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16 4l4 4L9 19l-5 1 1-5Z"/></svg></button><button :aria-label="'Delete '+eventName(e.event_definition_id)" title="Delete event" class="rounded-lg border border-[var(--border)] p-2 text-red-700" @click="eventSelected=e;eventDelete=true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></div></td></tr></tbody></table><p v-if="!events.length" class="py-8 text-center text-sm text-[var(--muted)]">No events configured. Use the plus icon to add one.</p></div>
  </section>
 </div>
 <div v-if="eventDialog" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
  <section role="dialog" aria-modal="true" aria-label="Event details" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
   <h3 class="mb-4 text-lg font-bold">{{eventSelected?'Edit event':'Add event'}}</h3>
   <form class="space-y-4" @submit.prevent="requestEventSave">
    <label class="block text-sm font-semibold">Event definition<select v-model="eventForm.event_definition_id" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option disabled value="">Select event</option><option v-for="d in availableDefinitions" :key="d.id" :value="d.id">{{d.name}} ({{d.measurement}})</option></select></label>
    <div class="grid grid-cols-2 gap-3"><label class="block text-sm font-semibold">Age group<select v-model="eventForm.age_group" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="">All ages</option><option v-if="eventForm.age_group&&!ageGroups.some(g=>g.name===eventForm.age_group)" :value="eventForm.age_group">{{eventForm.age_group}} (legacy)</option><option v-for="g in ageGroups" :key="g.id" :value="g.name">{{g.name}}</option></select></label><label class="block text-sm font-semibold">Division<select v-model="eventForm.division" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="">Open</option><option v-if="eventForm.division&&!divisions.some(d=>d.name===eventForm.division)" :value="eventForm.division">{{eventForm.division}} (legacy)</option><option v-for="d in divisions" :key="d.id" :value="d.name">{{d.name}}</option></select></label></div>
    <div class="grid grid-cols-2 gap-3"><label class="block text-sm font-semibold">Minimum age<input v-model="eventForm.min_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="block text-sm font-semibold">Maximum age<input v-model="eventForm.max_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label></div>
    <label class="block text-sm font-semibold">Maximum participants<input v-model="eventForm.max_participants" type="number" min="1" max="10000" placeholder="Optional" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="flex items-center gap-3 text-sm font-semibold"><input v-model="eventForm.is_team" type="checkbox" class="h-4 w-4"/>Team event</label>
    <div class="flex justify-end gap-3"><button type="button" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="eventDialog=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button><button type="submit" :disabled="eventBusy||!availableDefinitions.length" aria-label="Save event" title="Save event" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5V3h11l5 5v13ZM7 21v-8h10v8M7 3v5h8"/></svg></button></div>
   </form>
  </section>
 </div>
 <div v-if="eventConfirm||eventDelete" class="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl"><h3 class="text-lg font-bold">{{eventDelete?'Delete event?':'Save event?'}}</h3><p class="mt-3 text-sm">{{eventDelete?'Are you sure you want to remove this event?':'Are you sure you want to save this competition event?'}}</p><div class="mt-6 flex justify-end gap-3"><button :disabled="eventBusy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="eventConfirm=false;eventDelete=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button><button :disabled="eventBusy" :aria-label="eventDelete?'Confirm delete':'Confirm save'" :title="eventDelete?'Confirm delete':'Confirm save'" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50" @click="eventDelete?deleteEvent():saveEvent()"><svg v-if="eventDelete" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg><svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5V3h11l5 5v13ZM7 21v-8h10v8M7 3v5h8"/></svg></button></div></section></div>

 <div v-if="setupDialog" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-label="Manage age group or division" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h3 class="mb-4 text-lg font-bold">{{setupSelected?'Edit':'Add'}} {{setupKind==='age'?'age group':'division'}}</h3><form class="space-y-4" @submit.prevent="setupConfirm=true"><label class="block text-sm font-semibold">Name<input v-model="setupForm.name" required maxlength="80" placeholder="e.g. Under 14 or Girls" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><div v-if="setupKind==='age'" class="grid grid-cols-2 gap-3"><label class="text-sm font-semibold">Minimum age<input v-model="setupForm.min_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="text-sm font-semibold">Maximum age<input v-model="setupForm.max_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label></div><div class="flex justify-end gap-3"><button type="button" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="setupDialog=false">✕</button><button type="submit" aria-label="Save" title="Save" class="rounded-xl bg-blue-600 p-3 text-white">▣</button></div></form></section></div>
 <div v-if="setupConfirm||setupDelete" class="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h3 class="text-lg font-bold">{{setupDelete?'Delete this item?':'Save changes?'}}</h3><p class="mt-3 text-sm">Are you sure you want to {{setupDelete?'delete':'save'}} this {{setupKind==='age'?'age group':'division'}}?</p><div class="mt-5 flex justify-end gap-3"><button :disabled="setupBusy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="setupConfirm=false;setupDelete=false">✕</button><button :disabled="setupBusy" aria-label="Confirm" title="Confirm" class="rounded-xl bg-blue-600 p-3 text-white" @click="setupDelete?removeSetup():saveSetup()">{{setupDelete?'▤':'▣'}}</button></div></section></div>

</div>
</template>