<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
const db = useSupabaseClient()
type School = { id:string; name:string; code:string|null; allow_student_self_registration:boolean }
type Domain = { id:string; school_id:string; domain:string; is_primary:boolean; is_verified:boolean; allow_student_registration:boolean }
const schools = ref<School[]>([])
const domains = ref<Domain[]>([])
const selectedId = ref('')
const name = ref(''), code = ref(''), newDomain = ref('')
const busy = ref(false), error = ref(''), message = ref('')
const selectedSchool = computed(() => schools.value.find(s => s.id === selectedId.value))
const domainRows = computed(() => domains.value.filter(d => d.school_id === selectedId.value))
function clearMessages(){ error.value=''; message.value='' }
async function load(){
  const [s,d] = await Promise.all([
    db.from('schools').select('id,name,code,allow_student_self_registration').order('name'),
    db.from('school_email_domains').select('id,school_id,domain,is_primary,is_verified,allow_student_registration').order('domain')
  ])
  schools.value=(s.data||[]) as School[]
  domains.value=(d.data||[]) as Domain[]
  error.value=s.error?.message||d.error?.message||''
  if(!schools.value.some(x=>x.id===selectedId.value)) selectedId.value=schools.value[0]?.id||''
}
onMounted(load)
async function addSchool(){
  clearMessages(); busy.value=true
  const r=await db.from('schools').insert({name:name.value.trim(),code:code.value.trim()||null}).select('id').single()
  busy.value=false
  if(r.error){error.value=r.error.message;return}
  name.value='';code.value='';await load();selectedId.value=r.data.id;message.value='School created. Configure its approved email domains below.'
}
async function saveSchool(){
  if(!selectedSchool.value)return
  clearMessages();busy.value=true
  const s=selectedSchool.value
  const r=await db.from('schools').update({name:s.name.trim(),code:s.code?.trim()||null,allow_student_self_registration:s.allow_student_self_registration}).eq('id',s.id)
  busy.value=false
  if(r.error)error.value=r.error.message;else {message.value='School settings saved';await load()}
}
async function addDomain(){
  if(!selectedId.value)return
  clearMessages()
  const value=newDomain.value.trim().toLowerCase().replace(/^@/,'')
  if(!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(value)){error.value='Enter a valid domain without @ or https://';return}
  busy.value=true
  const r=await db.from('school_email_domains').insert({school_id:selectedId.value,domain:value,is_verified:false,allow_student_registration:false})
  busy.value=false
  if(r.error){error.value=r.error.message;return}
  newDomain.value='';await load();message.value='Domain added. Verify school ownership before enabling registration.'
}
async function updateDomain(d:Domain, field:'is_verified'|'allow_student_registration', value:boolean){
  clearMessages()
  if(field==='allow_student_registration' && value && !d.is_verified){error.value='Verify domain ownership first';return}
  if(field==='is_verified' && value && !confirm(`Have you independently verified that this school controls ${d.domain}?`))return
  busy.value=true
  const patch=field==='is_verified'&&!value?{is_verified:false,allow_student_registration:false}:{[field]:value}
  const r=await db.from('school_email_domains').update(patch).eq('id',d.id).eq('school_id',selectedId.value)
  busy.value=false
  if(r.error)error.value=r.error.message;else {await load();message.value='Domain settings updated'}
}
async function makePrimary(d:Domain){
  clearMessages();busy.value=true
  const r=await db.rpc('set_primary_school_email_domain',{p_school_id:selectedId.value,p_domain_id:d.id})
  busy.value=false
  if(r.error)error.value=r.error.message;else {await load();message.value='Primary domain updated'}
}
async function removeDomain(d:Domain){
  if(!confirm(`Remove ${d.domain} from this school? New registrations using it will be blocked.`))return
  clearMessages();busy.value=true
  const r=await db.from('school_email_domains').delete().eq('id',d.id).eq('school_id',selectedId.value)
  busy.value=false
  if(r.error)error.value=r.error.message;else {await load();message.value='Domain removed'}
}
</script>
<template>
  <div class="page"><div class="shell admin-section">
    <NuxtLink to="/dashboard">← Dashboard</NuxtLink>
    <h1>Schools</h1>
    <p>Manage schools and the verified email domains students may use to register.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="message" class="success" role="status">{{ message }}</p>
    <form class="card editor" @submit.prevent="addSchool">
      <label>New school name<input v-model="name" required maxlength="150" placeholder="School name"></label>
      <label>Code (optional)<input v-model="code" maxlength="30" placeholder="SJE"></label>
      <button class="btn" :disabled="busy">Add School</button>
    </form>
    <div class="card">
      <h2>Edit School</h2>
      <label>Select school<select v-model="selectedId"><option v-for="s in schools" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
      <template v-if="selectedSchool">
        <form class="editor" style="margin-top:16px" @submit.prevent="saveSchool">
          <label>School name<input v-model="selectedSchool.name" required maxlength="150"></label>
          <label>School code<input v-model="selectedSchool.code" maxlength="30"></label>
          <label class="checkline"><input v-model="selectedSchool.allow_student_self_registration" type="checkbox"> Allow student self-registration</label>
          <button class="btn" :disabled="busy">Save School</button>
        </form>
      </template>
    </div>
    <div v-if="selectedSchool" class="card">
      <h2>Email Domains — {{ selectedSchool.name }}</h2>
      <p class="notice">Only verified, enabled domains permit new student registration. Verify ownership outside the app before selecting “Verified”. Existing accounts still require school approval.</p>
      <form class="editor" @submit.prevent="addDomain">
        <label>Add school email domain<input v-model="newDomain" required placeholder="school.vic.edu.au" autocomplete="off"></label>
        <button class="btn" :disabled="busy">Add Domain</button>
      </form>
      <div v-for="d in domainRows" :key="d.id" class="data-row">
        <div><strong>@{{ d.domain }}</strong> <small v-if="d.is_primary"> · Primary</small>
          <p><small>{{ d.is_verified ? 'Ownership verified' : 'Unverified' }} · {{d.allow_student_registration ? 'Student signup enabled' : 'Student signup disabled'}}</small></p>
        </div>
        <div class="actions">
          <button type="button" class="secondary" :disabled="busy || d.is_primary" @click="makePrimary(d)">Make Primary</button>
          <button type="button" class="secondary" :disabled="busy" @click="updateDomain(d,'is_verified',!d.is_verified)">{{d.is_verified?'Revoke Verification':'Mark Verified'}}</button>
          <button type="button" class="secondary" :disabled="busy || (!d.is_verified && !d.allow_student_registration)" @click="updateDomain(d,'allow_student_registration',!d.allow_student_registration)">{{d.allow_student_registration?'Disable Signup':'Enable Signup'}}</button>
          <button type="button" class="secondary" :disabled="busy" @click="removeDomain(d)">Remove</button>
        </div>
      </div>
      <p v-if="!domainRows.length">No email domains configured for this school.</p>
    </div>
    <p><NuxtLink to="/admin/student-requests">Review student account requests →</NuxtLink></p>
  </div></div>
</template>
<style scoped>.checkline{display:flex!important;align-items:center;gap:10px}.checkline input{width:auto!important}.actions{justify-content:flex-end;flex-wrap:wrap}</style>
