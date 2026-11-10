<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const busy = ref(true), saving = ref(false), error = ref(''), notice = ref('')
const schoolName = ref(''), canEdit = ref(false)
const rows = ref<any[]>([]), houses = ref<any[]>([]), enrolments = ref<any[]>([])
const year = ref(new Date().getFullYear()), search = ref('')
const blank = () => ({id:'',student_number:'',given_name:'',family_name:'',date_of_birth:'',year_level:'',house_id:''})
const form = ref(blank()), editing = ref(false)
const modalOpen = ref(false)
const confirmSave = ref(false)
const modalError = ref('')
function startAdd() { form.value = blank(); editing.value = false; modalError.value = ''; confirmSave.value = false; modalOpen.value = true }
function closeModal() { if (saving.value) return; modalOpen.value = false; confirmSave.value = false; modalError.value = ''; reset() }
function requestSave() {
  modalError.value = ''
  if (!form.value.student_number.trim() || !form.value.given_name.trim() || !form.value.family_name.trim()) { modalError.value = 'Student number, first name and last name are required.'; return }
  confirmSave.value = true
}
const csvPreview = ref<any[]>([]), importing = ref(false), importReport = ref('')
const display = computed(() => rows.value.filter(s => `${s.given_name} ${s.family_name} ${s.student_number}`.toLowerCase().includes(search.value.toLowerCase())))
const enrolmentFor = (id:string) => enrolments.value.find(e => e.student_id === id)
async function load() {
  error.value = ''; busy.value = true
  try {
    const {data:{user}} = await db.auth.getUser()
    if (!user) { await navigateTo('/login'); return }
    if (!schoolId.value) throw new Error('Select a school from the School Dashboard.')
    const m = await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id).eq('school_id',schoolId.value).maybeSingle()
    if (m.error) throw m.error
    if (!m.data || !['school_admin','teacher'].includes(m.data.role)) throw new Error('You do not have access to this school.')
    canEdit.value = m.data.role === 'school_admin'
    schoolName.value = (m.data.schools as any)?.name || 'School'
    const [s,h,e] = await Promise.all([
      db.from('students').select('id,student_number,given_name,family_name,date_of_birth').eq('school_id',schoolId.value).order('family_name').limit(2000),
      db.from('school_houses').select('id,name,colour').eq('school_id',schoolId.value).order('name'),
      db.from('student_enrolments').select('id,student_id,school_year,year_level,house_id').eq('school_id',schoolId.value).eq('school_year',year.value).limit(2000)
    ])
    const failure = [s,h,e].find(x => x.error)?.error
    if (failure) throw failure
    rows.value = s.data || []; houses.value = h.data || []; enrolments.value = e.data || []
  } catch (e:any) { error.value = e.message || 'Unable to load students.' }
  finally { busy.value = false }
}
onMounted(load)
watch([schoolId,year],load)
function startEdit(s:any) {
  const e = enrolmentFor(s.id)
  form.value = { ...s, date_of_birth:s.date_of_birth || '', year_level:e?.year_level || '', house_id:e?.house_id || '' }
  editing.value = true; notice.value = ''; modalError.value = ''; confirmSave.value = false; modalOpen.value = true
}
function reset() { form.value = blank(); editing.value = false }
async function save() {
  if (!canEdit.value || saving.value) return
  modalError.value = ''; notice.value = ''
  const f = form.value
  if (!f.student_number.trim() || !f.given_name.trim() || !f.family_name.trim()) { modalError.value = 'Student number, first name and last name are required.'; confirmSave.value = false; return }
  saving.value = true
  try {
    const record:any = { school_id:schoolId.value, student_number:f.student_number.trim(), given_name:f.given_name.trim(), family_name:f.family_name.trim(), date_of_birth:f.date_of_birth || null }
    const s = f.id
      ? await db.from('students').update(record).eq('id', f.id).eq('school_id', schoolId.value).select('id').single()
      : await db.from('students').upsert(record, {onConflict:'school_id,student_number'}).select('id').single()
    if (s.error) throw s.error
    const e = await db.from('student_enrolments').upsert({student_id:s.data.id,school_id:schoolId.value,school_year:year.value,year_level:f.year_level.trim() || null,house_id:f.house_id || null},{onConflict:'student_id,school_year'})
    if (e.error) throw e.error
    notice.value = 'Student saved.'; modalOpen.value = false; confirmSave.value = false; reset(); await load()
  } catch(e:any) { modalError.value = e.message || 'Unable to save student.'; confirmSave.value = false }
  finally { saving.value = false }
}
async function remove(s:any) {
  if (!canEdit.value || saving.value || !confirm(`Permanently delete ${s.given_name} ${s.family_name}? This may be blocked if they have sporting results.`)) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    // Remove enrolments only if the student itself is not referenced by other records.
    const d = await db.from('students').delete().eq('id',s.id).eq('school_id',schoolId.value).select('id')
    if (d.error) throw d.error
    if (!d.data?.length) throw new Error('Deletion was not permitted. Check school permissions and linked records.')
    notice.value = 'Student deleted.'; await load()
  } catch(e:any) { error.value = e.message || 'Deletion failed. Student may have linked records.' }
  finally { saving.value = false }
}
function parseCsv(input:string):string[][] {
  const result:string[][] = []; let row:string[] = [], field = '', quoted = false
  for(let i=0;i<input.length;i++) { const c=input[i]
    if(c==='"') { if(quoted && input[i+1]==='"'){field+='"';i++}else quoted=!quoted }
    else if(c===','&&!quoted){row.push(field);field=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))result.push(row);row=[];field=''}
    else field+=c
  }
  if(quoted) throw new Error('CSV contains an unclosed quoted value.')
  row.push(field);if(row.some(x=>x.trim()))result.push(row)
  return result
}
async function readCsv(ev:Event) {
  csvPreview.value = []; importReport.value = ''; error.value = ''
  const file = (ev.target as HTMLInputElement).files?.[0]
  if(!file) return
  if(file.size > 1024*1024){error.value='CSV must be smaller than 1 MB.';return}
  try {
    const data=parseCsv((await file.text()).replace(/^\uFEFF/,''))
    const headers=(data.shift()||[]).map(x=>x.trim().toLowerCase().replace(/\s+/g,'_'))
    for(const required of ['student_number','given_name','family_name']) if(!headers.includes(required)) throw new Error(`Missing CSV column: ${required}`)
    if(data.length>500)throw new Error('Import a maximum of 500 students at a time.')
    csvPreview.value=data.map((r,i)=>{const item:any={line:i+2};headers.forEach((h,j)=>item[h]=(r[j]||'').trim());return item})
  } catch(e:any){error.value=e.message}
}
async function importCsv() {
  if(!canEdit.value || importing.value || !csvPreview.value.length)return
  importing.value=true;error.value='';let ok=0;const failures:string[]=[]
  for(const r of csvPreview.value) {
    try {
      if(!r.student_number || !r.given_name || !r.family_name)throw new Error('Missing required field')
      if(r.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(r.date_of_birth))throw new Error('Date of birth must be YYYY-MM-DD')
      const house=houses.value.find(h=>h.name.toLowerCase()===(r.house||'').toLowerCase())
      if(r.house && !house)throw new Error(`Unknown house: ${r.house}`)
      const s=await db.from('students').upsert({school_id:schoolId.value,student_number:r.student_number,given_name:r.given_name,family_name:r.family_name,date_of_birth:r.date_of_birth||null},{onConflict:'school_id,student_number'}).select('id').single()
      if(s.error)throw s.error
      const e=await db.from('student_enrolments').upsert({student_id:s.data.id,school_id:schoolId.value,school_year:year.value,year_level:r.year_level||null,house_id:house?.id||null},{onConflict:'student_id,school_year'})
      if(e.error)throw e.error
      ok++
    } catch(e:any){failures.push(`Row ${r.line}: ${e.message||'Unknown error'}`)}
  }
  importReport.value=`${ok} imported/updated; ${failures.length} failed.${failures.length?' '+failures.slice(0,10).join(' | '):''}`
  csvPreview.value=[];importing.value=false;await load()
}
</script>
<template>
<div class="page"><div class="shell admin-section">
  <NuxtLink :to="`/school/dashboard`">← School Dashboard</NuxtLink>
  <h1>{{schoolName}} — Students</h1>
  <p class="notice">Student records are restricted to your school. Only School Administrators can make changes.</p>
  <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
  <div class="card" style="margin-bottom:1rem"><label class="field">School year <input v-model.number="year" type="number" min="2000" max="2200" /></label></div>
  <div v-if="canEdit" style="display:flex;justify-content:flex-end;margin-bottom:1rem"><button class="btn" type="button" @click="startAdd">+ Add Student</button></div>
  <div v-if="modalOpen" class="student-modal-backdrop" @click.self="closeModal">
    <section class="student-modal card" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><h2 id="student-modal-title">{{editing?'Edit Student':'Add Student'}}</h2><button type="button" class="btn" :disabled="saving" aria-label="Close" @click="closeModal">✕</button></div>
      <p v-if="modalError" class="error" role="alert">{{modalError}}</p>
      <div class="cards"><label class="field">Student number<input v-model="form.student_number" maxlength="100" /></label><label class="field">First name<input v-model="form.given_name" maxlength="100" /></label><label class="field">Last name<input v-model="form.family_name" maxlength="100" /></label><label class="field">Date of birth (optional)<input v-model="form.date_of_birth" type="date" /></label><label class="field">Year level<input v-model="form.year_level" placeholder="e.g. 9" maxlength="30" /></label><label class="field">House<select v-model="form.house_id"><option value="">Not assigned</option><option v-for="h in houses" :key="h.id" :value="h.id">{{h.name}}</option></select></label></div>
      <div v-if="confirmSave" class="student-confirm" role="alertdialog" aria-label="Confirm student save">
        <strong>Confirm {{editing?'changes':'new student'}}</strong>
        <p>Are you sure you want to {{editing?'save changes to':'add'}} {{form.given_name}} {{form.family_name}} ({{form.student_number}})? This will update the school's student records for {{year}}.</p>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap"><button class="btn" type="button" :disabled="saving" @click="save">{{saving?'Saving…':'Yes, Save Student'}}</button><button class="btn" type="button" :disabled="saving" @click="confirmSave=false">Review Details</button></div>
      </div>
      <div v-else style="display:flex;gap:.75rem;margin-top:1rem;flex-wrap:wrap"><button class="btn" type="button" :disabled="saving" @click="requestSave">{{editing?'Save Changes':'Add Student'}}</button><button class="btn" type="button" :disabled="saving" @click="closeModal">Cancel</button></div>
    </section>
  </div>
  <section v-if="canEdit" class="card" style="margin-bottom:1rem"><h2>Import Students from CSV</h2><p>Columns: student_number, given_name, family_name, date_of_birth, year_level, house. Date format YYYY-MM-DD. Existing student numbers are updated. Maximum 500 rows.</p><input type="file" accept=".csv,text/csv" @change="readCsv" /><p v-if="csvPreview.length">{{csvPreview.length}} rows ready to import into {{year}}.</p><button v-if="csvPreview.length" class="btn" :disabled="importing" @click="importCsv">{{importing?'Importing…':'Import Students'}}</button><p v-if="importReport" role="status">{{importReport}}</p></section>
  <section class="card"><h2>Students ({{display.length}})</h2><input v-model="search" placeholder="Search by name or student number" aria-label="Search students" /><p v-if="busy">Loading…</p><div v-for="s in display" :key="s.id" class="data-row" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap"><div><strong>{{s.family_name}}, {{s.given_name}}</strong><small style="display:block">{{s.student_number}} · Year {{enrolmentFor(s.id)?.year_level||'—'}} · {{houses.find(h=>h.id===enrolmentFor(s.id)?.house_id)?.name||'No house'}}</small></div><div v-if="canEdit" style="display:flex;gap:.5rem"><button class="btn" @click="startEdit(s)">Edit</button><button class="btn" @click="remove(s)">Delete</button></div></div><p v-if="!busy&&!display.length">No students found.</p></section>
</div></div>
</template>

<style scoped>
.student-modal-backdrop { position:fixed;inset:0;z-index:1000;background:rgba(10,20,40,.68);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto }
.student-modal { width:min(100%,720px);max-height:calc(100vh - 2rem);overflow-y:auto;background:#fff;color:#18243a;box-shadow:0 20px 60px rgba(0,0,0,.3);padding:1.5rem;border-radius:12px }
.student-confirm { margin-top:1rem;padding:1rem;border:1px solid #c5a35b;border-radius:8px;background:#fff9e9;color:#32250c }
@media (prefers-color-scheme:dark) { .student-modal { background:#18243a;color:#fff } .student-confirm { background:#392f1e;color:#fff2d0 } }
</style>
