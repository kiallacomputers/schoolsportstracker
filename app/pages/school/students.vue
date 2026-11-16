<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const busy = ref(true), saving = ref(false), error = ref(''), notice = ref('')
const schoolName = ref(''), canEdit = ref(false), isSuperAdmin = ref(false), statusFilter = ref('active')
const rows = ref<any[]>([]), houses = ref<any[]>([]), enrolments = ref<any[]>([])
const year = ref(new Date().getFullYear()), search = ref('')
const yearFilter = ref('all'), houseFilter = ref('all')
const selectedStudent = ref<any>(null), profileTab = ref('details'), profileBusy = ref(false), profileError = ref('')
const studentEntries = ref<any[]>([]), studentResults = ref<any[]>([])
const profileTabs = [{id:'details',label:'Student Details'},{id:'events',label:'Completed Events'},{id:'records',label:'Records Held'},{id:'registrations',label:'Registrations'},{id:'results',label:'Results History'},{id:'achievements',label:'Achievements'}]
const houseFor = (student:any) => houses.value.find(h => h.id === enrolmentFor(student.id)?.house_id)
const studentYear = (student:any) => enrolmentFor(student.id)?.year_level || '—'
const filteredStudents = computed(() => display.value.filter(student => (yearFilter.value === 'all' || String(studentYear(student)) === yearFilter.value) && (houseFilter.value === 'all' || enrolmentFor(student.id)?.house_id === houseFilter.value)))
const availableYears = computed(() => [...new Set(rows.value.map(s => String(studentYear(s))).filter(v => v !== '—'))].sort((a,b) => Number(a)-Number(b)))
const completedResults = computed(() => studentResults.value.filter(r => !!r.published_at))
async function openStudent(student:any) {
  selectedStudent.value = student; profileTab.value = 'details'; studentEntries.value = []; studentResults.value = []; profileError.value = ''; profileBusy.value = true
  try {
    const participants = await db.from('entry_participants').select('entry_id').eq('student_id',student.id).limit(1000)
    if (participants.error) throw participants.error
    const ids = [...new Set((participants.data || []).map(p => p.entry_id))]
    if (ids.length) {
      const entries = await db.from('event_entries').select('id,competition_event_id,created_at,competition_events(id,age_group,division,event_definitions(name,measurement),competitions(name))').eq('school_id',schoolId.value).in('id',ids).limit(1000)
      if (entries.error) throw entries.error
      studentEntries.value = entries.data || []
      const results = await db.from('event_results').select('id,entry_id,performance_value,placing_position,points,published_at,status').in('entry_id',studentEntries.value.map(e=>e.id)).limit(1000)
      if (results.error) throw results.error
      studentResults.value = results.data || []
    }
  } catch (e:any) { profileError.value = e.message || 'Could not load student sporting history.' }
  finally { profileBusy.value = false }
}
const resultEvent = (result:any) => studentEntries.value.find(e=>e.id === result.entry_id)
const eventLabel = (entry:any) => entry?.competition_events?.event_definitions?.name || 'Event'
const competitionLabel = (entry:any) => entry?.competition_events?.competitions?.name || 'Competition'
const performanceLabel = (result:any) => {
  if (result.performance_value == null) return '—'
  const measurement = resultEvent(result)?.competition_events?.event_definitions?.measurement
  if (measurement === 'time_ms') return (Number(result.performance_value)/1000).toFixed(2)+' s'
  if (measurement === 'distance_mm') return (Number(result.performance_value)/1000).toFixed(2)+' m'
  return String(result.performance_value)
}

const selectedHouseId = computed(() => typeof route.query.house === 'string' ? route.query.house : '')
const selectedHouse = computed(() => houses.value.find(h => h.id === selectedHouseId.value))
function houseStudentsUrl(houseId: string) { return { path: '/school/students', query: { school: schoolId.value, house: houseId } } }
function clearHouseFilter() { const query = { ...route.query }; delete query.house; navigateTo({ path: route.path, query }) }
const blank = () => ({id:'',student_number:'',given_name:'',family_name:'',email:'',date_of_birth:'',gender_identity:'',sporting_division:'',year_level:'',house_id:''})
const form = ref(blank()), editing = ref(false)
const modalOpen = ref(false)
const importModalOpen = ref(false)
const importError = ref('')
const confirmSave = ref(false)
const modalError = ref('')
function startAdd() { form.value = blank(); editing.value = false; modalError.value = ''; confirmSave.value = false; modalOpen.value = true }
function closeModal() { if (saving.value) return; modalOpen.value = false; confirmSave.value = false; modalError.value = ''; reset(); clearAddAction() }
function clearAddAction() {
  if (!['add','import'].includes(String(route.query.action || ''))) return
  const query = { ...route.query }
  delete query.action
  navigateTo({ path: route.path, query, replace: true })
}
function closeImportModal() {
  if (importing.value) return
  importModalOpen.value = false
  csvPreview.value = []
  importReport.value = ''
  importError.value = ''
  clearAddAction()
}
function openImportFromMenu() {
  if (route.query.action !== 'import' || busy.value || !canEdit.value) return
  importModalOpen.value = true
}
function openAddFromMenu() {
  if (route.query.action !== 'add' || busy.value || !canEdit.value) return
  if (!modalOpen.value) startAdd()
}
watch(() => route.query.action, (action) => { if (action === 'add') openAddFromMenu(); if (action === 'import') openImportFromMenu() })
watch([busy, canEdit], () => { openAddFromMenu(); openImportFromMenu() })
function requestSave() {
  modalError.value = ''
  if (!form.value.student_number.trim() || !form.value.given_name.trim() || !form.value.family_name.trim()) { modalError.value = 'Student number, first name and last name are required.'; return }
  if (!validEmail(form.value.email.trim())) { modalError.value = 'Enter a valid email address or leave it blank.'; return }
  confirmSave.value = true
}
const csvPreview = ref<any[]>([]), importing = ref(false), importReport = ref('')
const display = computed(() => rows.value.filter(s => (!selectedHouseId.value || enrolmentFor(s.id)?.house_id === selectedHouseId.value) && (statusFilter.value === 'all' || (statusFilter.value === 'active' ? s.is_active !== false : s.is_active === false)) && `${s.given_name} ${s.family_name} ${s.student_number} ${s.email || ''}`.toLowerCase().includes(search.value.toLowerCase())))
const validEmail = (value:string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const enrolmentFor = (id:string) => enrolments.value.find(e => e.student_id === id)
async function load() {
  error.value = ''; busy.value = true
  try {
    const {data:{user}} = await db.auth.getUser()
    if (!user) { await navigateTo('/login'); return }
    if (!schoolId.value) throw new Error('Select a school from the School Dashboard.')
    const platform = await db.rpc('is_platform_admin')
    if (platform.error) throw platform.error
    isSuperAdmin.value = platform.data === true
    const m = await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id).eq('school_id',schoolId.value).maybeSingle()
    if (m.error) throw m.error
    if (!isSuperAdmin.value && (!m.data || !['school_admin','teacher'].includes(m.data.role))) throw new Error('You do not have access to this school.')
    canEdit.value = isSuperAdmin.value || m.data?.role === 'school_admin'
    schoolName.value = (m.data?.schools as any)?.name || 'School'
    const [s,h,e] = await Promise.all([
      db.from('students').select('id,student_number,given_name,family_name,email,date_of_birth,gender_identity,sporting_division,is_active').eq('school_id',schoolId.value).order('family_name').limit(2000),
      db.from('school_houses').select('id,name,colour').eq('school_id',schoolId.value).order('name'),
      db.from('student_enrolments').select('id,student_id,school_year,year_level,house_id').eq('school_id',schoolId.value).eq('school_year',year.value).limit(2000)
    ])
    const failure = [s,h,e].find(x => x.error)?.error
    if (failure) throw failure
    rows.value = s.data || []; houses.value = h.data || []; enrolments.value = e.data || []
  } catch (e:any) { error.value = e.message || 'Unable to load students.' }
  finally { busy.value = false; nextTick(() => { openAddFromMenu(); openImportFromMenu() }) }
}
onMounted(load)
watch([schoolId,year],load)
function startEdit(s:any) {
  const e = enrolmentFor(s.id)
  form.value = { ...s, email:s.email || '', date_of_birth:s.date_of_birth || '', gender_identity:s.gender_identity || '', sporting_division:s.sporting_division || '', year_level:e?.year_level || '', house_id:e?.house_id || '' }
  editing.value = true; notice.value = ''; modalError.value = ''; confirmSave.value = false; modalOpen.value = true
}
function reset() { form.value = blank(); editing.value = false }
async function save() {
  if (!canEdit.value || saving.value) return
  modalError.value = ''; notice.value = ''
  const f = form.value
  if (!f.student_number.trim() || !f.given_name.trim() || !f.family_name.trim()) { modalError.value = 'Student number, first name and last name are required.'; confirmSave.value = false; return }
  if (!validEmail(f.email.trim())) { modalError.value = 'Enter a valid email address or leave it blank.'; confirmSave.value = false; return }
  saving.value = true
  try {
    const record:any = { school_id:schoolId.value, student_number:f.student_number.trim(), given_name:f.given_name.trim(), family_name:f.family_name.trim(), email:f.email.trim().toLowerCase() || null, date_of_birth:f.date_of_birth || null, gender_identity:f.gender_identity || null, sporting_division:f.sporting_division || null }
    const s = f.id
      ? await db.from('students').update(record).eq('id', f.id).eq('school_id', schoolId.value).select('id').single()
      : await db.from('students').upsert(record, {onConflict:'school_id,student_number'}).select('id').single()
    if (s.error) throw s.error
    const e = await db.from('student_enrolments').upsert({student_id:s.data.id,school_id:schoolId.value,school_year:year.value,year_level:f.year_level.trim() || null,house_id:f.house_id || null},{onConflict:'student_id,school_year'})
    if (e.error) throw e.error
    notice.value = 'Student saved.'; modalOpen.value = false; confirmSave.value = false; reset(); clearAddAction(); await load()
  } catch(e:any) { modalError.value = e.message || 'Unable to save student.'; confirmSave.value = false }
  finally { saving.value = false }
}
async function remove(s:any) {
  if (!isSuperAdmin.value || saving.value || !confirm(`Permanently delete ${s.given_name} ${s.family_name}? This may be blocked if they have sporting results.`)) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    // Remove enrolments only if the student itself is not referenced by other records.
    const d = await db.from('students').delete().eq('id',s.id).eq('school_id',schoolId.value).select('id')
    if (d.error) throw d.error
    if (!d.data?.length) throw new Error('Deletion was not permitted. Check school permissions and linked records.')
    notice.value = 'Student permanently deleted.'; await load()
  } catch(e:any) { error.value = e.message || 'Deletion failed. Student may have linked records.' }
  finally { saving.value = false }
}
async function setStudentActive(s:any, active:boolean) {
  if (!canEdit.value || saving.value) return
  const verb = active ? 'reactivate' : 'disable'
  if (!confirm(`Are you sure you want to ${verb} ${s.given_name} ${s.family_name}? ${active ? 'They will become available for new event registrations.' : 'Their school records and past sporting results will be retained, but new event registrations will be blocked.'}`)) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    const result = await db.rpc('school_set_student_active', {p_school:schoolId.value,p_student:s.id,p_active:active})
    if (result.error) throw result.error
    notice.value = `${s.given_name} ${s.family_name} ${active ? 'reactivated' : 'disabled'}.`
    await load()
  } catch(e:any) { error.value = e.message || 'Unable to change student status.' }
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
  csvPreview.value = []; importReport.value = ''; importError.value = ''
  const file = (ev.target as HTMLInputElement).files?.[0]
  if(!file) return
  if(file.size > 1024*1024){importError.value='CSV must be smaller than 1 MB.';return}
  try {
    const data=parseCsv((await file.text()).replace(/^\uFEFF/,''))
    const headers=(data.shift()||[]).map(x=>x.trim().toLowerCase().replace(/\s+/g,'_'))
    for(const required of ['student_number','given_name','family_name']) if(!headers.includes(required)) throw new Error(`Missing CSV column: ${required}`)
    if(data.length>500)throw new Error('Import a maximum of 500 students at a time.')
    csvPreview.value=data.map((r,i)=>{const item:any={line:i+2};headers.forEach((h,j)=>item[h]=(r[j]||'').trim());return item})
  } catch(e:any){importError.value=e.message}
}
async function importCsv() {
  if(!canEdit.value || importing.value || !csvPreview.value.length)return
  importing.value=true;importError.value='';let ok=0;const failures:string[]=[]
  for(const r of csvPreview.value) {
    try {
      if(!r.student_number || !r.given_name || !r.family_name)throw new Error('Missing required field')
      if(r.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(r.date_of_birth))throw new Error('Date of birth must be YYYY-MM-DD')
      if (r.email && !validEmail(r.email)) throw new Error('Invalid email address')
      const house=houses.value.find(h=>h.name.toLowerCase()===(r.house||'').toLowerCase())
      if(r.house && !house)throw new Error(`Unknown house: ${r.house}`)
      const studentRecord:any = {school_id:schoolId.value,student_number:r.student_number,given_name:r.given_name,family_name:r.family_name,date_of_birth:r.date_of_birth||null}
      // Preserve existing emails when importing legacy CSV files without an email column.
      if (Object.prototype.hasOwnProperty.call(r, 'email')) studentRecord.email = r.email?.trim().toLowerCase() || null
      // Only update identity/division when explicitly supplied in CSV; never erase on legacy imports.
      if (Object.prototype.hasOwnProperty.call(r,'gender_identity')) {
        const identity = (r.gender_identity||'').trim().toLowerCase()
        if (identity && !['male','female','non-binary','self-describe','prefer not to say'].includes(identity)) throw new Error('Invalid gender_identity')
        studentRecord.gender_identity = identity || null
      }
      if (Object.prototype.hasOwnProperty.call(r,'sporting_division')) {
        const division = (r.sporting_division||'').trim().toLowerCase()
        if (division && !['boys','girls','mixed'].includes(division)) throw new Error('Invalid sporting_division')
        studentRecord.sporting_division = division || null
      }
      const s=await db.from('students').upsert(studentRecord,{onConflict:'school_id,student_number'}).select('id').single()
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
  <NuxtLink :to="`/school/dashboard`">← Students</NuxtLink>
  <h1>{{schoolName}} — Students</h1>
  <p class="notice">Student records are restricted to your school. School Administrators can edit, disable and reactivate students. Only SuperAdmins can permanently delete student records.</p>
  <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p>
  <div v-if="modalOpen" class="student-modal-backdrop" @click.self="closeModal">
    <section class="student-modal card" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><h2 id="student-modal-title">{{editing?'Edit Student':'Add Student'}}</h2><button type="button" class="btn" :disabled="saving" aria-label="Close" @click="closeModal">✕</button></div>
      <p v-if="modalError" class="error" role="alert">{{modalError}}</p>
      <div class="cards"><label class="field">Student number<input v-model="form.student_number" maxlength="100" /></label><label class="field">First name<input v-model="form.given_name" maxlength="100" /></label><label class="field">Last name<input v-model="form.family_name" maxlength="100" /></label><label class="field">Email address (optional)<input v-model="form.email" type="email" autocomplete="off" maxlength="254" placeholder="student@school.edu.au" /></label><label class="field">Date of birth (optional)<input v-model="form.date_of_birth" type="date" /></label><label class="field">Gender identity (optional)<select v-model="form.gender_identity"><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option><option value="non-binary">Non-binary</option><option value="self-describe">Self-describe</option><option value="prefer not to say">Prefer not to say</option></select></label><label class="field">Approved sporting division<select v-model="form.sporting_division"><option value="">Not assigned</option><option value="boys">Boys</option><option value="girls">Girls</option><option value="mixed">Mixed/Open only</option></select></label><label class="field">Year level<input v-model="form.year_level" placeholder="e.g. 9" maxlength="30" /></label><label class="field">House<select v-model="form.house_id"><option value="">Not assigned</option><option v-for="h in houses" :key="h.id" :value="h.id">{{h.name}}</option></select></label></div>
      <div v-if="confirmSave" class="student-confirm" role="alertdialog" aria-label="Confirm student save">
        <strong>Confirm {{editing?'changes':'new student'}}</strong>
        <p>Are you sure you want to {{editing?'save changes to':'add'}} {{form.given_name}} {{form.family_name}} ({{form.student_number}})? This will update the school's student records for {{year}}, including the approved sporting division.</p>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap"><button class="btn" type="button" :disabled="saving" @click="save">{{saving?'Saving…':'Yes, Save Student'}}</button><button class="btn" type="button" :disabled="saving" @click="confirmSave=false">Review Details</button></div>
      </div>
      <div v-else style="display:flex;gap:.75rem;margin-top:1rem;flex-wrap:wrap"><button class="btn" type="button" :disabled="saving" @click="requestSave">{{editing?'Save Changes':'Add Student'}}</button><button class="btn" type="button" :disabled="saving" @click="closeModal">Cancel</button></div>
    </section>
  </div>
  <div v-if="canEdit && importModalOpen" class="student-modal-backdrop" @click.self="closeImportModal">
    <section class="student-modal card" role="dialog" aria-modal="true" aria-labelledby="student-import-title">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><h2 id="student-import-title">Import Students from CSV</h2><button type="button" class="btn" :disabled="importing" aria-label="Close import" @click="closeImportModal">✕</button></div>
      <p>Columns: student_number, given_name, family_name, email (optional), date_of_birth, gender_identity, sporting_division, year_level, house. Date format YYYY-MM-DD. Existing student numbers are updated. Maximum 500 rows.</p>
      <p>School year: {{year}}</p>
      <label class="field">Select CSV file<input type="file" accept=".csv,text/csv" :disabled="importing" @change="readCsv" /></label>
      <p v-if="importError" class="error" role="alert">{{importError}}</p>
      <p v-if="csvPreview.length">{{csvPreview.length}} rows ready to import into {{year}}.</p>
      <p v-if="importReport" role="status">{{importReport}}</p>
      <div style="display:flex;gap:.75rem;margin-top:1rem;flex-wrap:wrap"><button v-if="csvPreview.length" type="button" class="btn" :disabled="importing" @click="importCsv">{{importing?'Importing…':'Import Students'}}</button><button type="button" class="btn" :disabled="importing" @click="closeImportModal">Close</button></div>
    </section>
  </div>
  <section class="student-directory card" v-if="!selectedStudent">
    <div class="student-directory-heading"><div><h2>{{ selectedHouse?.name || 'Student Directory' }}</h2><p>{{ filteredStudents.length }} students · {{schoolName}}</p></div><div class="student-directory-actions"><button v-if="selectedHouseId" type="button" class="btn" @click="clearHouseFilter">Clear House Filter</button><button v-if="canEdit" type="button" class="btn" @click="startAdd">+ Add Student</button><button v-if="canEdit" type="button" class="btn" @click="importModalOpen=true">Import CSV</button></div></div>
    <div class="student-directory-filters"><label class="field">Search<input v-model="search" placeholder="Name, email or student number" /></label><label class="field">House<select v-model="houseFilter"><option value="all">All Houses</option><option v-for="h in houses" :key="h.id" :value="h.id">{{h.name}}</option></select></label><label class="field">Year Level<select v-model="yearFilter"><option value="all">All Years</option><option v-for="y in availableYears" :key="y" :value="y">Year {{y}}</option></select></label><label class="field">Status<select v-model="statusFilter"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All Students</option></select></label></div>
    <p v-if="busy">Loading students…</p>
    <div v-else class="student-tile-grid"><button v-for="student in filteredStudents" :key="student.id" type="button" class="student-tile" @click="openStudent(student)"><span class="student-tile-house" :style="{backgroundColor:houseFor(student)?.colour || '#52647e'}">{{houseFor(student)?.name?.charAt(0).toUpperCase() || '—'}}</span><strong>{{student.given_name}} {{student.family_name}}</strong><span>Year {{studentYear(student)}}</span><span>{{houseFor(student)?.name || 'No House'}}</span><span v-if="student.is_active===false" class="student-inactive">Inactive</span></button></div>
    <p v-if="!busy && !filteredStudents.length">No students match your filters.</p>
  </section>
  <section v-else class="student-profile">
    <button type="button" class="btn" @click="selectedStudent=null">← Back to Students</button>
    <div class="student-profile-header"><span class="student-tile-house" :style="{backgroundColor:houseFor(selectedStudent)?.colour || '#52647e'}">{{houseFor(selectedStudent)?.name?.charAt(0).toUpperCase() || '—'}}</span><div><h2>{{selectedStudent.given_name}} {{selectedStudent.family_name}}</h2><p>Year {{studentYear(selectedStudent)}} · {{houseFor(selectedStudent)?.name || 'No House'}}</p></div><span v-if="selectedStudent.is_active===false" class="student-inactive">Inactive</span></div>
    <div class="student-profile-tabs" role="tablist" aria-label="Student profile sections"><button v-for="tab in profileTabs" :key="tab.id" type="button" role="tab" :aria-selected="profileTab===tab.id" :class="['student-profile-tab', {active:profileTab===tab.id}]" @click="profileTab=tab.id">{{tab.label}}</button></div>
    <div class="student-profile-content card" role="tabpanel">
      <p v-if="profileBusy">Loading sporting history…</p><p v-if="profileError" class="error">{{profileError}}</p>
      <template v-if="profileTab==='details'"><h3>Student Details</h3><div class="student-detail-grid"><div><small>Student Number</small><strong>{{selectedStudent.student_number}}</strong></div><div><small>Email</small><strong>{{selectedStudent.email || 'Not provided'}}</strong></div><div><small>Year Level</small><strong>{{studentYear(selectedStudent)}}</strong></div><div><small>House</small><strong>{{houseFor(selectedStudent)?.name || 'Not assigned'}}</strong></div><div><small>Date of Birth</small><strong>{{selectedStudent.date_of_birth || 'Not provided'}}</strong></div><div><small>Sporting Division</small><strong>{{selectedStudent.sporting_division || 'Not assigned'}}</strong></div><div><small>Status</small><strong>{{selectedStudent.is_active===false?'Inactive':'Active'}}</strong></div></div><div v-if="canEdit" class="student-profile-actions"><button class="btn" @click="startEdit(selectedStudent)">Edit Student</button><button class="btn" :disabled="saving" @click="setStudentActive(selectedStudent,selectedStudent.is_active===false).then(()=>{selectedStudent=null})">{{selectedStudent.is_active===false?'Reactivate':'Disable'}} Student</button><button v-if="isSuperAdmin" class="btn" :disabled="saving" @click="remove(selectedStudent).then(()=>{selectedStudent=null})">Delete Permanently</button></div></template>
      <template v-else-if="profileTab==='registrations'"><h3>Event Registrations</h3><div v-for="entry in studentEntries" :key="entry.id" class="student-history-row"><strong>{{eventLabel(entry)}}</strong><span>{{competitionLabel(entry)}} · {{entry.competition_events?.age_group || ''}} {{entry.competition_events?.division || ''}}</span></div><p v-if="!profileBusy && !studentEntries.length">No registrations found.</p></template>
      <template v-else-if="profileTab==='events'"><h3>Completed Events</h3><div v-for="result in completedResults" :key="result.id" class="student-history-row"><strong>{{eventLabel(resultEvent(result))}}</strong><span>{{competitionLabel(resultEvent(result))}} · {{performanceLabel(result)}} · Place {{result.placing_position || '—'}}</span></div><p v-if="!profileBusy && !completedResults.length">No published completed events found.</p></template>
      <template v-else-if="profileTab==='results'"><h3>Results History</h3><div v-for="result in studentResults" :key="result.id" class="student-history-row"><strong>{{eventLabel(resultEvent(result))}}</strong><span>{{performanceLabel(result)}} · Place {{result.placing_position || '—'}} · {{result.published_at?'Published':'Unpublished'}}</span></div><p v-if="!profileBusy && !studentResults.length">No results recorded.</p></template>
      <template v-else-if="profileTab==='records'"><h3>Records Held</h3><p>Verified school and competition records will appear here once record tracking is configured. Event results are not automatically classified as records.</p></template>
      <template v-else><h3>Achievements</h3><p>Verified medals, awards and milestones will appear here when achievement tracking is configured.</p></template>
    </div>
  </section>
</div></div>
</template>

<style scoped>
.student-identity { display:flex; align-items:center; gap:.85rem; min-width:0; }
.student-house-link { text-decoration:none; cursor:pointer; }
.student-house-link:hover { filter:brightness(1.15); transform:translateY(-1px); }
.student-house-link:focus-visible { outline:3px solid #fbbf24; outline-offset:3px; }
.house-filter-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:.75rem; }
.house-filter-heading h2 { margin:0; }
.student-house-tile { width:42px; height:42px; flex:0 0 42px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; color:#fff; font-size:1.25rem; font-weight:800; border:1px solid rgba(255,255,255,.3); text-shadow:0 1px 3px rgba(0,0,0,.8); box-shadow:0 1px 3px rgba(0,0,0,.15); }

.student-modal-backdrop { position:fixed;inset:0;z-index:1000;background:rgba(6,17,37,.78);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto }
.student-modal { width:min(100%,720px);max-height:calc(100vh - 2rem);overflow-y:auto;background:#0d2342;color:#fff;border:1px solid #315178;box-shadow:0 20px 60px rgba(0,0,0,.45);padding:1.5rem;border-radius:16px }
.student-confirm { margin-top:1rem;padding:1rem;border:1px solid #527196;border-radius:8px;background:#133b6c;color:#fff }

</style>

<style scoped>
.student-directory,.student-profile-content{background:#102440;color:#edf4ff;border:1px solid #304c70;border-radius:16px;padding:1.25rem}
.student-directory-heading,.student-profile-header,.student-directory-actions,.student-profile-actions{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.student-directory-heading h2,.student-profile-header h2{margin:0}
.student-directory-filters{display:grid;grid-template-columns:2fr repeat(3,minmax(120px,1fr));gap:.75rem;margin:1.25rem 0}
.student-directory-filters .field{min-width:0}
.student-tile-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.75rem}
.student-tile{display:flex;flex-direction:column;align-items:center;gap:.4rem;text-align:center;background:#192f4f;border:1px solid #385577;border-radius:12px;color:#e9f3ff;padding:1.1rem .45rem;cursor:pointer;min-width:0;transition:background .15s,transform .15s}
.student-tile:hover,.student-tile:focus-visible{background:#25446e;transform:translateY(-2px);outline-color:#77aaf8}
.student-tile strong{font-size:.9rem;overflow-wrap:anywhere}.student-tile span:not(.student-tile-house){font-size:.8rem;color:#bdcde2}
.student-tile-house{display:flex;align-items:center;justify-content:center;flex:0 0 48px;width:48px;height:48px;border-radius:9px;border:1px solid #ffffff66;font-weight:800;font-size:1.5rem;color:white;text-shadow:0 1px 3px #0008}
.student-inactive{color:#ffce83!important;font-size:.75rem}.student-profile{display:flex;flex-direction:column;gap:1rem}.student-profile-header{justify-content:flex-start;background:#102440;border:1px solid #304c70;border-radius:14px;padding:1.25rem}.student-profile-header p{margin:.25rem 0 0;color:#b7cce4}
.student-profile-tabs {
  --tab-curve: 12px;
  --shoulder-clearance: 6px;
  display: flex;
  align-items: flex-end;
  flex-wrap: nowrap;
  justify-content: flex-start;
  gap: calc((2 * var(--tab-curve) + var(--shoulder-clearance)) / 2);
  margin: 0 0 0;
  padding: 0 var(--tab-curve);
  border-bottom: 1px solid #3675b6;
  isolation: isolate;
  overflow: visible;
}
.student-profile-tab {
  --tab-fill: #0b2340;
  --tab-stroke: #345f8c;
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: max-content;
  min-width: 0;
  margin: 0 0 -1px;
  padding: 11px 18px 12px;
  border: 1px solid var(--tab-stroke);
  border-bottom: 0;
  border-radius: 15px 15px 0 0;
  background: var(--tab-fill);
  color: #c9d9ee;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  overflow: visible;
}
/* Inverse quarter-circle shoulders: radial gradients paint both the 1px
   curved outline and the tab fill. Each shoulder is part of its own button. */
.student-profile-tab::before,
.student-profile-tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  width: var(--tab-curve);
  height: var(--tab-curve);
  pointer-events: none;
  background-repeat: no-repeat;
}
.student-profile-tab::before {
  left: calc(-1 * var(--tab-curve));
  background-image: radial-gradient(circle at top left,
    transparent calc(var(--tab-curve) - 1px),
    var(--tab-stroke) calc(var(--tab-curve) - 0.5px),
    var(--tab-stroke) var(--tab-curve),
    var(--tab-fill) calc(var(--tab-curve) + 0.5px));
}
.student-profile-tab::after {
  right: calc(-1 * var(--tab-curve));
  background-image: radial-gradient(circle at top right,
    transparent calc(var(--tab-curve) - 1px),
    var(--tab-stroke) calc(var(--tab-curve) - 0.5px),
    var(--tab-stroke) var(--tab-curve),
    var(--tab-fill) calc(var(--tab-curve) + 0.5px));
}
.student-profile-tab:hover:not(.active) {
  --tab-fill: #153657;
  z-index: 2;
  color: #fff;
}
.student-profile-tab:focus-visible {
  outline: 2px solid #a4d8ff;
  outline-offset: 3px;
  z-index: 12;
}
.student-profile-tab.active {
  --tab-fill: #0865d6;
  --tab-stroke: #3c9cff;
  z-index: 10;
  color: #fff;
}.student-profile-content{position:relative;z-index:0;min-height:200px}.student-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:1rem 0}.student-detail-grid>div{display:flex;flex-direction:column;gap:.25rem}.student-detail-grid small{color:#a8bfdc}.student-history-row{display:flex;flex-direction:column;gap:.25rem;padding:.85rem 0;border-bottom:1px solid #355272}.student-history-row span{color:#b7cce4;font-size:.9rem}
@media(max-width:1100px){.student-tile-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.student-directory-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.student-tile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.student-profile-tabs{overflow-x:auto;overflow-y:visible;gap:15px}.student-profile-tab{font-size:.8rem;padding:.6rem .75rem}}@media(max-width:420px){.student-tile-grid{grid-template-columns:1fr 1fr}.student-detail-grid{grid-template-columns:1fr}}
</style>
