<script setup lang="ts">
definePageMeta({layout:'workspace'})
type Competition={id:string;name:string;sport_id:string|null;competition_type:string;management_mode:string;heat_entry_mode:string;organiser_school_id:string|null;school_year:number;starts_on:string|null;status:string;default_race_lanes:number|null;default_event_capacity:number|null}
type Sport={id:string;name:string}
const db=useSupabaseClient()
const {schoolId,platformAdmin,schoolOptions}=useSchool()
const schoolName=computed(()=>schoolOptions.value.find(school=>school.id===schoolId.value)?.name)
const {has}=useSchoolPermissions()
const competitions=ref<Competition[]>([])
const sports=ref<Sport[]>([])
const loading=ref(false),busy=ref(false),error=ref(''),notice=ref('')
const search=ref(''),statusFilter=ref('all'),dialog=ref(false),confirmSave=ref(false),selected=ref<Competition|null>(null)
const rollbackTarget=ref<Competition|null>(null),rollbackBusy=ref(false)
const registrationTarget=ref<Competition|null>(null)
type EventDefinition={id:string;sport_id:string;name:string;measurement:string}
type CompetitionEvent={id:string;competition_id:string;event_definition_id:string;age_group:string|null;division:string|null;is_team:boolean;min_age:number|null;max_age:number|null;max_participants:number|null;scheduled_on:string|null;starts_at:string|null;venue:string|null;schedule_order:number|null;duration_minutes:number|null}
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
type PresetKind='primary'|'secondary'|'custom'
const presetKind=ref<PresetKind>('primary'),includeOptional=ref(false),includeYearLevels=ref(true),includeDivisions=ref(true),presetConfirm=ref(false),presetBusy=ref(false)
const cutoffMode=ref('calendar_year'),cutoffDate=ref(''),cutoffConfirm=ref(false),cutoffBusy=ref(false)
const presetPreview=computed(()=>{
 const names:string[]=[]
 if(presetKind.value==='primary'){
  for(let n=8;n<=12;n++)names.push('Under '+n)
  if(includeOptional.value)names.push('Under 13')
  if(includeYearLevels.value)names.push('Prep',...Array.from({length:6},(_,i)=>'Year '+(i+1)))
 }else if(presetKind.value==='secondary'){
  for(let n=13;n<=18;n++)names.push('Under '+n)
  if(includeOptional.value)names.push('Under 19','Open')
  if(includeYearLevels.value)names.push(...Array.from({length:6},(_,i)=>'Year '+(i+7)))
 }
 return names
})
const presetDivisions=['Boys','Girls','Mixed','Open']
async function applyPreset(){
 const c=eventCompetition.value;if(!c||!canEdit(c)||presetBusy.value)return
 presetBusy.value=true;error.value=''
 try{
  const current=new Set(ageGroups.value.map(g=>g.name.toLowerCase()))
  const ages=presetPreview.value.filter(n=>!current.has(n.toLowerCase())).map(name=>({
   competition_id:c.id,name,
   min_age:null,
   max_age:name.startsWith('Under ')?Number(name.slice(6))-1:null
  }))
  const currentDivisions=new Set(divisions.value.map(d=>d.name.toLowerCase()))
  const divs=includeDivisions.value?presetDivisions.filter(name=>!currentDivisions.has(name.toLowerCase())).map(name=>({competition_id:c.id,name})):[]
  if(ages.length){const {error:e}=await db.from('competition_age_groups').insert(ages);if(e)throw e}
  if(divs.length){const {error:e}=await db.from('competition_divisions').insert(divs);if(e)throw e}
  await loadGroups(c)
  presetConfirm.value=false
  notice.value=`Preset applied: ${ages.length} age groups and ${divs.length} divisions added. Existing entries kept.`
 }catch(e:any){error.value=e.message||'Unable to apply preset';presetConfirm.value=false;await loadGroups(c).catch(()=>{})}
 finally{presetBusy.value=false}
}
async function saveCutoff(){
 const c=eventCompetition.value;if(!c||!canEdit(c)||cutoffBusy.value)return
 cutoffBusy.value=true;error.value=''
 try{
  if(cutoffMode.value==='custom_date'&&!cutoffDate.value)throw new Error('Select an age cutoff date')
  const {error:e}=await db.from('competitions').update({age_cutoff_mode:cutoffMode.value,age_cutoff_date:cutoffMode.value==='custom_date'?cutoffDate.value:null}).eq('id',c.id)
  if(e)throw e
  cutoffConfirm.value=false;notice.value='Age cutoff settings saved'
 }catch(e:any){error.value=e.message||'Unable to save age cutoff';cutoffConfirm.value=false}
 finally{cutoffBusy.value=false}
}
const definitions=ref<EventDefinition[]>([]),events=ref<CompetitionEvent[]>([])
const eventCompetition=ref<Competition|null>(null),eventDialog=ref(false),eventConfirm=ref(false),eventDelete=ref(false),eventSelected=ref<CompetitionEvent|null>(null),eventBusy=ref(false),eventLoading=ref(false)
const eventForm=reactive({event_definition_id:'',age_group:'',division:'',is_team:false,min_age:'',max_age:'',max_participants:'',race_lanes:'',scheduled_on:'',starts_at:'',venue:'',schedule_order:'',duration_minutes:''})
const availableDefinitions=computed(()=>definitions.value.filter(d=>d.sport_id===eventCompetition.value?.sport_id))
function eventName(id:string){return definitions.value.find(d=>d.id===id)?.name||'Unknown event'}
function eventMeasurement(id:string){return definitions.value.find(d=>d.id===id)?.measurement||''}
async function openEvents(c:Competition){
 eventCompetition.value=c;presetConfirm.value=false;cutoffConfirm.value=false;setupDialog.value=false;ageGroups.value=[];divisions.value=[];eventDialog.value=false;eventConfirm.value=false;eventDelete.value=false;eventSelected.value=null;events.value=[];error.value='';eventLoading.value=true
 try{
  const [d,e]=await Promise.all([db.from('event_definitions').select('id,sport_id,name,measurement').eq('sport_id',c.sport_id||''),db.from('competition_events').select('id,competition_id,event_definition_id,age_group,division,is_team,min_age,max_age,max_participants,scheduled_on,starts_at,venue,schedule_order,duration_minutes').eq('competition_id',c.id)])
  if(d.error||e.error)throw d.error||e.error
  definitions.value=d.data||[];events.value=e.data||[];await loadGroups(c);const {data:settings,error:settingsError}=await db.from('competitions').select('age_cutoff_mode,age_cutoff_date').eq('id',c.id).single();if(settingsError)throw settingsError;cutoffMode.value=settings?.age_cutoff_mode==='custom_date'?'custom_date':'calendar_year';cutoffDate.value=settings?.age_cutoff_date||''
 }catch(e:any){error.value=e.message||'Unable to load events'}
 finally{eventLoading.value=false}
}
function cDefaultDate(){return eventCompetition.value?.starts_on||''}
function newEvent(){eventSelected.value=null;Object.assign(eventForm,{event_definition_id:availableDefinitions.value[0]?.id||'',age_group:'',division:'',is_team:false,min_age:'',max_age:'',max_participants:eventCompetition.value?.default_event_capacity?.toString()||'',race_lanes:eventCompetition.value?.default_race_lanes?.toString()||'',scheduled_on:cDefaultDate(),starts_at:'',venue:'',schedule_order:String(events.value.length+1),duration_minutes:''});eventConfirm.value=false;eventDialog.value=true}
function applyAgeGroup(){const g=ageGroups.value.find(g=>g.name===eventForm.age_group);if(g){eventForm.min_age=g.min_age===null?'':String(g.min_age);eventForm.max_age=g.max_age===null?'':String(g.max_age)}}
function editEvent(e:CompetitionEvent){eventSelected.value=e;Object.assign(eventForm,{event_definition_id:e.event_definition_id,age_group:e.age_group||'',division:e.division||'',is_team:e.is_team,min_age:e.min_age?.toString()||'',max_age:e.max_age?.toString()||'',max_participants:e.max_participants?.toString()||'',race_lanes:'',scheduled_on:e.scheduled_on||'',starts_at:e.starts_at?.slice(0,5)||'',venue:e.venue||'',schedule_order:e.schedule_order?.toString()||'',duration_minutes:e.duration_minutes?.toString()||''});eventConfirm.value=false;eventDialog.value=true}
function requestEventSave(){if(!eventBusy.value)eventConfirm.value=true}
async function saveEvent(){
 if(eventBusy.value||!eventCompetition.value||!canEdit(eventCompetition.value))return
 eventBusy.value=true;error.value=''
 try{
  if(!availableDefinitions.value.some(d=>d.id===eventForm.event_definition_id))throw new Error('Select a valid event for this sport')
  const min=eventForm.min_age===''?null:Number(eventForm.min_age),max=eventForm.max_age===''?null:Number(eventForm.max_age),cap=eventForm.max_participants===''?null:Number(eventForm.max_participants)
  if([min,max].some(n=>n!==null&&(!Number.isInteger(n)||n<3||n>30))||(min!==null&&max!==null&&min>max))throw new Error('Age limits must be between 3 and 30, with minimum not exceeding maximum')
  if(cap!==null&&(!Number.isInteger(cap)||cap<1||cap>10000))throw new Error('Participant limit must be between 1 and 10000')
  const showRaceLanes=!eventSelected.value&&eventMeasurement(eventForm.event_definition_id)==='time_ms'
  const lanes=eventForm.race_lanes===''?null:Number(eventForm.race_lanes)
  if(showRaceLanes&&lanes!==null&&(!Number.isInteger(lanes)||lanes<1||lanes>12))throw new Error('Race lanes must be between 1 and 12')
  const duration=eventForm.duration_minutes===''?null:Number(eventForm.duration_minutes),sequence=eventForm.schedule_order===''?null:Number(eventForm.schedule_order)
  if(duration!==null&&(!Number.isInteger(duration)||duration<1||duration>1440))throw new Error('Duration must be 1 to 1440 minutes')
  if(sequence!==null&&(!Number.isInteger(sequence)||sequence<1||sequence>10000))throw new Error('Order must be 1 to 10000')
  if(eventForm.starts_at&&!eventForm.scheduled_on)throw new Error('Choose an event date before setting a start time')
  if(eventForm.venue.trim().length>120)throw new Error('Venue must be 120 characters or fewer')
  const payload={scheduled_on:eventForm.scheduled_on||null,starts_at:eventForm.starts_at||null,venue:eventForm.venue.trim()||null,schedule_order:sequence,duration_minutes:duration,event_definition_id:eventForm.event_definition_id,age_group:eventForm.age_group.trim()||null,division:eventForm.division.trim()||null,is_team:eventForm.is_team,min_age:min,max_age:max,max_participants:cap,...(showRaceLanes&&lanes!==null?{race_lanes:lanes}:{})}
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
type ScoringScheme={placing_points:number[];team_multiplier:number;allow_ties:boolean}
const defaultScoring:ScoringScheme={placing_points:[10,8,6,5,4,3,2,1],team_multiplier:1,allow_ties:true}
const scoringCompetition=ref<Competition|null>(null),scoringDialog=ref(false),scoringConfirm=ref(false),scoringBusy=ref(false),scoringLoading=ref(false)
const scoringForm=reactive({points:'10, 8, 6, 5, 4, 3, 2, 1',team_multiplier:'1',allow_ties:true})
function readScoring(raw:any):ScoringScheme{
 const points=Array.isArray(raw?.placing_points)&&raw.placing_points.length?raw.placing_points:defaultScoring.placing_points
 return {placing_points:points,team_multiplier:typeof raw?.team_multiplier==='number'?raw.team_multiplier:1,allow_ties:raw?.allow_ties!==false}
}
function formatPoints(points:number[]){return points.join(', ')}
async function openScoring(c:Competition){
 scoringCompetition.value=c;scoringDialog.value=true;scoringConfirm.value=false;scoringLoading.value=true;error.value=''
 try{
  const {data,error:e}=await db.from('competitions').select('scoring_scheme').eq('id',c.id).single()
  if(e)throw e
  const settings=readScoring(data?.scoring_scheme)
  scoringForm.points=formatPoints(settings.placing_points)
  scoringForm.team_multiplier=String(settings.team_multiplier)
  scoringForm.allow_ties=settings.allow_ties
 }catch(e:any){error.value=e.message||'Unable to load scoring settings'}
 finally{scoringLoading.value=false}
}
async function saveScoring(){
 const c=scoringCompetition.value
 if(!c||!canEdit(c)||scoringBusy.value)return
 scoringBusy.value=true;error.value=''
 try{
  const points=parseMeetPoints(scoringForm.points),multiplier=Number(scoringForm.team_multiplier)
  if(!Number.isFinite(multiplier)||multiplier<0||multiplier>20||Math.round(multiplier*100)!==multiplier*100)throw new Error('Team multiplier must be between 0 and 20 (up to 2 decimals)')
  const scheme:ScoringScheme={placing_points:points,team_multiplier:multiplier,allow_ties:scoringForm.allow_ties}
  const {data,error:e}=await db.from('competitions').update({scoring_scheme:scheme}).eq('id',c.id).select('id').single()
  if(e)throw e
  if(!data)throw new Error('Scoring settings could not be saved')
  scoringConfirm.value=false;scoringDialog.value=false;notice.value='Competition scoring settings saved'
 }catch(e:any){error.value=e.message||'Unable to save scoring settings';scoringConfirm.value=false}
 finally{scoringBusy.value=false}
}
const pointsPreview=computed(()=>{try{return parseMeetPoints(scoringForm.points)}catch{return []}})
const statuses=['draft','registration','active','completed','archived']
const form=reactive({name:'',sport_id:'',school_year:new Date().getFullYear(),starts_on:'',status:'draft',heat_entry_mode:'sequential'})
const meetPeriod=ref<'upcoming'|'past'>('upcoming')
function isPast(competition: Competition, today: string) {
 return ['completed','archived'].includes(competition.status)
  || (competition.status !== 'active' && !!competition.starts_on && competition.starts_on < today)
}
const visible=computed(()=>{
 const now=new Date()
 const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')
 const query=search.value.trim().toLowerCase()
 return competitions.value.filter(competition=>
  isPast(competition,today)===(meetPeriod.value==='past')
  && (statusFilter.value==='all'||competition.status===statusFilter.value)
  && [competition.name,competition.school_year,sportName(competition.sport_id)].join(' ').toLowerCase().includes(query)
 )
})
function changePeriod(period: 'upcoming'|'past') {
 meetPeriod.value=period
 statusFilter.value='all'
}
const canCreate=computed(()=>!!schoolId.value&&has('competitions.create'))
const canEdit=(c:Competition)=>c.competition_type==='intra_school'&&c.organiser_school_id===schoolId.value&&has('competitions.manage')
function sportName(id:string|null){return sports.value.find(s=>s.id===id)?.name||'Not specified'}
function reset(){selected.value=null;Object.assign(form,{name:'',sport_id:sports.value[0]?.id||'',school_year:new Date().getFullYear(),starts_on:'',status:'draft',heat_entry_mode:'sequential'});dialog.value=true;confirmSave.value=false;error.value=''}
function edit(c:Competition){selected.value=c;Object.assign(form,{name:c.name,sport_id:c.sport_id||'',school_year:c.school_year,starts_on:c.starts_on||'',status:c.status,heat_entry_mode:c.heat_entry_mode||'sequential'});dialog.value=true;error.value=''}
function close(){if(!busy.value){confirmSave.value=false;dialog.value=false}}
async function load(){
 if(!schoolId.value){competitions.value=[];return}
 loading.value=true;error.value=''
 try{
  const [c,s]=await Promise.all([
   db.from('competitions').select('id,name,sport_id,competition_type,management_mode,heat_entry_mode,organiser_school_id,school_year,starts_on,status,default_race_lanes,default_event_capacity').eq('organiser_school_id',schoolId.value).order('school_year',{ascending:false}).order('starts_on',{ascending:false}),
   db.from('sports').select('id,name').order('name')
  ])
  if(c.error||s.error)throw c.error||s.error
  competitions.value=(c.data||[]) as Competition[]
  sports.value=(s.data||[]) as Sport[]
 }catch(e:any){error.value=e.message||'Unable to load competitions'}
 finally{loading.value=false}
}
async function rollbackToRegistration(){
 const c=rollbackTarget.value
 if(!c||!platformAdmin.value||rollbackBusy.value)return
 rollbackBusy.value=true;error.value='';notice.value=''
 try{
  const {error:e}=await db.rpc('return_competition_to_registration',{p_competition_id:c.id})
  if(e)throw e
  rollbackTarget.value=null
  if(selected.value?.id===c.id){dialog.value=false;selected.value=null}
  notice.value=c.name+' returned to Registrations. Review registrations before activating again.'
  await load()
 }catch(e:any){error.value=e.message||'Unable to return competition to registration'}
 finally{rollbackBusy.value=false}
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
   if(selected.value.status==='active'&&form.status!==selected.value.status)throw new Error('Use the Platform Admin Return to Registrations action.')
   const {data,error:e}=await db.from('competitions').update({name,sport_id:form.sport_id,school_year:form.school_year,starts_on:form.starts_on||null,status:form.status,heat_entry_mode:form.heat_entry_mode}).eq('id',selected.value.id).eq('organiser_school_id',schoolId.value).select('id').single()
   if(e)throw e
   if(!data)throw new Error('Competition could not be updated')
  }else{
   const {data,error:e}=await db.rpc('create_school_competition',{p_school_id:schoolId.value,p_name:name,p_sport_id:form.sport_id,p_school_year:form.school_year,p_starts_on:form.starts_on||null})
   if(e)throw e
   if(!data)throw new Error('Competition could not be created')
   const createdId=typeof data==='string'?data:(Array.isArray(data)?data[0]?.id:data?.id)
   if(createdId){const {error:modeError}=await db.from('competitions').update({heat_entry_mode:form.heat_entry_mode}).eq('id',createdId).eq('organiser_school_id',schoolId.value);if(modeError)throw modeError}
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
 <UiPageHeader :title="schoolName || 'Meets'" description="Meet management">
  <template #actions><button v-if="canCreate" type="button" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700" @click="reset"><LayoutNavIcon name="plus" /> Create meet</button> <div v-if="rollbackTarget" class="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" aria-label="Return competition to Registrations" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h2 class="text-xl font-bold">Return to Registrations?</h2><p class="mt-3 text-sm">Return <strong>{{rollbackTarget.name}}</strong> from Active to Registrations? Event Day will become unavailable and registrations can be reviewed before reactivation.</p><p class="mt-2 text-sm text-amber-700">This is only allowed when no results have been entered. Existing event and round configuration is preserved.</p><div class="mt-5 flex justify-end gap-3"><button type="button" class="rounded-lg border border-[var(--border)] px-4 py-2" :disabled="rollbackBusy" @click="rollbackTarget=null">Cancel</button><button type="button" class="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50" :disabled="rollbackBusy" @click="rollbackToRegistration">{{rollbackBusy?'Returning…':'Confirm return'}}</button></div></section></div>
</template>
 </UiPageHeader>
 <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{error}}</p>
 <p v-if="notice" role="status" class="text-sm text-green-700">{{notice}}</p>
 <UiPanel>
  <div class="mb-5 flex gap-2" role="group" aria-label="Meet period">
   <button v-for="period in (['upcoming','past'] as const)" :key="period" type="button" :aria-pressed="meetPeriod===period" :class="meetPeriod===period ? 'border-blue-600 bg-[var(--panel)] text-blue-600' : 'border-[var(--border)]'" class="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-[var(--panel)]" @click="changePeriod(period)">{{period==='upcoming'?'Upcoming meets':'Past meets'}}</button>
  </div>
  <div class="mb-5 flex flex-wrap gap-3">
   <input v-model="search" aria-label="Search competitions" placeholder="Search competitions" type="search" class="min-w-48 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"/>
   <select v-model="statusFilter" aria-label="Filter competition status" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"><option value="all">All statuses</option><option v-for="s in statuses" :key="s" :value="s">{{s.replaceAll('_',' ')}}</option></select>
  </div>
  <p v-if="loading">Loading competitions…</p>
  <div v-else class="overflow-x-auto"><table class="w-full min-w-[650px] text-left text-sm">
   <thead><tr class="border-b border-[var(--border)] text-[var(--muted)]"><th class="py-3">Competition</th><th class="p-3">Sport</th><th class="p-3">School year</th><th class="p-3">Date</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead>
   <tbody><tr v-for="c in visible" :key="c.id" class="border-b border-[var(--border)]"><td class="py-4 font-semibold">{{c.name}}</td><td class="p-3">{{sportName(c.sport_id)}}</td><td class="p-3">{{c.school_year}}</td><td class="p-3">{{c.starts_on||'Not scheduled'}}</td><td class="p-3 capitalize">{{c.status.replaceAll('_',' ')}}</td><td class="p-3"><div class="flex items-center gap-2"><button type="button" @click="registrationTarget=c" :aria-label="'Manage registrations for '+c.name" :title="'Manage registrations for '+c.name" class="rounded-lg border border-[var(--border)] p-2 text-blue-600"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></button><button :aria-label="'Manage events for '+c.name" :title="'Manage events for '+c.name" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="openEvents(c)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h1M3 12h1M3 18h1"/></svg></button><button :aria-label="'Scoring settings for '+c.name" :title="'Scoring settings for '+c.name" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="openScoring(c)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg></button><button v-if="platformAdmin&&c.status==='active'" type="button" :aria-label="'Return '+c.name+' to Registrations'" title="Return to Registrations (Platform Admin)" class="rounded-lg border border-[var(--border)] p-2 text-amber-600" @click="rollbackTarget=c"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg></button><button v-if="canEdit(c)"  :aria-label="'Edit '+c.name" :title="'Edit '+c.name" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="edit(c)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg></button><span v-else class="text-xs text-[var(--muted)]">View only</span></div></td></tr></tbody>
  </table><p v-if="!visible.length" class="py-8 text-center text-sm text-[var(--muted)]">{{ search || statusFilter !== 'all' ? 'No matching meets.' : meetPeriod === 'upcoming' ? 'No upcoming meets.' : 'No past meets.' }}</p></div>
 </UiPanel>
 <div v-if="registrationTarget" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-6" @click.self="registrationTarget=null">
  <section role="dialog" aria-modal="true" :aria-label="'Registrations for '+registrationTarget.name" class="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] text-[var(--ink)] shadow-2xl">
   <header class="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
    <div><h2 class="text-xl font-bold">Competition Registrations</h2><p class="text-sm text-[var(--muted)]">{{registrationTarget.name}}</p></div>
    <button type="button" aria-label="Close registrations" title="Close" class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold" @click="registrationTarget=null">✕</button>
   </header>
   <div class="min-h-0 overflow-y-auto p-4 sm:p-6"><CompetitionRegistrations :initial-competition-id="registrationTarget.id" /></div>
  </section>
 </div>
 <div v-if="dialog" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="close"><section role="dialog" aria-modal="true" aria-label="Competition details" class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
  <header class="mb-5 flex items-center justify-between"><h2 class="text-xl font-bold">{{selected?'Edit competition':'New competition'}}</h2><button aria-label="Close" title="Close" class="text-[#991B1B]" @click="close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg></button></header>
  <form class="space-y-4" @submit.prevent="requestSave">
   <label class="block text-sm font-semibold">Competition name<input v-model="form.name" required minlength="3" maxlength="180" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   <label class="block text-sm font-semibold">Sport<select v-model="form.sport_id" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option disabled value="">Select a sport</option><option v-for="s in sports" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
   <div class="grid gap-4 sm:grid-cols-2">
    <label class="block text-sm font-semibold">School year<input v-model.number="form.school_year" type="number" min="2000" max="2100" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block text-sm font-semibold">Heat results entry mode<select v-model="form.heat_entry_mode" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="sequential">One heat at a time (races run separately)</option><option value="simultaneous">All heats together (combined results entry)</option></select><span class="mt-1 block text-xs font-normal text-[var(--muted)]">Controls how heats appear during race-day results entry.</span></label>
    <label class="block text-sm font-semibold">Competition date<input v-model="form.starts_on" type="date" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   </div>
   <div v-if="selected" class="space-y-3"><label class="block text-sm font-semibold">Status<select v-model="form.status" :disabled="selected.status==='active'" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 disabled:opacity-60"><option v-for="s in statuses" :key="s" :value="s">{{s.replaceAll('_',' ')}}</option></select></label><div v-if="selected.status==='active'" class="rounded-lg border border-amber-300 p-3"><p class="text-sm">Active competitions cannot be moved back using the status selector.</p><button v-if="platformAdmin" type="button" class="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white" @click="rollbackTarget=selected">Return to Registrations (Platform Admin)</button><p v-else class="mt-2 text-xs text-[var(--muted)]">Only a Platform Admin can return this competition to Registrations.</p></div></div>
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
   <div v-if="canEdit(eventCompetition)" class="mb-5 rounded-xl border border-[var(--border)] p-4">
    <h3 class="mb-3 font-semibold">Age-group presets</h3>
    <div class="grid gap-3 sm:grid-cols-3">
     <label class="text-sm font-semibold">Preset<select v-model="presetKind" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2"><option value="primary">Primary school</option><option value="secondary">Secondary school</option><option value="custom">Custom (manual)</option></select></label>
     <label class="flex items-center gap-2 text-sm"><input v-model="includeYearLevels" type="checkbox" :disabled="presetKind==='custom'"/> Include year levels</label>
     <label class="flex items-center gap-2 text-sm"><input v-model="includeOptional" type="checkbox" :disabled="presetKind==='custom'"/> Include optional groups</label>
    </div>
    <label class="mt-3 flex items-center gap-2 text-sm"><input v-model="includeDivisions" type="checkbox" :disabled="presetKind==='custom'"/> Include Boys, Girls, Mixed and Open divisions</label>
    <p class="mt-2 text-sm text-[var(--muted)]">{{presetKind==='custom'?'Create your own age groups and divisions below.':'Will add missing groups: '+presetPreview.join(', ')}}</p>
    <div class="mt-3 flex justify-end"><button v-if="presetKind!=='custom'" aria-label="Apply age group preset" title="Apply age group preset" class="rounded-xl bg-blue-600 p-3 text-white" @click="presetConfirm=true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button></div>
    <div class="mt-4 border-t border-[var(--border)] pt-4"><h3 class="mb-2 font-semibold">Age eligibility cutoff</h3><div class="flex flex-wrap items-end gap-3"><label class="text-sm font-semibold">Calculate age at<select v-model="cutoffMode" class="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2"><option value="calendar_year">31 December of competition year</option><option value="custom_date">Custom date</option></select></label><label v-if="cutoffMode==='custom_date'" class="text-sm font-semibold">Cutoff date<input v-model="cutoffDate" type="date" class="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2"/></label><button aria-label="Save age cutoff" title="Save age cutoff" class="rounded-xl bg-blue-600 p-3 text-white" @click="cutoffConfirm=true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5V3h11l5 5v13ZM7 21v-8h10v8"/></svg></button></div><p class="mt-2 text-xs text-[var(--muted)]">Age limits use the selected cutoff. Year-level groups are labels and do not automatically calculate student eligibility.</p></div>
   </div>
   <div v-if="canEdit(eventCompetition)" class="mb-5 grid gap-4 sm:grid-cols-2">
    <div class="rounded-xl border border-[var(--border)] p-4"><div class="mb-2 flex items-center justify-between"><h3 class="font-semibold">Age groups</h3><button aria-label="Add age group" title="Add age group" class="rounded-lg bg-blue-600 p-2 text-white" @click="openSetup('age')">＋</button></div><p v-if="!ageGroups.length" class="text-sm text-[var(--muted)]">No saved age groups</p><div v-for="g in ageGroups" :key="g.id" class="flex items-center justify-between gap-2 py-1 text-sm"><span>{{g.name}} <span class="text-[var(--muted)]">{{g.min_age??'–'}}–{{g.max_age??'–'}}</span></span><div class="flex gap-2"><button :aria-label="'Edit '+g.name" title="Edit" class="text-blue-600" @click="openSetup('age',g)">✎</button><button :aria-label="'Delete '+g.name" title="Delete" class="text-red-700" @click="openSetup('age',g);setupDelete=true">▤</button></div></div></div>
    <div class="rounded-xl border border-[var(--border)] p-4"><div class="mb-2 flex items-center justify-between"><h3 class="font-semibold">Divisions</h3><button aria-label="Add division" title="Add division" class="rounded-lg bg-blue-600 p-2 text-white" @click="openSetup('division')">＋</button></div><p v-if="!divisions.length" class="text-sm text-[var(--muted)]">No saved divisions</p><div v-for="d in divisions" :key="d.id" class="flex items-center justify-between gap-2 py-1 text-sm"><span>{{d.name}}</span><div class="flex gap-2"><button :aria-label="'Edit '+d.name" title="Edit" class="text-blue-600" @click="openSetup('division',d)">✎</button><button :aria-label="'Delete '+d.name" title="Delete" class="text-red-700" @click="openSetup('division',d);setupDelete=true">▤</button></div></div></div>
   </div>
   <p v-if="eventLoading">Loading events…</p>
   <div v-else class="overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead><tr class="border-b border-[var(--border)] text-[var(--muted)]"><th class="py-3">Event</th><th class="p-3">Age group</th><th class="p-3">Division</th><th class="p-3">Type</th><th class="p-3">Schedule</th><th class="p-3">Actions</th></tr></thead><tbody><tr v-for="e in events" :key="e.id" class="border-b border-[var(--border)]"><td class="py-3 font-semibold">{{eventName(e.event_definition_id)}}</td><td class="p-3">{{e.age_group||'All ages'}}</td><td class="p-3">{{e.division||'Open'}}</td><td class="p-3">{{e.is_team?'Team':'Individual'}}</td><td class="p-3"><div v-if="e.scheduled_on||e.starts_at||e.venue||e.schedule_order" class="min-w-[130px] text-xs"><div v-if="e.schedule_order">#{{e.schedule_order}}</div><div v-if="e.scheduled_on">{{e.scheduled_on}}</div><div v-if="e.starts_at">{{e.starts_at.slice(0,5)}}<span v-if="e.duration_minutes"> · {{e.duration_minutes}} min</span></div><div v-if="e.venue">{{e.venue}}</div></div><span v-else class="text-xs text-[var(--muted)]">Unscheduled</span></td><td class="p-3"><div v-if="canEdit(eventCompetition)" class="flex gap-2"><button :aria-label="'Edit '+eventName(e.event_definition_id)" title="Edit event" class="rounded-lg border border-[var(--border)] p-2 text-blue-600" @click="editEvent(e)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16 4l4 4L9 19l-5 1 1-5Z"/></svg></button><button :aria-label="'Delete '+eventName(e.event_definition_id)" title="Delete event" class="rounded-lg border border-[var(--border)] p-2 text-red-700" @click="eventSelected=e;eventDelete=true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></div></td></tr></tbody></table><p v-if="!events.length" class="py-8 text-center text-sm text-[var(--muted)]">No events configured. Use the plus icon to add one.</p></div>
  </section>
 </div>
 <div v-if="eventDialog" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
  <section role="dialog" aria-modal="true" aria-label="Event details" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
   <h3 class="mb-4 text-lg font-bold">{{eventSelected?'Edit event':'Add event'}}</h3>
   <form class="space-y-4" @submit.prevent="requestEventSave">
    <label class="block text-sm font-semibold">Event definition<select v-model="eventForm.event_definition_id" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option disabled value="">Select event</option><option v-for="d in availableDefinitions" :key="d.id" :value="d.id">{{d.name}} ({{d.measurement}})</option></select></label>
    <div class="grid grid-cols-2 gap-3"><label class="block text-sm font-semibold">Age group<select v-model="eventForm.age_group" @change="applyAgeGroup" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="">All ages</option><option v-if="eventForm.age_group&&!ageGroups.some(g=>g.name===eventForm.age_group)" :value="eventForm.age_group">{{eventForm.age_group}} (legacy)</option><option v-for="g in ageGroups" :key="g.id" :value="g.name">{{g.name}}</option></select></label><label class="block text-sm font-semibold">Division<select v-model="eventForm.division" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="">Open</option><option v-if="eventForm.division&&!divisions.some(d=>d.name===eventForm.division)" :value="eventForm.division">{{eventForm.division}} (legacy)</option><option v-for="d in divisions" :key="d.id" :value="d.name">{{d.name}}</option></select></label></div>
    <div class="grid grid-cols-2 gap-3"><label class="block text-sm font-semibold">Minimum age<input v-model="eventForm.min_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="block text-sm font-semibold">Maximum age<input v-model="eventForm.max_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label></div>
    <fieldset class="rounded-xl border border-[var(--border)] p-3"><legend class="px-2 text-sm font-semibold">Event scheduling</legend><div class="grid grid-cols-2 gap-3"><label class="block text-sm font-semibold">Date<input v-model="eventForm.scheduled_on" type="date" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="block text-sm font-semibold">Start time<input v-model="eventForm.starts_at" type="time" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="block text-sm font-semibold">Running order<input v-model="eventForm.schedule_order" type="number" min="1" max="10000" placeholder="Optional" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="block text-sm font-semibold">Duration (minutes)<input v-model="eventForm.duration_minutes" type="number" min="1" max="1440" placeholder="Optional" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label></div><label class="mt-3 block text-sm font-semibold">Venue / location<input v-model="eventForm.venue" maxlength="120" placeholder="e.g. Main oval, Track 1" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label></fieldset>
    <label v-if="!eventSelected && eventMeasurement(eventForm.event_definition_id)==='time_ms'" class="block text-sm font-semibold">Race lanes
     <input v-model="eventForm.race_lanes" type="number" min="1" max="12" placeholder="Use current default" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/>
    </label>
    <label class="block text-sm font-semibold">Maximum participants<input v-model="eventForm.max_participants" type="number" min="1" max="10000" placeholder="Optional" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="flex items-center gap-3 text-sm font-semibold"><input v-model="eventForm.is_team" type="checkbox" class="h-4 w-4"/>Team event</label>
    <div class="flex justify-end gap-3"><button type="button" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="eventDialog=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button><button type="submit" :disabled="eventBusy||!availableDefinitions.length" aria-label="Save event" title="Save event" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5V3h11l5 5v13ZM7 21v-8h10v8M7 3v5h8"/></svg></button></div>
   </form>
  </section>
 </div>
 <div v-if="eventConfirm||eventDelete" class="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl"><h3 class="text-lg font-bold">{{eventDelete?'Delete event?':'Save event?'}}</h3><p class="mt-3 text-sm">{{eventDelete?'Are you sure you want to remove this event?':'Are you sure you want to save this competition event?'}}</p><div class="mt-6 flex justify-end gap-3"><button :disabled="eventBusy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="eventConfirm=false;eventDelete=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button><button :disabled="eventBusy" :aria-label="eventDelete?'Confirm delete':'Confirm save'" :title="eventDelete?'Confirm delete':'Confirm save'" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50" @click="eventDelete?deleteEvent():saveEvent()"><svg v-if="eventDelete" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg><svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5V3h11l5 5v13ZM7 21v-8h10v8M7 3v5h8"/></svg></button></div></section></div>

 <div v-if="setupDialog" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-label="Manage age group or division" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h3 class="mb-4 text-lg font-bold">{{setupSelected?'Edit':'Add'}} {{setupKind==='age'?'age group':'division'}}</h3><form class="space-y-4" @submit.prevent="setupConfirm=true"><label class="block text-sm font-semibold">Name<input v-model="setupForm.name" required maxlength="80" placeholder="e.g. Under 14 or Girls" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><div v-if="setupKind==='age'" class="grid grid-cols-2 gap-3"><label class="text-sm font-semibold">Minimum age<input v-model="setupForm.min_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label><label class="text-sm font-semibold">Maximum age<input v-model="setupForm.max_age" type="number" min="3" max="30" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label></div><div class="flex justify-end gap-3"><button type="button" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="setupDialog=false">✕</button><button type="submit" aria-label="Save" title="Save" class="rounded-xl bg-blue-600 p-3 text-white">▣</button></div></form></section></div>
 <div v-if="setupConfirm||setupDelete" class="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h3 class="text-lg font-bold">{{setupDelete?'Delete this item?':'Save changes?'}}</h3><p class="mt-3 text-sm">Are you sure you want to {{setupDelete?'delete':'save'}} this {{setupKind==='age'?'age group':'division'}}?</p><div class="mt-5 flex justify-end gap-3"><button :disabled="setupBusy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="setupConfirm=false;setupDelete=false">✕</button><button :disabled="setupBusy" aria-label="Confirm" title="Confirm" class="rounded-xl bg-blue-600 p-3 text-white" @click="setupDelete?removeSetup():saveSetup()">{{setupDelete?'▤':'▣'}}</button></div></section></div>
 <div v-if="presetConfirm||cutoffConfirm" class="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h3 class="text-lg font-bold">{{presetConfirm?'Apply age-group preset?':'Save age cutoff?'}}</h3><p class="mt-3 text-sm">{{presetConfirm?'Add missing age groups and selected divisions? Existing entries and events will not be deleted.':'Are you sure you want to update the competition age cutoff settings?'}}</p><div class="mt-5 flex justify-end gap-3"><button :disabled="presetBusy||cutoffBusy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="presetConfirm=false;cutoffConfirm=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button><button :disabled="presetBusy||cutoffBusy" aria-label="Confirm" title="Confirm" class="rounded-xl bg-blue-600 p-3 text-white" @click="presetConfirm?applyPreset():saveCutoff()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></button></div></section></div>
 <div v-if="scoringDialog" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-label="Competition scoring settings" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h2 class="mb-2 text-lg font-bold">Competition scoring</h2><p class="mb-4 text-sm text-[var(--muted)]">{{scoringCompetition?.name}}</p><p v-if="scoringLoading">Loading scoring settings…</p><form v-else class="space-y-4" @submit.prevent="scoringConfirm=true"><label class="block text-sm font-semibold">Placing points (1st, 2nd, 3rd, etc.)<input v-model="scoringForm.points" required placeholder="10, 8, 6, 5, 4, 3, 2, 1" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/><span class="mt-1 block text-xs font-normal text-[var(--muted)]">Comma-separated points, up to 30 placings. Remaining places earn 0.</span></label><div class="flex flex-wrap gap-2"><span v-for="(points,i) in pointsPreview" :key="i" class="rounded-lg border border-[var(--border)] px-2 py-1 text-xs">{{i+1}}{{i===0?'st':i===1?'nd':i===2?'rd':'th'}}: {{points}} pts</span></div><label class="block text-sm font-semibold">Team points multiplier<input v-model="scoringForm.team_multiplier" type="number" min="0" max="20" step="0.01" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/><span class="mt-1 block text-xs font-normal text-[var(--muted)]">1 = same as individual; 2 = double points for team events.</span></label><label class="flex items-center gap-3 text-sm font-semibold"><input v-model="scoringForm.allow_ties" type="checkbox"/> Allow tied placings</label><p class="text-xs text-[var(--muted)]">These settings define future scoring rules. Existing recorded results are not recalculated by saving.</p><div class="flex justify-end gap-3"><button type="button" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="scoringDialog=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button><button type="submit" :disabled="!scoringCompetition||!canEdit(scoringCompetition)||scoringBusy" aria-label="Save scoring settings" title="Save scoring settings" class="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5V3h11l5 5v13ZM7 21v-8h10v8"/></svg></button></div></form></section></div>
 <div v-if="scoringConfirm" class="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><h3 class="text-lg font-bold">Save competition scoring?</h3><p class="mt-3 text-sm">Are you sure you want to save these scoring settings?</p><div class="mt-5 flex justify-end gap-3"><button :disabled="scoringBusy" aria-label="Cancel" title="Cancel" class="rounded-xl border border-[var(--border)] p-3 text-red-700" @click="scoringConfirm=false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button><button :disabled="scoringBusy" aria-label="Confirm save" title="Confirm save" class="rounded-xl bg-blue-600 p-3 text-white" @click="saveScoring"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></button></div></section></div>

</div>
</template>