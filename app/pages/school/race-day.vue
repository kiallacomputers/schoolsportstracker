<script setup lang="ts">
definePageMeta({layout:'workspace'})
const db=useSupabaseClient()
const {schoolId}=useSchool()
const competitions=ref<any[]>([]),events=ref<any[]>([]),rounds=ref<any[]>([]),entries=ref<any[]>([]),results=ref<any[]>([]),houses=ref<any[]>([]),totals=ref<any[]>([])
const competitionId=ref(''),eventId=ref(''),roundId=ref('')
const heatDialog=ref(false),heatEvent=ref<any>(null),heatEntries=ref<any[]>([]),heatParticipants=ref<any[]>([]),heatStudents=ref<any[]>([]),heatLoading=ref(false),heatError=ref(''),heatSaving=ref(false),heatSaved=ref(false),heatAllocations=ref<any[]>([]),heatResults=ref<any[]>([]),heatResultRows=ref<Record<string,{status:string;performance_value:string}>>({}),heatResultsSaving=ref(false),heatResultsNotice=ref('')
const heatLaneCount=computed(()=>Math.max(1,Math.min(12,Number(heatEvent.value?.race_lanes)||8)))
const heatGroups=computed(()=>{const lanes=heatLaneCount.value;const count=Math.ceil(heatEntries.value.length/lanes);const groups:Array<Array<{entry_id:string;lane:number;name:string;house:string}>>=Array.from({length:count},()=>[]);heatEntries.value.forEach((entry,i)=>{const members=heatParticipants.value.filter(p=>p.entry_id===entry.id).map(p=>heatStudents.value.find(st=>st.id===p.student_id)).filter(Boolean);const name=entry.team_name||members.map(st=>[st.given_name,st.family_name].filter(Boolean).join(' ')).join(', ')||'Unknown participant';const group=i%count;groups[group].push({entry_id:entry.id,lane:Math.floor(i/count)+1,name,house:houses.value.find(h=>h.id===entry.house_id)?.name||'Unassigned'})});return groups})
async function previewHeats(ev:any){heatEvent.value=ev;heatEntries.value=[];heatParticipants.value=[];heatStudents.value=[];heatError.value='';heatSaved.value=false;heatAllocations.value=[];heatResults.value=[];heatResultRows.value={};heatResultsNotice.value='';heatDialog.value=true;heatLoading.value=true;try{const {data:alloc,error:allocError}=await db.from('race_heat_allocations').select('entry_id,heat_number,lane_number').eq('competition_event_id',ev.id).order('heat_number').order('lane_number');if(allocError)throw allocError;heatAllocations.value=alloc||[];heatSaved.value=heatAllocations.value.length>0;const {data:existingHeatResults,error:hrError}=await db.from('race_heat_results').select('entry_id,status,performance_value').eq('competition_event_id',ev.id);if(hrError)throw hrError;heatResults.value=existingHeatResults||[];heatResultRows.value=Object.fromEntries(heatResults.value.map(x=>[x.entry_id,{status:x.status,performance_value:x.performance_value==null?'':String(x.performance_value)}]));const {data:en,error:e}=await db.from('event_entries').select('id,house_id,team_name').eq('competition_event_id',ev.id).order('id');if(e)throw e;heatEntries.value=en||[];if(!heatEntries.value.length)return;const {data:ep,error:pe}=await db.from('entry_participants').select('entry_id,student_id').in('entry_id',heatEntries.value.map(x=>x.id));if(pe)throw pe;heatParticipants.value=ep||[];const ids=[...new Set(heatParticipants.value.map(p=>p.student_id))];if(ids.length){const {data:st,error:se}=await db.from('students').select('id,given_name,family_name').in('id',ids);if(se)throw se;heatStudents.value=st||[]}}catch(e:any){heatError.value=e.message||'Unable to preview heats'}finally{heatLoading.value=false}}
const displayedHeatGroups=computed(()=>{
 if(!heatSaved.value)return heatGroups.value
 return [...new Set(heatAllocations.value.map(a=>a.heat_number))].sort((a,b)=>a-b).map(heat=>heatAllocations.value.filter(a=>a.heat_number===heat).sort((a,b)=>a.lane_number-b.lane_number).map(a=>{
  const entry=heatEntries.value.find(e=>e.id===a.entry_id)
  const members=heatParticipants.value.filter(p=>p.entry_id===a.entry_id).map(p=>heatStudents.value.find(st=>st.id===p.student_id)).filter(Boolean)
  return {entry_id:a.entry_id,lane:a.lane_number,name:entry?.team_name||members.map(st=>[st.given_name,st.family_name].filter(Boolean).join(' ')).join(', ')||'Unknown participant',house:houses.value.find(h=>h.id===entry?.house_id)?.name||'Unassigned'}
 }))
})
async function saveHeats(){
 if(!heatEvent.value||heatSaved.value||heatSaving.value||!heatEntries.value.length)return
 heatSaving.value=true;heatError.value=''
 try{
  const allocation=heatGroups.value.flatMap((group,i)=>group.map(person=>({competition_event_id:heatEvent.value.id,entry_id:person.entry_id,heat_number:i+1,lane_number:person.lane})))
  const {error}=await db.from('race_heat_allocations').insert(allocation)
  if(error)throw error
  heatAllocations.value=allocation;heatSaved.value=true
  notice.value='Heat allocations saved for '+eventLabel(heatEvent.value)
 }catch(e:any){heatError.value=e.message||'Unable to save heat allocations';const {data}=await db.from('race_heat_allocations').select('entry_id,heat_number,lane_number').eq('competition_event_id',heatEvent.value.id);heatAllocations.value=data||[];heatSaved.value=heatAllocations.value.length>0}
 finally{heatSaving.value=false}
}
const heatResultsComplete=computed(()=>heatSaved.value&&heatAllocations.value.length>0&&heatAllocations.value.every(a=>heatResults.value.some(r=>r.entry_id===a.entry_id)))
const heatQualifiers=computed(()=>{
 if(!heatResultsComplete.value)return []
 const lanes=heatLaneCount.value
 const results=heatResults.value.filter(r=>r.status==='valid'&&r.performance_value!=null).map(r=>({...r,heat_number:heatAllocations.value.find(a=>a.entry_id===r.entry_id)?.heat_number||0}))
 const heatCount=new Set(heatAllocations.value.map(a=>a.heat_number)).size
 const automaticPlaces=heatCount>1?Math.min(2,Math.floor(lanes/heatCount)):lanes
 const sorted=[...results].sort((a,b)=>Number(a.performance_value)-Number(b.performance_value))
 const autoIds=new Set<string>()
 for(const heat of new Set(results.map(r=>r.heat_number))){
  const group=sorted.filter(r=>r.heat_number===heat)
  const threshold=group[Math.min(automaticPlaces,group.length)-1]?.performance_value
  for(const r of group)if(threshold!=null&&Number(r.performance_value)<=Number(threshold))autoIds.add(r.entry_id)
 }
 const remaining=sorted.filter(r=>!autoIds.has(r.entry_id))
 const cutoff=remaining[Math.max(0,lanes-autoIds.size)-1]?.performance_value
 return sorted.filter(r=>autoIds.has(r.entry_id)||(autoIds.size<lanes&&cutoff!=null&&Number(r.performance_value)<=Number(cutoff))).map(r=>({...r,method:autoIds.has(r.entry_id)?'Heat position':'Fastest remaining'}))
})
async function saveHeatResults(){
 if(!heatEvent.value||!heatSaved.value||heatResultsSaving.value)return
 heatResultsSaving.value=true;heatError.value='';heatResultsNotice.value=''
 try{
  const rows=heatAllocations.value.map(a=>({competition_event_id:heatEvent.value.id,entry_id:a.entry_id,status:heatResultRows.value[a.entry_id]?.status||'valid',performance_value:heatResultRows.value[a.entry_id]?.status==='valid'?Number(heatResultRows.value[a.entry_id]?.performance_value):null}))
  if(rows.some(r=>r.status==='valid'&&(!Number.isSafeInteger(r.performance_value)||Number(r.performance_value)<=0)))throw new Error('Enter a positive whole-number time for every runner, or choose DNS, DNF or DQ.')
  const {error:e}=await db.from('race_heat_results').upsert(rows,{onConflict:'competition_event_id,entry_id'})
  if(e)throw e
  const {data,error:readError}=await db.from('race_heat_results').select('entry_id,status,performance_value').eq('competition_event_id',heatEvent.value.id)
  if(readError)throw readError
  heatResults.value=data||[];heatResultsNotice.value='Heat results saved. Review the provisional final qualifiers below.'
 }catch(e:any){heatError.value=e.message||'Unable to save heat results'}finally{heatResultsSaving.value=false}
}
const resultsDialog=ref(false),editingResults=ref(false),scheduleRows=ref<any[]>([]),scheduleLoading=ref(false),scheduleError=ref('')
const scheduleView=computed(()=>[...scheduleRows.value].sort((a,b)=>String(a.scheduled_on||'9999').localeCompare(String(b.scheduled_on||'9999'))||String(a.starts_at||'99:99').localeCompare(String(b.starts_at||'99:99'))||(a.schedule_order??9999)-(b.schedule_order??9999)||(a.round_order??0)-(b.round_order??0)))
async function openScheduledRound(row:any){
 if(row.locked)return
 const ev=events.value.find(e=>e.id===row.event_id)
 if(ev&&String(row.event_name||'').trim().toLowerCase().startsWith('100m')&&!String(row.event_name||'').toLowerCase().includes('freestyle')){
  const {data:alloc,error:allocError}=await db.from('race_heat_allocations').select('entry_id').eq('competition_event_id',row.event_id).limit(1)
  if(allocError){error.value=allocError.message;return}
  if(alloc?.length){await previewHeats(ev);return}
 }
 eventId.value=row.event_id;await loadRounds();roundId.value=row.id;await loadResults();await loadRecordBaselines();editingResults.value=results.value.length===0;resultsDialog.value=true
}
async function closeScheduledRound(){if(busy.value||publishing.value)return;if(editingResults.value&&batchDirty.value&&!window.confirm('Discard unsaved result changes?'))return;resultsDialog.value=false;editingResults.value=false;await loadSchedule()}
async function loadSchedule(){
 if(!competitionId.value)return
 scheduleLoading.value=true;scheduleError.value=''
 try{
  const ids=events.value.map(e=>e.id)
  if(!ids.length){scheduleRows.value=[];return}
  const [rr,ee]=await Promise.all([db.from('event_rounds').select('id,name,round_order,competition_event_id').in('competition_event_id',ids),db.from('event_entries').select('id,competition_event_id').in('competition_event_id',ids)])
  if(rr.error||ee.error)throw rr.error||ee.error
  const roundsAll=rr.data||[]
  const resultResponse=roundsAll.length?await db.from('event_results').select('round_id,entry_id,published_at').in('round_id',roundsAll.map(r=>r.id)):null
  if(resultResponse?.error)throw resultResponse.error
  const resultAll=resultResponse?.data||[]
  scheduleRows.value=roundsAll.map(r=>{
   const ev=events.value.find(e=>e.id===r.competition_event_id)
   const entryIds=new Set((ee.data||[]).filter(e=>e.competition_event_id===r.competition_event_id).map(e=>e.id))
   const status=(round:any)=>{const saved=resultAll.filter(x=>x.round_id===round.id&&entryIds.has(x.entry_id));return entryIds.size&&saved.length===entryIds.size&&saved.every(x=>!!x.published_at)?'Published':saved.length?'Results entered':'Ready'}
   const locked=roundsAll.some(prev=>prev.competition_event_id===r.competition_event_id&&(prev.round_order??0)<(r.round_order??0)&&status(prev)!=='Published')
   return {...r,registered_count:entryIds.size,event_id:r.competition_event_id,event_name:ev?.event_definitions?.name||'Event',age_group:ev?.age_group||'',division:ev?.division||'',scheduled_on:ev?.scheduled_on,starts_at:ev?.starts_at,schedule_order:ev?.schedule_order,locked,status:status(r)==='Published'?'Published':locked?'Awaiting previous round':status(r)}
  })
 }catch(e:any){scheduleError.value=e.message||'Unable to load running order'}finally{scheduleLoading.value=false}
}

const completedRoundIds=ref<string[]>([])
const availableRounds=computed(()=>rounds.value.filter(r=>!completedRoundIds.value.includes(r.id)))
const multipleActiveCompetitions=computed(()=>competitions.value.filter(c=>c.status==='active').length>1)
const loading=ref(false),busy=ref(false),error=ref(''),notice=ref(''),confirm=ref(false),publishConfirm=ref(false),publishing=ref(false)
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
 if(entryBusy.value||!eventId.value)return
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
   await loadRounds()
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
const form=reactive({entry_id:'',performance_value:'',status:'valid'})
const selectedEvent=computed(()=>events.value.find(e=>e.id===eventId.value))
const lowerIsBetter=computed(()=>/^(time|duration)/i.test(String(selectedEvent.value?.event_definitions?.measurement||'')))
const placingPreview=computed(()=>{
 if(form.status!=='valid'||!/^\d+$/.test(form.performance_value))return null
 const value=Number(form.performance_value)
 return 1+results.value.filter(r=>r.entry_id!==form.entry_id&&r.status==='valid'&&r.performance_value!=null&&(lowerIsBetter.value?Number(r.performance_value)<value:Number(r.performance_value)>value)).length
})
const selectedRound=computed(()=>rounds.value.find(r=>r.id===roundId.value))
const selectedResult=computed(()=>results.value.find(r=>r.entry_id===form.entry_id))
const allResultsEntered=computed(()=>entries.value.length>0&&entries.value.every(e=>results.value.some(r=>r.entry_id===e.id)))
const roundPublished=computed(()=>allResultsEntered.value&&results.value.every(r=>!!r.published_at))
const sortedRoundResults=computed(()=>[...results.value].sort((a,b)=>(a.placing_position??Number.MAX_SAFE_INTEGER)-(b.placing_position??Number.MAX_SAFE_INTEGER)||Number(b.performance_value??-1)-Number(a.performance_value??-1)||entryName(entries.value.find(e=>e.id===a.entry_id)).localeCompare(entryName(entries.value.find(e=>e.id===b.entry_id)))))
const houseName=(id:string)=>houses.value.find(h=>h.id===id)?.name||'Unassigned'
const eventLabel=(e:any)=>[e?.event_definitions?.name||'Event',e?.age_group,e?.division].filter(Boolean).join(' · ')
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
  const active=c.filter((competition:any)=>competition.status==='active')
  if(active.length===1){competitionId.value=active[0].id;await loadEvents()}
  else if(active.length>1)error.value='More than one active competition was found for this school. Resolve this in Competitions before using Race Day.'
 }catch(e:any){error.value=e.message||'Unable to load competitions'}finally{loading.value=false}
}
async function loadEvents(){
 eventId.value='';roundId.value='';events.value=[];totals.value=[]
 if(!competitionId.value)return
 loading.value=true;error.value=''
 try{
  const [e,t]=await Promise.all([
   query('competition_events','id,competition_id,event_definition_id,age_group,division,is_team,min_age,max_age,max_participants,race_lanes,scheduled_on,starts_at,schedule_order,event_definitions(name,measurement)','competition_id',competitionId.value),
   query('competition_house_totals','competition_id,school_id,house_id,total_points,scored_results','competition_id',competitionId.value)
  ])
  events.value=e;totals.value=t.filter((v:any)=>v.school_id===schoolId.value)
  await loadStudents()
  await loadSchedule()
 }catch(e:any){error.value=e.message||'Unable to load events'}finally{loading.value=false}
}
async function loadRounds(){
 roundId.value='';rounds.value=[];entries.value=[];results.value=[];batchRows.value=[];completedRoundIds.value=[]
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
  await refreshRoundAvailability()
  if(availableRounds.value.length===1){roundId.value=availableRounds.value[0].id;await loadResults()}
 }catch(e:any){error.value=e.message||'Unable to load rounds'}finally{loading.value=false}
}
async function refreshRoundAvailability(){
 completedRoundIds.value=[]
 if(!rounds.value.length||!entries.value.length)return
 const {data,error:e}=await db.from('event_results').select('round_id,entry_id,published_at').in('round_id',rounds.value.map(r=>r.id))
 if(e)throw e
 const registered=new Set(entries.value.map(e=>e.id))
 completedRoundIds.value=rounds.value.filter(round=>{
  const records=(data||[]).filter(r=>r.round_id===round.id&&registered.has(r.entry_id))
  return records.length===registered.size&&new Set(records.map(r=>r.entry_id)).size===registered.size&&records.every(r=>!!r.published_at)
 }).map(r=>r.id)
}
async function loadResults(){
 results.value=[];form.entry_id=''
 if(!roundId.value)return
 try{results.value=await query('event_results','id,entry_id,placing_position,performance_value,status,points,published_at,record_badge','round_id',roundId.value);populateBatch()}
 catch(e:any){error.value=e.message||'Unable to load results'}
}
const recordBaselines=ref<any[]>([]),recordCheckError=ref('')
async function loadRecordBaselines(){
 recordBaselines.value=[];recordCheckError.value=''
 const ev=selectedEvent.value
 if(!schoolId.value||!ev)return
 const {data,error:e}=await db.from('school_records').select('record_scope,performance_value').eq('school_id',schoolId.value).eq('event_definition_id',ev.event_definition_id).eq('age_group',ev.age_group).eq('division',ev.division).in('record_scope',['SR','ISR'])
 if(e){recordCheckError.value='Record benchmarks unavailable: '+e.message;return}
 recordBaselines.value=data||[]
}
function potentialRecords(row:{entry_id:string;performance_value:string;status:string}){
 if(row.status!=='valid'||!validPerformance(row.performance_value))return []
 return ['SR','ISR'].filter(scope=>{
  if(scope==='SR'&&batchPlace(row)!==1)return false
  const b=recordBaselines.value.find(x=>x.record_scope===scope)
  return b&&b.performance_value!=null&&(lowerIsBetter.value?Number(row.performance_value)<Number(b.performance_value):Number(row.performance_value)>Number(b.performance_value))
 })
}
const batchRows=ref<{entry_id:string;performance_value:string;status:string}[]>([])
const batchSnapshot=ref('')
const batchDirty=computed(()=>JSON.stringify(batchRows.value)!==batchSnapshot.value)
function populateBatch(){batchRows.value=entries.value.map(e=>{const r=results.value.find(v=>v.entry_id===e.id);return {entry_id:e.id,performance_value:r?.performance_value==null?'':String(r.performance_value),status:r?.status||'valid'}});batchSnapshot.value=JSON.stringify(batchRows.value)}
const validPerformance=(value:string)=>String(value??'').trim()!==''&&Number.isSafeInteger(Number(value))&&Number(value)>0
const batchReady=computed(()=>batchRows.value.length>0&&batchRows.value.every(r=>r.status!=='valid'||validPerformance(r.performance_value)))
function batchPlace(row:{entry_id:string;performance_value:string;status:string}){if(row.status!=='valid'||!validPerformance(row.performance_value))return null;return 1+batchRows.value.filter(r=>r.entry_id!==row.entry_id&&r.status==='valid'&&validPerformance(r.performance_value)&&(lowerIsBetter.value?Number(r.performance_value)<Number(row.performance_value):Number(r.performance_value)>Number(row.performance_value))).length}
function askBatchSave(){if(!batchReady.value){error.value='Enter a positive whole-number performance for each valid result, or select DNS, DNF or DQ.';return}if(roundPublished.value){error.value='Published results are read-only';return}error.value='';confirm.value=true}
async function saveBatch(){if(busy.value||!roundId.value)return;busy.value=true;confirm.value=false;error.value='';notice.value='';let saved=0
 try{if(!batchReady.value)throw new Error('Complete all valid performances first')
 for(const row of batchRows.value){const old=results.value.find(r=>r.entry_id===row.entry_id);if(old?.published_at)throw new Error('Cannot change published results')
 const payload={round_id:roundId.value,entry_id:row.entry_id,status:row.status,performance_value:row.status==='valid'?Number(row.performance_value):null,placing_position:batchPlace(row),published_at:null}
 const r=old?await db.from('event_results').update(payload).eq('id',old.id).is('published_at',null):await db.from('event_results').insert(payload)
 if(r.error)throw r.error;saved++}
 await loadResults();editingResults.value=false;notice.value=saved+' results saved as drafts. Publish the round when ready.'
 }catch(e:any){error.value='Saved '+saved+' of '+batchRows.value.length+'. '+(e.message||'Save failed');await loadResults()}finally{busy.value=false}}
const unrecordedEntries=computed(()=>entries.value.filter(e=>!results.value.some(r=>r.entry_id===e.id)))
function editEntry(entry:any){
 if(!entry)return
 const result=results.value.find(r=>r.entry_id===entry.id)
 Object.assign(form,{entry_id:entry.id,performance_value:result?.performance_value==null?'':String(result.performance_value),status:result?.status||'valid'})
 notice.value='';error.value=''
}
function validate(){
 if(!roundId.value||!form.entry_id)throw new Error('Select a round and participant')
 if(form.status==='valid'&&(!form.performance_value||!/^\d+$/.test(form.performance_value)))throw new Error('Valid results require a whole-number performance value in the event measurement unit')
}
function askSave(){try{validate();error.value='';confirm.value=true}catch(e:any){error.value=e.message}}
async function save(){
 if(busy.value)return
 busy.value=true;confirm.value=false;error.value=''
 try{
  validate()
  const payload:any={round_id:roundId.value,entry_id:form.entry_id,status:form.status,placing_position:form.status==='valid'?placingPreview.value:null,performance_value:form.performance_value===''?null:Number(form.performance_value),published_at:selectedResult.value?.published_at||null}
  const old=selectedResult.value
  const r=old?await db.from('event_results').update(payload).eq('id',old.id):await db.from('event_results').insert(payload)
  if(r.error)throw r.error
  await loadResults()
  const ranked=results.value.filter(r=>r.status==='valid'&&r.performance_value!=null)
  for(const result of results.value){
   const position=result.status==='valid'&&result.performance_value!=null
    ?1+ranked.filter(v=>lowerIsBetter.value?Number(v.performance_value)<Number(result.performance_value):Number(v.performance_value)>Number(result.performance_value)).length
    :null
   if(result.placing_position!==position){
    const {error:rankError}=await db.from('event_results').update({placing_position:position}).eq('id',result.id)
    if(rankError)throw rankError
   }
  }
  await loadResults()
  const {data,error:e}=await db.from('competition_house_totals').select('competition_id,school_id,house_id,total_points,scored_results').eq('competition_id',competitionId.value)
  if(e)throw e
  totals.value=(data||[]).filter((v:any)=>v.school_id===schoolId.value)
  notice.value='Result saved successfully'
 }catch(e:any){error.value=e.message||'Unable to save result'}finally{busy.value=false}
}
async function publishRound(){
 if(publishing.value||!roundId.value||!allResultsEntered.value||roundPublished.value)return
 publishing.value=true;publishConfirm.value=false;error.value=''
 try{
  const {data:current,error:readError}=await db.from('event_results').select('id,entry_id,status,performance_value,placing_position,published_at').eq('round_id',roundId.value)
  if(readError)throw readError
  if(!current||current.length!==entries.value.length||!entries.value.every(e=>current.some(r=>r.entry_id===e.id)))throw new Error('Not every registered participant has a result. Refresh and review before publishing.')
  if(current.some(r=>r.status==='valid'&&(r.performance_value==null||r.placing_position==null)))throw new Error('Some valid results have missing performances or placings.')
  const timestamp=new Date().toISOString()
  for(const result of current.filter(r=>!r.published_at)){
   const {error:publishError}=await db.from('event_results').update({published_at:timestamp}).eq('id',result.id).is('published_at',null)
   if(publishError)throw publishError
  }
  await loadResults()
  const {data:updatedTotals,error:totalsError}=await db.from('competition_house_totals').select('competition_id,school_id,house_id,total_points,scored_results').eq('competition_id',competitionId.value)
  if(totalsError)throw totalsError
  totals.value=(updatedTotals||[]).filter((t:any)=>t.school_id===schoolId.value)
  await refreshRoundAvailability()
  if(completedRoundIds.value.includes(roundId.value)){roundId.value='';results.value=[];batchRows.value=[];if(availableRounds.value.length===1){roundId.value=availableRounds.value[0].id;await loadResults()}}
  await loadSchedule()
  notice.value='Round results published and house points updated'
 }catch(e:any){error.value=e.message||'Unable to publish round results. Refresh to check progress before retrying.'}
 finally{publishing.value=false}
}
watch(schoolId,loadCompetitions,{immediate:true})
</script>
<template>
<div class="space-y-6">
 <header><h1 class="text-3xl font-extrabold">Event Day</h1><p class="mt-2 text-[var(--muted)]">Enter results, publish placings and monitor house points.</p></header>
 <p v-if="error" role="alert" class="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">{{error}}</p>
 <p v-if="notice" role="status" class="rounded-xl border border-green-300 bg-green-50 p-4 text-green-800">{{notice}}</p>
 <UiPanel>
 <div class="mb-4 flex items-center justify-between gap-3"><div><h2 class="text-lg font-bold">Event Day running order</h2><p class="text-xs text-[var(--muted)]">Scheduled times are set by the School Admin.</p></div><button type="button" class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" :disabled="scheduleLoading" @click="loadSchedule">Refresh</button></div>
 <p v-if="!competitionId&&!loading" class="text-sm">No active competition. Activate a competition to begin Event Day.</p>
 <p v-if="scheduleError" role="alert" class="text-sm text-red-600">{{scheduleError}}</p>
 <p v-if="scheduleLoading" class="text-sm">Loading running order…</p>
 <div v-else-if="competitionId" class="overflow-x-auto"><table class="w-full min-w-[560px] text-left text-sm"><thead class="bg-[var(--panel)]"><tr><th class="p-3">Time</th><th class="p-3">Event</th><th class="p-3 text-center">Registered</th><th class="p-3">Round</th><th class="p-3">Status</th><th class="p-3 text-right">Action</th></tr></thead><tbody><tr v-for="row in scheduleView" :key="row.id" class="border-b border-[var(--border)]"><td class="p-3">{{row.starts_at?String(row.starts_at).slice(0,5):'Unscheduled'}}</td><td class="p-3"><div class="font-semibold">{{row.event_name}}</div><div class="mt-0.5 text-xs text-[var(--muted)]">{{[row.age_group,row.division].filter(Boolean).join(" · ")||"All ages"}}</div></td><td class="p-3 text-center"><span class="inline-flex min-w-9 justify-center rounded-lg border border-[var(--border)] px-2 py-1 font-semibold" :class="row.registered_count===0?'text-amber-600':'text-blue-600'">{{row.registered_count}}</span></td><td class="p-3">{{row.name}}</td><td class="p-3" :class="row.locked?'text-amber-600':row.status==='Published'?'text-green-600':'text-blue-600'">{{row.status}}</td><td class="p-3 text-right"><button v-if="String(row.event_name || '').trim().toLowerCase().startsWith('100m') && !String(row.event_name || '').toLowerCase().includes('freestyle')" type="button" title="Heats" aria-label="Heats" class="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" @click="previewHeats(events.find(e=>e.id===row.event_id))"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M4 16c0-1 2-1 2 0 0 1-2 2-2 3h2"/></svg></button><button type="button"  :title="String(row.event_name||'').toLowerCase().startsWith('100m')?'View heat results':'View results'" :aria-label="String(row.event_name||'').toLowerCase().startsWith('100m')?'View heat results':'View results'" class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40" :disabled="row.locked" @click="openScheduledRound(row)"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 17v-3M12 17v-6M16 17v-4"/></svg></button></td></tr></tbody></table><p v-if="!scheduleView.length" class="py-4 text-sm">No event rounds configured yet.</p></div>
 </UiPanel>
 <div v-if="heatDialog" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" @click.self="heatDialog=false"><section role="dialog" aria-modal="true" aria-label="Heat allocation preview" class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl"><div class="mb-3 flex items-center justify-between gap-3"><h2 class="text-xl font-bold">Heat allocation · {{eventLabel(heatEvent)}}</h2><button type="button" title="Close" aria-label="Close heat preview" class="rounded-lg border px-3 py-2" @click="heatDialog=false">✕</button></div><p class="mb-4 text-sm text-[var(--muted)]">{{heatSaved?'Saved heat and lane allocations.':'Review the proposed heat allocation, then save it.'}} {{heatLaneCount}} lanes per heat. Heat result entry and final qualification will follow in the next stage.</p><p v-if="heatLoading">Loading participants…</p><p v-else-if="heatError" role="alert" class="text-red-600">{{heatError}}</p><p v-else-if="!heatEntries.length">No registered participants.</p><div v-else class="space-y-4"><div v-for="(group,i) in displayedHeatGroups" :key="i" class="rounded-lg border border-[var(--border)] p-3"><h3 class="mb-2 font-bold">Heat {{i+1}} · {{group.length}} participants</h3><table class="w-full text-left text-sm"><thead><tr><th class="py-1">Lane</th><th>Student</th><th>House</th></tr></thead><tbody><tr v-for="person in group" :key="person.lane" class="border-t border-[var(--border)]"><td class="py-2">{{person.lane}}</td><td>{{person.name}}</td><td>{{person.house}}</td></tr></tbody></table></div><div v-if="heatSaved" class="space-y-3"><h3 class="text-lg font-bold">Enter heat results</h3><p class="text-sm text-[var(--muted)]">Times use the event's whole-number measurement unit. For 100m, enter milliseconds (e.g. 14520 = 14.520 seconds). DNS, DNF and DQ do not require a time.</p><div v-for="(group,heatIndex) in displayedHeatGroups" :key="'result-'+heatIndex" class="rounded-lg border border-[var(--border)] p-3"><h4 class="mb-2 font-semibold">Heat {{heatIndex+1}}</h4><div v-for="person in group" :key="person.entry_id" class="grid grid-cols-1 items-center gap-2 border-t border-[var(--border)] py-2 sm:grid-cols-[1fr_110px_110px]"><div class="text-sm">{{person.name}} <span class="text-xs text-[var(--muted)]">· Lane {{person.lane}}</span></div><select :value="heatResultRows[person.entry_id]?.status||'valid'" @change="heatResultRows[person.entry_id]={status:($event.target as HTMLSelectElement).value,performance_value:heatResultRows[person.entry_id]?.performance_value||''}" class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"><option value="valid">Valid</option><option value="dns">DNS</option><option value="dnf">DNF</option><option value="dq">DQ</option></select><input type="number" min="1" step="1" placeholder="Time (ms)" :aria-label="'Time for '+person.name" :disabled="(heatResultRows[person.entry_id]?.status||'valid')!=='valid'" :value="heatResultRows[person.entry_id]?.performance_value||''" @input="heatResultRows[person.entry_id]={status:heatResultRows[person.entry_id]?.status||'valid',performance_value:($event.target as HTMLInputElement).value}" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm disabled:opacity-40"/></div></div><div class="flex flex-wrap items-center justify-between gap-3"><p v-if="heatResultsNotice" role="status" class="text-sm text-green-600">{{heatResultsNotice}}</p><button type="button" :disabled="heatResultsSaving" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" @click="saveHeatResults">{{heatResultsSaving?'Saving…':'Save heat results'}}</button></div><div v-if="heatResultsComplete" class="rounded-lg border border-[var(--border)] p-3"><h4 class="font-bold">Provisional final qualifiers ({{heatQualifiers.length}})</h4><p class="mb-2 text-xs text-[var(--muted)]">Top two per heat, then fastest remaining times up to the available lanes. Ties at the cutoff are included. These are a preview only; the Final has not been populated.</p><div v-for="r in heatQualifiers" :key="r.entry_id" class="flex justify-between gap-3 border-t border-[var(--border)] py-1 text-sm"><span>{{displayedHeatGroups.flat().find(p=>p.entry_id===r.entry_id)?.name||'Runner'}}</span><span>{{(Number(r.performance_value)/1000).toFixed(3)}}s · {{r.method}}</span></div></div></div><div class="flex justify-end gap-3"><span v-if="heatSaved" class="text-sm font-semibold text-green-600">Allocations saved</span><button v-else type="button" :disabled="heatSaving" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" @click="saveHeats">{{heatSaving?'Saving…':'Save heat allocations'}}</button></div></div></section></div>
 <div v-if="resultsDialog" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-6" @click.self="closeScheduledRound"><section role="dialog" aria-modal="true" aria-label="Event results" class="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] text-[var(--ink)] shadow-2xl"><header class="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 class="text-xl font-bold">{{eventLabel(selectedEvent)}} · {{selectedRound?.name}}</h2></div><button type="button" aria-label="Close results" title="Close" class="rounded-lg border px-3 py-2" @click="closeScheduledRound">✕</button></header><div class="min-h-0 overflow-y-auto p-4 sm:p-6">
 <div v-if="roundId" class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-[var(--muted)]">{{roundPublished?'Published results are read-only.':editingResults?'Enter or edit draft results below.':'Review saved results or switch to editing without leaving this window.'}}</p><button v-if="!roundPublished && !editingResults" type="button" title="Enter or edit results" aria-label="Enter or edit results" class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-blue-600" @click="editingResults=true"><span class="inline-flex items-center gap-2"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18h6"/><path d="m15 13 3 3-3 3"/></svg>Enter / Edit Results</span></button></div>
 <UiPanel v-if="editingResults">
  <div class="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-bold">Enter round results</h2><p class="text-xs text-[var(--muted)]">{{selectedRound?.name}} · {{results.length}}/{{entries.length}} saved</p></div><div class="flex gap-2"><button type="button" class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" :disabled="busy" @click="populateBatch">Reset</button><button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" :disabled="busy||roundPublished||!batchReady||!batchDirty" @click="askBatchSave">{{busy?'Saving…':'Save all results'}}</button></div></div>
  <div class="overflow-x-auto rounded-lg border border-[var(--border)]"><table class="w-full min-w-[490px] text-left text-sm"><thead class="bg-[var(--panel)] text-xs"><tr><th class="px-3 py-2">Student / team</th><th class="px-2 py-2">House</th><th class="px-2 py-2">Performance</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Place</th><th class="px-2 py-2">Records</th></tr></thead><tbody><tr v-for="row in batchRows" :key="row.entry_id" class="border-t border-[var(--border)]"><td class="px-3 py-1.5 font-medium">{{entryName(entries.find(e=>e.id===row.entry_id))}}</td><td class="px-2 py-1.5 text-xs">{{houseName(entries.find(e=>e.id===row.entry_id)?.house_id)}}</td><td class="px-2 py-1.5"><input v-model="row.performance_value" type="number" min="1" step="1" :disabled="roundPublished||row.status!=='valid'" :aria-label="'Performance for '+entryName(entries.find(e=>e.id===row.entry_id))" class="w-28 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 disabled:opacity-40" placeholder="Value"/></td><td class="px-2 py-1.5"><select v-model="row.status" :disabled="roundPublished" :aria-label="'Status for '+entryName(entries.find(e=>e.id===row.entry_id))" class="w-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"><option value="valid">Valid</option><option value="dns">DNS</option><option value="dnf">DNF</option><option value="dq">DQ</option></select></td><td class="px-2 py-1.5 font-bold">{{batchPlace(row)??'—'}}</td><td class="px-2 py-1.5"><div class="flex flex-wrap gap-1"><span v-for="scope in potentialRecords(row)" :key="scope" class="rounded px-2 py-1 text-xs font-semibold" :class="scope==='SR'?'bg-amber-100 text-amber-900':'bg-violet-100 text-violet-900'">{{scope==='ISR'?'ISR Standard':'Potential SR'}}</span><span v-if="!potentialRecords(row).length" class="text-xs text-[var(--muted)]">—</span></div></td></tr></tbody></table></div>
  <p v-if="recordCheckError" role="alert" class="mt-2 text-xs text-red-600">{{recordCheckError}}</p><p v-else class="mt-2 text-xs text-[var(--muted)]">Potential SR appears for first place (including ties); ISR Standard appears for every performance beating the saved interschool benchmark, regardless of placing or competition type. These are provisional; official ISR recognition requires verification. <span v-if="!recordBaselines.length">No matching SR/ISR benchmarks are saved.</span></p><p v-if="!entries.length" class="mt-3 text-sm text-[var(--muted)]">Register participants to enter results.</p><p class="mt-2 text-xs text-[var(--muted)]">Enter millimetres for distance or milliseconds for time. Placings calculate automatically.</p>
 </UiPanel>
 <UiPanel><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-bold">Round results</h2><p class="text-xs text-[var(--muted)]">{{results.length}}/{{entries.length}} saved · {{roundPublished?'Published':'Draft'}}</p></div><button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" :disabled="!allResultsEntered||roundPublished||publishing||batchDirty" @click="publishConfirm=true">{{roundPublished?'Results published':'Publish Results'}}</button></div><p v-if="batchDirty" class="mt-2 text-xs text-amber-700">Save changes before publishing.</p><div class="mt-3 flex flex-wrap gap-2 text-xs"><span v-for="r in sortedRoundResults" :key="r.id" class="rounded-md border border-[var(--border)] px-2 py-1">{{r.placing_position??'—'}} · {{entryName(entries.find(e=>e.id===r.entry_id))}} <strong v-if="r.record_badge" class="rounded px-1" :class="r.record_badge==='SR'?'bg-[#C99700] text-[#1F1700]':'bg-violet-100 text-violet-900'">{{r.record_badge}}</strong> · {{r.points||0}} pts</span></div></UiPanel>
 </div>
 <UiPanel v-if="competitionId"><h2 class="mb-4 text-xl font-bold">House leaderboard</h2><p v-if="!orderedTotals.length" class="text-[var(--muted)]">House points will appear when valid results are published.</p><div v-for="(t,i) in orderedTotals" :key="t.house_id" class="flex items-center justify-between border-b border-[var(--border)] py-3"><div class="flex items-center gap-3"><strong>{{i+1}}</strong><span class="h-4 w-4 rounded-full" :style="{background:houses.find(h=>h.id===t.house_id)?.colour||'#64748b'}"/><span>{{houseName(t.house_id)}}</span></div><strong>{{t.total_points}} points</strong></div></UiPanel>
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
 </div></section></div>
 <div v-if="publishConfirm" class="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" aria-label="Publish round results" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"><h2 class="text-xl font-bold">Publish all round results?</h2><p class="mt-3 text-[var(--muted)]">This publishes all {{results.length}} results for {{selectedRound?.name}} and awards house points using the competition scoring scheme.</p><div class="mt-6 flex justify-end gap-3"><button type="button" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="publishConfirm=false">Cancel</button><button type="button" class="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white" :disabled="publishing" @click="publishRound">Confirm publish</button></div></section></div>
 <div v-if="confirm" class="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"><section role="alertdialog" aria-modal="true" class="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"><h2 class="text-xl font-bold">Save result?</h2><p class="mt-3 text-[var(--muted)]">Confirm saving all entered results as drafts. Publish separately when ready.</p><div class="mt-6 flex justify-end gap-3"><button type="button" aria-label="Cancel" class="rounded-xl border border-[var(--border)] px-4 py-2" @click="confirm=false">Cancel</button><button type="button" aria-label="Confirm save" :disabled="busy" class="rounded-xl bg-blue-600 px-4 py-2 text-white" @click="saveBatch">Confirm save</button></div></section></div>
</div>
</template>
