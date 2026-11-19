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
 if(!school.value)throw new Error('Open Event Day from a selected school.')
 const [m,p,c,d]=await Promise.all([
 db.from('school_memberships').select('role').eq('school_id',school.value).eq('user_id',user.id).maybeSingle(),db.rpc('is_platform_admin'),
 db.from('competitions').select('id,name,school_year').eq('organiser_school_id',school.value).eq('competition_type','intra_school').order('school_year',{ascending:false}),
 db.from('event_definitions').select('id,name')]);for(const r of [m,p,c,d])if(r.error)throw r.error
 if(!p.data&&!['school_admin','teacher'].includes(m.data?.role))throw new Error('School Administrator or Teacher access required.')
 competitions.value=c.data||[];definitions.value=d.data||[];competitionId.value=competitions.value.some(c=>c.id===route.query.competition)?String(route.query.competition):(competitions.value[0]?.id||'');await loadEvents()
 }catch(e:any){error.value=e.message||'Unable to load Event Day'}finally{loading.value=false}}
async function loadEvents(){events.value=[];rounds.value=[];if(!competitionId.value)return
 const r=await db.from('competition_events').select('id,event_definition_id,age_group,division,race_lanes,race_max_heats,race_qualification,is_team').eq('competition_id',competitionId.value).eq('is_team',false).not('race_lanes','is',null)
 if(r.error)throw r.error;events.value=r.data||[];eventId.value=events.value.some(e=>e.id===route.query.event)?String(route.query.event):(events.value[0]?.id||'');await loadRounds()}
async function loadRounds(){rounds.value=[];edits.value={};if(!eventId.value)return
 const r=await db.rpc('school_race_rounds',{p_school:school.value,p_event:eventId.value});if(r.error)throw r.error
 rounds.value=r.data||[];for(const x of rounds.value)if(x.entry_id)edits.value[`${x.round_id}:${x.entry_id}`]={time:x.time_ms==null?'':(x.time_ms/1000).toFixed(3),status:x.result_status==='pending'?'valid':x.result_status}}
async function action(name:string,args:any,success:string){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{const r=await db.rpc(name,args);if(r.error)throw r.error;notice.value=success.replace('{count}',String(r.data??''));await loadRounds()}catch(e:any){error.value=e.message||'Operation failed'}finally{busy.value=false}}
type Confirmation = { title:string; message:string; warning:string; button:string; run:()=>Promise<void>|void }
const confirmation=ref<Confirmation|null>(null)
function closeConfirmation(){if(!busy.value)confirmation.value=null}
async function acceptConfirmation(){const pending=confirmation.value;if(!pending||busy.value)return;await pending.run();confirmation.value=null}
function generate(){
 if(!chosen.value||busy.value)return
 confirmation.value={title:'Generate Heats / Final',message:`Generate heats or a straight final for ${eventLabel(chosen.value)} using the current student registrations?`,warning:'Generated rounds cannot be undone through Event Day.',button:'Generate Rounds',run:()=>action('school_race_generate',{p_school:school.value,p_event:eventId.value},'Generated {count} race round(s).')}
}
function finalise(r:any){
 if(busy.value)return
 confirmation.value={title:`Complete ${r.type==='final'?'Final':'Heat '+r.number}`,message:'Mark this round complete and lock its recorded results?',warning:'Completed rounds cannot be edited through Event Day.',button:'Complete Round',run:()=>action('school_race_complete_round',{p_school:school.value,p_round:r.id},'Round completed.')}
}
function generateFinal(){
 if(busy.value)return
 confirmation.value={title:'Generate Final',message:'Calculate qualifiers from completed heats and generate the final?',warning:'Final generation cannot be undone through Event Day.',button:'Generate Final',run:()=>action('school_race_generate_final',{p_school:school.value,p_event:eventId.value},'Final generated with {count} participants.')}
}
function save(r:any){const v=edits.value[`${r.round_id}:${r.entry_id}`];if(!v)return;const time=v.status==='valid'?Math.round(Number(v.time)*1000):null
 if(v.status==='valid'&&(!v.time||!Number.isFinite(time)||time<0)){error.value='Enter a valid time in seconds';return}
 action('school_race_save_time',{p_school:school.value,p_round:r.round_id,p_entry:r.entry_id,p_time:time,p_status:v.status},'Runner result saved.')}
watch(competitionId,async()=>{if(!loading.value)try{await loadEvents()}catch(e:any){error.value=e.message}})
watch(eventId,async()=>{if(!loading.value)try{await loadRounds()}catch(e:any){error.value=e.message}})
onMounted(load)
</script>
<template><div class="page"><div class="shell admin-section">
 <NuxtLink :to="{path:'/school/dashboard',query:{school}}">← School Dashboard</NuxtLink>
 <h1>Event Day — Heats &amp; Finals</h1>
 <p class="notice">Generate only the heats required for registered students. Record every participant's result, complete each heat, then calculate finalists. Generated rounds cannot currently be undone from this page.</p>
 <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
 <p v-if="loading">Loading…</p><template v-else>
 <div class="card"><label class="field"><span>Competition</span><select v-model="competitionId"><option v-for="c in competitions" :key="c.id" :value="c.id">{{c.name}} ({{c.school_year}})</option></select></label>
 <label class="field"><span>Event (swimming / running / athletics)</span><select v-model="eventId"><option v-for="e in events" :key="e.id" :value="e.id">{{eventLabel(e)}}</option></select></label>
 <p v-if="chosen">{{chosen.race_lanes}} lanes × {{chosen.race_max_heats}} maximum heats · {{chosen.race_qualification}}</p>
 <button v-if="chosen&&!grouped.length" class="btn primary" :disabled="busy" @click="generate">Generate Heats / Straight Final</button>
 <button v-if="canFinal" class="btn primary" :disabled="busy" @click="generateFinal">Calculate Qualifiers &amp; Generate Final</button>
 </div>
 <div v-for="round in grouped" :key="round.id" class="card event-round" style="margin-top:1rem">
 <h2>{{round.type==='final'?'Final':'Heat '+round.number}} — {{round.status}}</h2>
 <div v-for="r in round.runners" :key="r.entry_id" class="event-runner">
 <strong class="event-runner-name">Lane {{r.lane_number}} — {{r.student_name}}</strong>
 <label class="field"><span>Time (seconds)</span><input v-model="edits[`${r.round_id}:${r.entry_id}`].time" type="number" min="0" step="0.001" :disabled="round.status==='complete'||edits[`${r.round_id}:${r.entry_id}`].status!=='valid'" /></label>
 <label class="field"><span>Result</span><select v-model="edits[`${r.round_id}:${r.entry_id}`].status" :disabled="round.status==='complete'"><option value="valid">Valid</option><option value="dns">DNS</option><option value="dnf">DNF</option><option value="dq">Disqualified</option></select></label>
 <button class="btn" :disabled="busy||round.status==='complete'" @click="save(r)">Save</button>
 </div>
 <button v-if="round.status!=='complete'" class="btn primary" :disabled="busy" @click="finalise(round)">Complete {{round.type==='final'?'Final':'Heat'}}</button>
 </div><p v-if="!chosen" class="notice">No lane-based races configured. Configure events under Competitions first.</p>
 </template>
 <div v-if="confirmation" class="event-modal-backdrop" @click.self="closeConfirmation" @keydown.esc="closeConfirmation">
  <section class="event-modal" role="alertdialog" aria-modal="true" aria-labelledby="event-modal-title" aria-describedby="event-modal-description">
   <div class="event-modal-heading"><span class="event-modal-icon" aria-hidden="true">🏁</span><div><h2 id="event-modal-title">{{confirmation.title}}</h2><p>Confirm Event Day action</p></div></div>
   <p id="event-modal-description" class="event-modal-message">{{confirmation.message}}</p>
   <p class="event-modal-warning"><span aria-hidden="true">⚠</span> {{confirmation.warning}}</p>
   <div class="event-modal-actions"><button type="button" class="btn event-modal-cancel" :disabled="busy" @click="closeConfirmation">Cancel</button><button type="button" class="btn primary" :disabled="busy" @click="acceptConfirmation">{{busy?'Processing…':confirmation.button}}</button></div>
  </section>
 </div>
 </div></div></template>

<style scoped>
.event-modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(1,9,23,.78);display:flex;align-items:center;justify-content:center;padding:1rem}
.event-modal{width:min(100%,480px);background:#0d2340;color:#f3f8ff;border:1px solid #38618c;border-radius:16px;padding:1.5rem;box-shadow:0 24px 70px rgba(0,0,0,.55)}
.event-modal-heading{display:flex;align-items:center;gap:1rem}.event-modal-heading h2{margin:0;font-size:1.35rem}.event-modal-heading p{margin:.3rem 0 0;color:#b9cce3;font-size:.85rem}.event-modal-icon{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;background:#173b63;border-radius:12px;font-size:1.5rem}
.event-modal-message{line-height:1.55;margin:1.5rem 0}.event-modal-warning{display:flex;gap:.6rem;align-items:flex-start;color:#f5d28a;font-size:.9rem;line-height:1.45;background:#273249;padding:.85rem;border-radius:9px}
.event-modal-actions{display:flex;justify-content:flex-end;gap:.7rem;border-top:1px solid #35577c;margin-top:1.5rem;padding-top:1.2rem}.event-modal-cancel{background:transparent;color:#e5efff;border:1px solid #567598}.event-modal-actions button{min-height:42px}
@media(max-width:480px){.event-modal-actions{flex-direction:column-reverse}.event-modal-actions button{width:100%}}

.event-runner{display:grid;grid-template-columns:minmax(180px,1.3fr) minmax(120px,1fr) minmax(140px,1fr) auto;gap:.75rem;align-items:end;margin:.75rem 0;padding:1rem;background:#102846;border:1px solid #34557b;border-radius:12px}
.event-runner-name{align-self:center}
.event-runner .field{min-width:0}
.event-runner input,.event-runner select{width:100%;min-height:44px;font-size:16px}
.event-runner .btn{min-height:44px}
@media(max-width:740px){.event-runner{grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding:.85rem}.event-runner-name{grid-column:1/-1}.event-runner .btn{grid-column:1/-1;width:100%}.event-round{padding:.8rem}}
@media(max-width:380px){.event-runner{grid-template-columns:1fr}.event-runner-name,.event-runner .btn{grid-column:auto}}
</style>
