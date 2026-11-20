<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
const db = useSupabaseClient()
type Issue = { id:string; reference_number:number; title:string; description:string; category:string; priority:string; status:string; area:string; assigned_to:string; resolution:string; created_at:string; updated_at:string; created_by:string }
type IssueComment = {id:string; issue_id:string; comment:string; created_at:string}
const issues = ref<Issue[]>([])
const comments = ref<IssueComment[]>([])
const loading = ref(true), busy = ref(false), error = ref(''), success = ref('')
const selected = ref<Issue|null>(null), showCreate = ref(false)
const search = ref(''), statusFilter = ref('all'), categoryFilter = ref('all')
const draft = reactive({title:'',description:'',category:'improvement',priority:'medium',area:'General',assigned_to:''})
const edit = reactive({title:'',description:'',category:'improvement',priority:'medium',status:'new',area:'General',assigned_to:'',resolution:''})
const newComment = ref('')
const categories = ['fault','improvement','idea','task']
const priorities = ['low','medium','high','critical']
const statuses = ['new','in_progress','on_hold','resolved','closed']
const label = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const stats = computed(()=>({total:issues.value.length,open:issues.value.filter(x=>!['resolved','closed'].includes(x.status)).length,urgent:issues.value.filter(x=>['high','critical'].includes(x.priority)&&!['resolved','closed'].includes(x.status)).length,done:issues.value.filter(x=>['resolved','closed'].includes(x.status)).length}))
const visible = computed(()=>issues.value.filter(x=> (statusFilter.value==='all'||x.status===statusFilter.value) && (categoryFilter.value==='all'||x.category===categoryFilter.value) && `${x.reference_number} ${x.title} ${x.description} ${x.area} ${x.assigned_to}`.toLowerCase().includes(search.value.toLowerCase())))
const date = (v:string)=>new Date(v).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})
function selectIssue(issue:Issue){showCreate.value=false;selected.value=issue;Object.assign(edit,{title:issue.title,description:issue.description,category:issue.category,priority:issue.priority,status:issue.status,area:issue.area,assigned_to:issue.assigned_to,resolution:issue.resolution});newComment.value='';void loadComments(issue.id)}
async function load(){loading.value=true;error.value='';const {data,error:e}=await db.from('management_issues').select('*').order('created_at',{ascending:false});issues.value=(data||[]) as Issue[];if(e)error.value=e.message;loading.value=false}
async function loadComments(id:string){const {data,error:e}=await db.from('management_issue_comments').select('id,issue_id,comment,created_at').eq('issue_id',id).order('created_at',{ascending:true});comments.value=(data||[]) as IssueComment[];if(e)error.value=e.message}
async function createIssue(){if(busy.value)return;error.value='';success.value='';if(draft.title.trim().length<3){error.value='Enter a title of at least 3 characters.';return}busy.value=true;try{const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Sign in again.');const {data,error:e}=await db.from('management_issues').insert({title:draft.title.trim(),description:draft.description.trim(),category:draft.category,priority:draft.priority,area:draft.area.trim()||'General',assigned_to:draft.assigned_to.trim(),created_by:user.id}).select('*').single();if(e)throw e;showCreate.value=false;Object.assign(draft,{title:'',description:'',category:'improvement',priority:'medium',area:'General',assigned_to:''});await load();success.value='Issue created.'}catch(e:any){error.value=e.message||'Unable to create issue.'}finally{busy.value=false}}
async function saveIssue(){if(!selected.value||busy.value)return;error.value='';success.value='';busy.value=true;try{const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Sign in again.');const {error:e}=await db.from('management_issues').update({title:edit.title.trim(),description:edit.description.trim(),category:edit.category,priority:edit.priority,status:edit.status,area:edit.area.trim()||'General',assigned_to:edit.assigned_to.trim(),resolution:edit.resolution.trim(),updated_by:user.id}).eq('id',selected.value.id);if(e)throw e;const id=selected.value.id;await load();const updated=issues.value.find(x=>x.id===id);selected.value=null;success.value='Changes saved.'}catch(e:any){error.value=e.message||'Unable to save changes.'}finally{busy.value=false}}
async function addComment(){if(!selected.value||!newComment.value.trim()||busy.value)return;error.value='';busy.value=true;try{const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Sign in again.');const {error:e}=await db.from('management_issue_comments').insert({issue_id:selected.value.id,comment:newComment.value.trim(),created_by:user.id});if(e)throw e;newComment.value='';await loadComments(selected.value.id)}catch(e:any){error.value=e.message||'Unable to add comment.'}finally{busy.value=false}}

const exporting = ref(false)
async function exportIssue() {
  if (!selected.value || exporting.value) return
  exporting.value = true
  error.value = ''
  try {
    // Fetch fresh saved values and every comment so the export is complete.
    const issueId = selected.value.id
    const { data: issue, error: issueError } = await db.from('management_issues')
      .select('*').eq('id', issueId).single()
    if (issueError) throw issueError
    const { data: notes, error: notesError } = await db.from('management_issue_comments')
      .select('comment,created_at,created_by').eq('issue_id', issueId)
      .order('created_at', { ascending: true })
    if (notesError) throw notesError
    const clean = (value: unknown) => String(value ?? '').trim()
    const item = issue as Issue
    const lines = [
      `# School Sports Tracker V2 — Issue #${item.reference_number}`,
      '',
      `**Title:** ${clean(item.title)}`,
      `**Type:** ${label(clean(item.category))}`,
      `**Priority:** ${label(clean(item.priority))}`,
      `**Status:** ${label(clean(item.status))}`,
      `**Area:** ${clean(item.area)}`,
      `**Assigned to:** ${clean(item.assigned_to) || 'Unassigned'}`,
      `**Created:** ${clean(item.created_at)}`,
      `**Updated:** ${clean(item.updated_at)}`,
      `**Issue ID:** ${clean(item.id)}`,
      '',
      '## Description',
      '',
      clean(item.description) || '(No description)',
      '',
      '## Resolution / Outcome',
      '',
      clean(item.resolution) || '(Not yet resolved)',
      '',
      '## Comments & Progress Updates',
      ''
    ]
    if (!notes?.length) lines.push('(No comments recorded)', '')
    for (const note of notes ?? []) {
      lines.push(`### ${clean(note.created_at)}`, '', clean(note.comment), '')
    }
    lines.push('---', '', 'Exported from the School Sports Tracker V2 Improvements & Faults Log.',
      'This export is a snapshot. Review the current issue before applying changes.', '')
    const blob = new Blob([lines.join('\\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `SST-Issue-${item.reference_number}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e: any) {
    error.value = e?.message || 'Unable to export issue.'
  } finally {
    exporting.value = false
  }
}

function closeModal(){if(busy.value)return;showCreate.value=false;selected.value=null;error.value=''}
function onEscape(event:KeyboardEvent){if(event.key==='Escape')closeModal()}
watch([showCreate,selected],()=>{if(import.meta.client)document.body.style.overflow=(showCreate.value||selected.value)?'hidden':''})
onMounted(()=>{load();window.addEventListener('keydown',onEscape)})
onBeforeUnmount(()=>{window.removeEventListener('keydown',onEscape);document.body.style.overflow=''})

</script>
<template>
  <div class="issues-page">
    <header class="hero">
      <div class="hero-content">
        <div><h1>Improvements &amp; Faults</h1><p>Track problems, development ideas and progress in one place.</p></div>
        <button class="primary" @click="error='';success='';selected=null;showCreate=true">＋ New Item</button>
      </div>
    </header>

    <div class="page-body">
      <div class="stats">
        <div class="metric"><span>Total Items</span><strong>{{stats.total}}</strong></div>
        <div class="metric"><span>Open Items</span><strong>{{stats.open}}</strong></div>
        <div class="metric"><span>High / Critical Open</span><strong>{{stats.urgent}}</strong></div>
        <div class="metric"><span>Resolved / Closed</span><strong>{{stats.done}}</strong></div>
      </div>
      <div v-if="error && !showCreate && !selected" class="alert" role="alert">{{error}}</div>
      <div v-if="success" class="notice" role="status">{{success}}</div>
      <section class="panel">
        <div class="panel-title"><div><h2>Issue Register</h2><p class="muted">Select any item to view or edit it.</p></div><button class="subtle" @click="load">↻ Refresh</button></div>
        <div class="filters"><input v-model="search" placeholder="Search number, title, area…" aria-label="Search issues"><select v-model="statusFilter" aria-label="Filter status"><option value="all">All statuses</option><option v-for="s in statuses" :key="s" :value="s">{{label(s)}}</option></select><select v-model="categoryFilter" aria-label="Filter category"><option value="all">All types</option><option v-for="c in categories" :key="c" :value="c">{{label(c)}}</option></select></div>
        <p v-if="loading" class="muted">Loading issues…</p>
        <p v-else-if="!visible.length" class="muted">No matching items.</p>
        <div v-else class="issue-list">
          <button v-for="item in visible" :key="item.id" class="issue-row" @click="error='';success='';selectIssue(item)">
            <span class="issue-top"><strong>#{{item.reference_number}} · {{item.title}}</strong><span class="pill" :class="item.priority">{{label(item.priority)}}</span></span>
            <span class="issue-bottom"><span>{{label(item.category)}} · {{item.area}}</span><span>{{label(item.status)}}</span></span>
            <small>{{date(item.created_at)}}<template v-if="item.assigned_to"> · {{item.assigned_to}}</template></small>
          </button>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="showCreate || selected" class="issue-modal-backdrop" @click.self="closeModal">
        <section class="issue-modal" role="dialog" aria-modal="true" :aria-label="showCreate?'New Item':`Item #${selected?.reference_number}`">
          <div class="modal-heading">
            <div><div class="eyebrow">{{showCreate?'NEW MANAGEMENT ITEM':'ISSUE DETAILS'}}</div><h2>{{showCreate?'Create New Item':`Item #${selected?.reference_number}`}}</h2></div>
            <div class="modal-heading-actions">
              <button v-if="selected" class="export-button" type="button" :disabled="exporting" @click="exportIssue">{{ exporting ? 'Exporting…' : '↓ Export Issue' }}</button>
              <button class="modal-close" aria-label="Close window" @click="closeModal">✕</button>
            </div>
          </div>
          <div class="modal-content">
            <div v-if="error" class="alert" role="alert">{{error}}</div>
            <form v-if="showCreate" class="editor" @submit.prevent="createIssue">
              <label>Title<input v-model="draft.title" maxlength="180" required minlength="3" placeholder="What needs attention?"></label>
              <label>Description<textarea v-model="draft.description" rows="5" placeholder="Describe the fault or proposed improvement"></textarea></label>
              <div class="twocol"><label>Type<select v-model="draft.category"><option v-for="c in categories" :key="c" :value="c">{{label(c)}}</option></select></label><label>Priority<select v-model="draft.priority"><option v-for="p in priorities" :key="p" :value="p">{{label(p)}}</option></select></label></div>
              <div class="twocol"><label>Area / Module<input v-model="draft.area" placeholder="e.g. Competitions"></label><label>Assigned to<input v-model="draft.assigned_to" placeholder="Name or team"></label></div>
              <div class="modal-actions"><button type="button" class="subtle" @click="closeModal">Cancel</button><button class="primary" type="submit" :disabled="busy">{{busy?'Saving…':'Create Item'}}</button></div>
            </form>
            <template v-else-if="selected">
              <form class="editor" @submit.prevent="saveIssue">
                <label>Title<input v-model="edit.title" required minlength="3" maxlength="180"></label>
                <label>Description<textarea v-model="edit.description" rows="4"></textarea></label>
                <div class="twocol"><label>Type<select v-model="edit.category"><option v-for="c in categories" :key="c" :value="c">{{label(c)}}</option></select></label><label>Priority<select v-model="edit.priority"><option v-for="p in priorities" :key="p" :value="p">{{label(p)}}</option></select></label></div>
                <div class="twocol"><label>Status<select v-model="edit.status"><option v-for="s in statuses" :key="s" :value="s">{{label(s)}}</option></select></label><label>Assigned to<input v-model="edit.assigned_to"></label></div>
                <label>Area / Module<input v-model="edit.area"></label>
                <label>Resolution / Outcome<textarea v-model="edit.resolution" rows="3" placeholder="What was changed or decided?"></textarea></label>
                <div class="modal-actions"><button type="button" class="subtle" @click="closeModal">Cancel</button><button class="primary" type="submit" :disabled="busy">{{busy?'Saving…':'Save Changes'}}</button></div>
              </form>
              <div class="discussion"><h3>Comments &amp; Updates</h3><p v-if="!comments.length" class="muted">No comments yet.</p><div v-for="c in comments" :key="c.id" class="comment"><p>{{c.comment}}</p><small>{{date(c.created_at)}}</small></div><form @submit.prevent="addComment"><textarea v-model="newComment" rows="3" maxlength="4000" placeholder="Add a progress note" required></textarea><button class="subtle" type="submit" :disabled="busy||!newComment.trim()">Add Comment</button></form></div>
            </template>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
<style scoped>
.issues-page{color:#eaf3ff;max-width:1600px;margin:auto}.crumb{font-size:12px;color:#78b8ff;margin-bottom:18px}.crumb span{padding:0 10px;color:#7993b2}.eyebrow{color:#73b9ff;letter-spacing:2px;font-size:10px;font-weight:700}.heading{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:24px}.heading h1{font-size:clamp(25px,3vw,34px);margin:6px 0}.heading p{color:#a9c6e7;margin:0}.primary,.subtle{cursor:pointer;border-radius:9px;padding:11px 16px;font-weight:700}.primary{background:#0964cf;color:white;border:1px solid #3a95ff}.subtle{background:#173557;color:#dbeaff;border:1px solid #38618e}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.metric,.panel{background:linear-gradient(140deg,#112e51,#0b213e);border:1px solid #315e8c;border-radius:14px}.metric{padding:18px 20px}.metric span{font-size:12px;color:#a9c9ed;display:block}.metric strong{font-size:32px;display:block;margin-top:7px}.workgrid{display:grid;grid-template-columns:minmax(300px,1fr) minmax(350px,1.2fr);gap:16px}.panel{padding:18px;min-width:0}.panel-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}.panel h2{font-size:19px;margin:0}.filters{display:grid;grid-template-columns:1fr 145px 125px;gap:8px;margin-bottom:15px}.issues-page input,.issues-page select,.issues-page textarea{width:100%;box-sizing:border-box;background:#091c33;color:#f4f9ff;border:1px solid #42678e;border-radius:8px;padding:11px;font:inherit;min-width:0}.issues-page input:focus,.issues-page select:focus,.issues-page textarea:focus{outline:2px solid #4a9dff;outline-offset:1px}.issue-list{display:flex;flex-direction:column;gap:8px;max-height:680px;overflow:auto}.issue-row{width:100%;text-align:left;background:#0c2543;border:1px solid #2e537d;border-radius:10px;color:#e9f4ff;padding:14px;cursor:pointer}.issue-row:hover,.issue-row.active{background:#154779;border-color:#56a6ff}.issue-top,.issue-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px}.issue-top strong{font-size:14px;overflow-wrap:anywhere}.issue-bottom{font-size:12px;color:#b9d2ee;margin:9px 0}.issue-row small,.comment small{color:#93b7df}.pill{font-size:10px;border:1px solid #3f6b9c;border-radius:999px;padding:4px 8px;white-space:nowrap}.pill.high,.pill.critical{color:#ffb6a8;border-color:#e16b63}.pill.low{color:#a8dfc5}.editor{display:flex;flex-direction:column;gap:14px}.editor label{display:block;color:#bad4f0;font-size:12px;font-weight:650}.editor label input,.editor label select,.editor label textarea{display:block;margin-top:6px;font-size:14px;font-weight:400}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:12px}.discussion{margin-top:28px;border-top:1px solid #365c83;padding-top:15px}.discussion h3{font-size:16px}.comment{background:#0b2442;border-radius:9px;padding:10px 13px;margin:8px 0}.comment p{white-space:pre-wrap;margin:0 0 8px}.discussion form{display:grid;gap:10px;margin-top:14px}.discussion button{justify-self:start}.empty{text-align:center;padding:80px 25px;color:#abc9e8}.empty span{font-size:38px}.muted{color:#a9c6e7}.alert,.notice{padding:12px;border-radius:8px;margin-bottom:15px;background:#51252b;color:#ffd1d1}.notice{background:#153e33;color:#a8f3c7}@media(max-width:1150px){.workgrid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.heading{align-items:flex-start;flex-direction:column}.stats{gap:8px}.metric{padding:13px}.filters{grid-template-columns:1fr 1fr}.filters input{grid-column:1/-1}.twocol{grid-template-columns:1fr}.panel{padding:12px}}
</style>

<style>
.issues-page{max-width:none}
.hero{display:flex;align-items:center;position:relative;isolation:isolate;box-sizing:border-box;margin:0 0 27px;min-height:190px;padding:30px 34px;border:1px solid #2b4d75;border-radius:16px;background-image:linear-gradient(90deg,rgba(6,17,37,.97) 0%,rgba(6,17,37,.84) 38%,rgba(6,17,37,.24) 100%),url('/images/sports-embossed-header.webp');background-position:center,center 15%;background-size:cover,cover;background-repeat:no-repeat;overflow:hidden}
.hero-content{display:flex;align-items:center;justify-content:space-between;gap:24px;width:100%}
.hero h1{font-size:clamp(27px,3vw,39px);letter-spacing:-.04em;margin:0 0 8px}
.hero p{color:#9eb9d9;margin:0;font-size:14px}
.page-body{max-width:1600px;margin:0 auto}
.panel-title p{margin:5px 0 0}
.issue-list{max-height:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.issue-modal-backdrop{position:fixed;inset:0;background:rgba(1,9,22,.78);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(5px)}
.issue-modal{width:min(760px,100%);max-height:min(90dvh,950px);display:flex;flex-direction:column;background:#102b4b;border:1px solid #4d7fb1;border-radius:17px;box-shadow:0 25px 90px rgba(0,0,0,.55);color:#edf5ff;overflow:hidden}
.modal-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 26px;background:linear-gradient(110deg,#164475,#0a2442);border-bottom:1px solid #37638e}
.modal-heading h2{font-size:23px;margin:7px 0 0}
.modal-close{background:#193e63;border:1px solid #4e7aab;color:white;border-radius:9px;padding:9px 13px;cursor:pointer}
.modal-content{padding:24px 26px;overflow:auto;overscroll-behavior:contain}
.modal-content input,.modal-content select,.modal-content textarea{width:100%;box-sizing:border-box;background:#091c33;color:#f4f9ff;border:1px solid #42678e;border-radius:8px;padding:11px;font:inherit}
.modal-content label{color:#bad4f0;font-size:12px;font-weight:650}
.modal-content label input,.modal-content label select,.modal-content label textarea{display:block;margin-top:6px;font-size:14px;font-weight:400}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:8px}
@media(max-width:900px){.issue-list{grid-template-columns:1fr}}
@media(max-width:650px){.hero{margin:0 0 18px;min-height:165px;padding:24px 20px;background-position:center,center 15%}.hero-content{align-items:flex-start;flex-direction:column}.issue-modal-backdrop{padding:8px;align-items:flex-end}.issue-modal{max-height:96dvh;border-radius:16px 16px 0 0}.modal-heading,.modal-content{padding:16px}}
</style>

<style>
.modal-heading-actions{display:flex;align-items:center;gap:10px}
.export-button{border:1px solid #75a9dc;background:#205c98;color:#fff;border-radius:9px;padding:10px 14px;cursor:pointer;font:inherit;font-weight:650;white-space:nowrap}
.export-button:hover:not(:disabled){background:#2b76bd}
.export-button:disabled{opacity:.6;cursor:wait}
@media(max-width:440px){.modal-heading-actions{gap:5px}.export-button{padding:8px;font-size:12px}.modal-close{padding:8px}}
</style>

<style>
/* Teleported modal: these rules must not be scoped to the page root. */
.issue-modal, .issue-modal * { box-sizing: border-box; }
.issue-modal .modal-content { width:100%; min-width:0; flex:1 1 auto; overflow-y:auto; overflow-x:hidden; }
.issue-modal .editor { display:flex; flex-direction:column; width:100%; gap:16px; margin:0; }
.issue-modal .editor > label { display:block; width:100%; min-width:0; }
.issue-modal .editor label { display:block; min-width:0; }
.issue-modal .editor label > input,
.issue-modal .editor label > select,
.issue-modal .editor label > textarea { display:block; width:100%; min-width:0; margin-top:7px; }
.issue-modal .editor textarea { resize:vertical; min-height:85px; }
.issue-modal .editor .twocol { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); width:100%; gap:14px; }
.issue-modal .editor .twocol > label { min-width:0; width:100%; }
.issue-modal .editor .modal-actions { position:sticky; bottom:-24px; z-index:2; display:flex; align-items:center; justify-content:flex-end; gap:10px; margin:4px -26px -24px; padding:16px 26px; border-top:1px solid #345c84; background:#102b4b; }
.issue-modal .discussion { width:100%; }
.issue-modal .discussion textarea { display:block; width:100%; }
@media(max-width:650px) {
 .issue-modal .editor .twocol { grid-template-columns:minmax(0,1fr); }
 .issue-modal .editor .modal-actions { bottom:-16px; margin:4px -16px -16px; padding:14px 16px; }
}
</style>
