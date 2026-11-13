<script setup lang="ts">
const db=useSupabaseClient(),route=useRoute()
const school=computed(()=>typeof route.query.school==='string'?route.query.school:'')
const loading=ref(true),busy=ref(false),error=ref(''),notice=ref('')
const competitions=ref<any[]>([]),events=ref<any[]>([]),definitions=ref<any[]>([]),rounds=ref<any[]>([])
const competitionId=ref(''),eventId=ref('')
const eventLabel=(e:any)=>`${definitions.value.find(d=>d.id===e.event_definition_id)?.name||'Event'} — ${e.age_group||'Open'} ${e.division||''}`
const chosen=computed(()=>events.value.find(e=>e.id===eventId.value))
const grouped=computed(()=>{const map=new Map<string,any>();for(const r of rounds.value){if(!map.has(r.round_id))map.set(r.round_id,{id:r.round_id,type:r.round_type,number:r.round_number,status:r.round_status,runners:[]});if(r.entry_id)map.get(r.round_id).runners.push(r)}return [...map.values()]})
const heatCount=computed(()=>grouped.value.filter(r=>r.type==='heat').length)
const canFinal=computed(()=>heatCount.value>0 && grouped.value.filter(r=>r.type==='heat').every(r=>r.status==='complete')&&!grouped.value.some(r=>r.type==='final'))
const edits=ref<Record<string,{time:string,status:string}>>({})
async function load(){loading.value=true;error.value='';try{
 const {data:{user}}=await db.auth.getUser();if(!user){await navigateTo('/login');return}
 if(!school.value)throw new Error('Open Race Day from a selected school.')
 const [m,p,c,d]=await Promise.all([
 db.from('school_memberships').select('role').eq('school_id',school.value).eq('user_id',user.id).maybeSingle(),db.rpc('is_platform_admin'),
 db.from('competitions').select('id,name,school_year').eq('organiser_school_id',school.value).eq('competition_type','intra_school').order('school_year',{ascending:false}),
 db.from('event_definitions').select('id,name')]);for(const r of [m,p,c,d])if(r.error)throw r.error
 if(!p.data&&!['school_admin','teacher'].includes(m.data?.role))throw new Error('School Administrator or Teacher access required.')
 competitions.value=c.data||[];definitions.value=d.data||[];competitionId.value=competitions.value[0]?.id||'';await loadEvents()
 }catch(e:any){error.value=e.message||'Unable to load race day'}finally{loading.value=false}}
async function loadEvents(){events.value=[];rounds.value=[];if(!competitionId.value)return
 const r=await db.from('competition_events').select('id,event_definition_id,age_group,division,race_lanes,race_max_heats,race_qualification,is_team').eq('competition_id',competitionId.value).eq('is_team',false).not('race_lanes','is',null)
 if(r.error)throw r.error;events.value=r.data||[];eventId.value=events.value[0]?.id||'';await loadRounds()}
async function loadRounds(){rounds.value=[];edits.value={};if(!eventId.value)return
 const r=await db.rpc('school_race_rounds',{p_school:school.value,p_event:eventId.value});if(r.error)throw r.error
 rounds.value=r.data||[];for(const x of rounds.value)if(x.entry_id)edits.value[`${x.round_id}:${x.entry_id}`]={time:x.time_ms==null?'':(x.time_ms/1000).toFixed(3),status:x.result_status==='pending'?'valid':x.result_status}}
async function action(name:string,args:any,success:string){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{const r=await db.rpc(name,args);if(r.error)throw r.error;notice.value=success.replace('{count}',String(r.data??''));await loadRounds()}catch(e:any){error.value=e.message||'Operation failed'}finally{busy.value=false}}
function generate(){if(!confirm('Generate heats from current registrations? This cannot be undone.'))return;action('school_race_generate',{p_school:school.value,p_event:eventId.value},'Generated {count} race round(s).')}
function finalise(r:any){if(!confirm(`Mark ${r.type} ${r.number} complete? Times will be locked.`))return;action('school_race_complete_round',{p_school:school.value,p_round:r.id},'Round completed.')}
function generateFinal(){if(!confirm('Calculate qualifiers and generate the final? This cannot be undone.'))return;action('school_race_generate_final',{p_school:school.value,p_event:eventId.value},'Final generated with {count} runners.')}
function save(r:any){const v=edits.value[`${r.round_id}:${r.entry_id}`];if(!v)return;const time=v.status==='valid'?Math.round(Number(v.time)*1000):null
 if(v.status==='valid'&&(!v.time||!Number.isFinite(time)||time<0)){error.value='Enter a valid time in seconds';return}
 action('school_race_save_time',{p_school:school.value,p_round:r.round_id,p_entry:r.entry_id,p_time:time,p_status:v.status},'Runner result saved.')}
watch(competitionId,async()=>{if(!loading.value)try{await loadEvents()}catch(e:any){error.value=e.message}})
watch(eventId,async()=>{if(!loading.value)try{await loadRounds()}catch(e:any){error.value=e.message}})
onMounted(load)
</script>
<template><div class="page"><div class="shell admin-section">
 <NuxtLink :to="{path:'/school/dashboard',query:{school}}">← School Dashboard</NuxtLink>
 <h1>Race Day — Heats &amp; Finals</h1>
 <p class="notice">Generate only the heats required for registered students. Record every runner's result, complete each heat, then calculate finalists. Race generation is permanent for this version.</p>
 <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
 <p v-if="loading">Loading…</p><template v-else>
 <div class="card"><label class="field"><span>Competition</span><select v-model="competitionId"><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} ({{c.school_year}})</option></select></label>
 <label class="field"><span>Configured track race</span><select v-model="eventId"><option v-for="e in events" :key="e.id" :value="e.id">{{eventLabel(e)}}</option></select></label>
 <p v-if="chosen">{{chosen.race_lanes}} lanes × {{chosen.race_max_heats}} maximum heats · {{chosen.race_qualification}}</p>
 <button v-if="chosen&&!grouped.length" class="btn primary" :disabled="busy" @click="generate">Generate Heats / Straight Final</button>
 <button v-if="canFinal" class="btn primary" :disabled="busy" @click="generateFinal">Calculate Qualifiers &amp; Generate Final</button>
 </div>
 <div v-for="round in grouped" :key="round.id" class="card" style="margin-top:1rem">
 <h2>{{round.type==='final'?'Final':'Heat '+round.number}} — {{round.status}}</h2>
 <div v-for="r in round.runners" :key="r.entry_id" style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:end;margin-bottom:.8rem">
 <span style="min-width:11rem">Lane {{r.lane_number}} — {{r.student_name}}</span>
 <label class="field"><span>Time (seconds)</span><input v-model="edits[`${r.round_id}:${r.entry_id}`].time" type="number" min="0" step="0.001" :disabled="round.status==='complete'||edits[`${r.round_id}:${r.entry_id}`].status!=='valid'" /></label>
 <label class="field"><span>Result</span><select v-model="edits[`${r.round_id}:${r.entry_id}`].status" :disabled="round.status==='complete'"><option value="valid">Valid</option><option value="dns">DNS</option><option value="dnf">DNF</option><option value="dq">Disqualified</option></select></label>
 <button class="btn" :disabled="busy||round.status==='complete'" @click="save(r)">Save</button>
 </div>
 <button v-if="round.status!=='complete'" class="btn primary" :disabled="busy" @click="finalise(round)">Complete {{round.type==='final'?'Final':'Heat'}}</button>
 </div><p v-if="!chosen" class="notice">No track races configured. Configure lanes and maximum heats under Competitions first.</p>
 </template></div></div></template>
