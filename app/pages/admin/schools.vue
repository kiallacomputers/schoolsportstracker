<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
const db = useSupabaseClient()
type School = { id:string; name:string; code:string|null; allow_student_self_registration:boolean; deactivated_at:string|null }
type Domain = { id:string; school_id:string; domain:string; is_primary:boolean; is_verified:boolean; allow_student_registration:boolean }
const schools = ref<School[]>([])
const domains = ref<Domain[]>([])
const selectedId = ref('')
const name = ref(''), code = ref(''), newDomain = ref('')
const busy = ref(false), error = ref(''), message = ref('')
const confirmation = ref('')
const showInactive = ref(false)
const activeTab = ref<'overview'|'details'|'domains'|'administration'>('overview')
const search = ref('')
const route = useRoute()
const mainSection = ref<'schools'|'requests'|'email'>('schools')
const testRecipient = ref('')
const emailBusy = ref(false)
const emailError = ref('')
const emailResult = ref('')
async function sendTestEmail(){
  emailBusy.value = true; emailError.value = ''; emailResult.value = ''
  try {
    const {data:{session}} = await db.auth.getSession()
    if (!session) throw new Error('Please sign in again')
    const response = await $fetch<{message:string}>('/api/admin/email/test', {method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:{to:testRecipient.value}})
    emailResult.value = response.message
  } catch(e:any) { emailError.value = e?.data?.statusMessage || e?.message || 'Unable to send test email' }
  finally { emailBusy.value = false }
}

const requests = ref<any[]>([])
const requestNotes = ref<Record<string,string>>({})
const requestLogos = ref<Record<string,string>>({})
const requestInviteEmails = ref<Record<string,string>>({})
const requestBusy = ref('')
const requestInviteBusy = ref('')
const requestError = ref('')
const requestMessage = ref('')
const requestNotice = ref('')
const requestFilter = ref<'pending'|'all'>('pending')
const pendingRequests = computed(() => requests.value.filter(r => r.status === 'pending'))
const shownRequests = computed(() => requestFilter.value === 'pending' ? pendingRequests.value : requests.value)
async function loadRequests(){
  const r = await db.from('school_requests').select('id,school_name,school_domain,school_code,school_website,contact_name,contact_email,contact_position,contact_phone,notes,logo_path,status,created_at,review_notes,created_school_id').order('created_at',{ascending:false})
  requests.value = r.data || []
  requestError.value = r.error?.message || ''
  requestLogos.value = {}
  await Promise.all(requests.value.filter(x=>x.logo_path).map(async x=>{
    const result = await db.storage.from('school-logos').createSignedUrl(x.logo_path,1800)
    if(result.data?.signedUrl) requestLogos.value[x.id] = result.data.signedUrl
  }))
}
async function requestPost(url:string,body:any){
  const {data:{session}} = await db.auth.getSession()
  if(!session) throw new Error('Sign in again')
  return await $fetch(url,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body})
}
async function reviewRequest(r:any,approve:boolean){
  if(!confirm(`${approve?'Approve':'Reject'} ${r.school_name}? Approval creates the school but does NOT grant administrator access.`)) return
  requestBusy.value=r.id;requestError.value='';requestMessage.value='';requestNotice.value=''
  const res=await db.rpc('review_school_enquiry',{p_request_id:r.id,p_approve:approve,p_notes:requestNotes.value[r.id]||null})
  requestBusy.value=''
  if(res.error){requestError.value=res.error.message;return}
  requestMessage.value=approve?'School created. You can now invite its administrator.':'Request rejected.'
  await Promise.all([loadRequests(),load()])
  try{await requestPost('/api/admin/school-enquiries/notify',{requestId:r.id})}
  catch(e:any){requestNotice.value='Review saved, but notification email failed: '+(e?.data?.statusMessage||e?.message||'Unknown error')}
}
async function inviteRequest(r:any){
  requestInviteBusy.value=r.id;requestError.value='';requestMessage.value=''
  try{const result=await requestPost('/api/admin/school-invitations/send',{requestId:r.id,email:requestInviteEmails.value[r.id]||r.contact_email}) as any;requestMessage.value=result.message}
  catch(e:any){requestError.value=e?.data?.statusMessage||e?.message||'Invitation failed'}
  finally{requestInviteBusy.value=''}
}
function selectSection(section:'schools'|'requests'|'email'){
  mainSection.value=section
  if(section==='requests') void loadRequests()
}

function setTab(tab: string){ activeTab.value = tab as typeof activeTab.value }
const showAddSchool = ref(false)
const filteredSchools = computed(() => visibleSchools.value.filter(s => (s.name + ' ' + (s.code || '')).toLowerCase().includes(search.value.toLowerCase())))
const activeCount = computed(() => schools.value.filter(s => !s.deactivated_at).length)
const verifiedCount = computed(() => domains.value.filter(d => d.is_verified).length)
const registeredDomainsCount = computed(() => domains.value.filter(d => d.is_verified && d.allow_student_registration).length)
const visibleSchools = computed(() => schools.value.filter(s => showInactive.value || !s.deactivated_at))
const selectedSchool = computed(() => schools.value.find(s => s.id === selectedId.value))
const domainRows = computed(() => domains.value.filter(d => d.school_id === selectedId.value))
function clearMessages(){ error.value=''; message.value='' }
async function load(){
  const [s,d] = await Promise.all([
    db.from('schools').select('id,name,code,allow_student_self_registration,deactivated_at').order('name'),
    db.from('school_email_domains').select('id,school_id,domain,is_primary,is_verified,allow_student_registration').order('domain')
  ])
  schools.value=(s.data||[]) as School[]
  domains.value=(d.data||[]) as Domain[]
  error.value=s.error?.message||d.error?.message||''
  if(!schools.value.some(x=>x.id===selectedId.value)) selectedId.value=(schools.value.find(x=>!x.deactivated_at)||schools.value[0])?.id||''
}
onMounted(async()=>{await load();if(route.query.tab==='requests')selectSection('requests');else if(route.query.tab==='email')selectSection('email');else await loadRequests()})
async function addSchool(){
  clearMessages(); busy.value=true
  const r=await db.from('schools').insert({name:name.value.trim(),code:code.value.trim()||null}).select('id').single()
  busy.value=false
  if(r.error){error.value=r.error.message;return}
  name.value='';code.value='';await load();selectedId.value=r.data.id;showAddSchool.value=false;activeTab.value='domains';message.value='School created. Configure its approved email domains below.'
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
async function lifecycle(action:'deactivate'|'restore'|'delete'){
  const school=selectedSchool.value
  if(!school)return
  clearMessages()
  if(action==='deactivate' && !confirm(`Deactivate ${school.name}? School-based access will be suspended.`))return
  if(action==='restore' && !confirm(`Restore ${school.name}? School-based access will resume.`))return
  if(action==='delete' && confirmation.value!==school.name){error.value='Type the exact school name to confirm permanent deletion.';return}
  if(action==='delete' && !confirm(`Permanently delete ${school.name}? This cannot be undone. Deletion is blocked if linked records exist.`))return
  busy.value=true
  const r=await db.rpc('school_lifecycle',{p_school_id:school.id,p_action:action,p_confirm_name:action==='delete'?confirmation.value:null})
  busy.value=false
  if(r.error){error.value=r.error.message;return}
  confirmation.value=''
  if(action==='delete')selectedId.value=''
  await load()
  message.value=action==='deactivate'?'School deactivated.':action==='restore'?'School restored.':'Empty school permanently deleted.'
}
</script>
<template>
  <div class="schools-workspace">
    <header class="schools-heading">
      <div>
        <div class="schools-breadcrumb"><NuxtLink to="/dashboard">Dashboard</NuxtLink><span>›</span><span>Administration</span><span>›</span><strong>Schools</strong></div>
        <h1><span class="schools-title-icon">▦</span> Schools</h1>
        <p>Manage school profiles, requests, email settings, verified domains and access.</p>
      </div>
      <button v-if="mainSection==='schools'" class="schools-primary" type="button" @click="showAddSchool = !showAddSchool">{{ showAddSchool ? 'Close' : '+ Add School' }}</button>
    </header>
    <nav class="schools-main-tabs" aria-label="Schools sections">
      <button type="button" :class="{'schools-main-active':mainSection==='schools'}" @click="selectSection('schools')">Schools</button>
      <button type="button" :class="{'schools-main-active':mainSection==='requests'}" @click="selectSection('requests')">School Requests <span class="schools-request-count">{{ pendingRequests.length }}</span></button>
      <button type="button" :class="{'schools-main-active':mainSection==='email'}" @click="selectSection('email')">Email Settings</button>
    </nav>
    <section v-if="mainSection==='email'" class="schools-panel schools-requests-panel schools-email-panel">
      <div class="schools-panel-head"><div><h2>Email Settings</h2><p class="schools-muted">Platform-wide Microsoft Graph email delivery for School Sports Tracker.</p></div></div>
      <div class="schools-email-info"><span>Sender mailbox</span><strong>sportstracker@kiallacomputers.com.au</strong><p class="schools-muted">The sending mailbox is configured using the Netlify environment variable MICROSOFT_SENDER_EMAIL.</p></div>
      <h3>Send a test email</h3>
      <p class="schools-muted">Only Platform Administrators can send a test email.</p>
      <form class="schools-form schools-email-form" @submit.prevent="sendTestEmail">
        <label>Recipient email<input v-model="testRecipient" type="email" required autocomplete="email" placeholder="you@example.com"></label>
        <button class="schools-primary" type="submit" :disabled="emailBusy">{{ emailBusy ? 'Sending…' : 'Send Test Email' }}</button>
      </form>
      <p v-if="emailError" class="schools-alert schools-error" role="alert">{{ emailError }}</p>
      <p v-if="emailResult" class="schools-alert schools-success" role="status">{{ emailResult }}</p>
      <p class="schools-muted schools-email-note">Changing the sending mailbox requires updating Netlify environment variables and redeploying. Supabase Auth verification and password-reset emails require separate SMTP configuration or a Send Email Hook.</p>
    </section>
    <section v-if="mainSection==='requests'" class="schools-panel schools-requests-panel">
      <div class="schools-panel-head"><div><h2>School Requests</h2><p class="schools-muted">Verify the school and its representative before approval. Approval does not automatically grant administrator access.</p></div><div class="schools-actions"><button class="schools-secondary" type="button" @click="requestFilter=requestFilter==='pending'?'all':'pending'">{{ requestFilter==='pending'?'Show All Requests':'Show Pending Only' }}</button><button class="schools-secondary" type="button" @click="loadRequests">Refresh</button></div></div>
      <p v-if="requestError" class="schools-alert schools-error" role="alert">{{ requestError }}</p>
      <p v-if="requestMessage" class="schools-alert schools-success" role="status">{{ requestMessage }}</p>
      <p v-if="requestNotice" class="schools-alert schools-error" role="alert">{{ requestNotice }}</p>
      <div v-for="r in shownRequests" :key="r.id" class="schools-request-card">
        <div class="schools-request-head"><img v-if="requestLogos[r.id]" :src="requestLogos[r.id]" :alt="`${r.school_name} logo`" class="schools-request-logo"><div><h3>{{ r.school_name }}</h3><span class="schools-status" :class="r.status==='pending'?'schools-pending':r.status==='approved'?'schools-active':'schools-inactive'">{{ r.status }}</span><p class="schools-muted">Requested {{ r.created_at ? new Date(r.created_at).toLocaleDateString('en-AU') : '—' }}</p></div></div>
        <div class="schools-request-facts"><div><span>Domain</span><strong>{{ r.school_domain || '—' }}</strong></div><div><span>Website</span><strong>{{ r.school_website || '—' }}</strong></div><div><span>Contact</span><strong>{{ r.contact_name }} · {{ r.contact_position || '—' }}</strong></div><div><span>Email</span><strong>{{ r.contact_email }}</strong></div><div><span>Phone</span><strong>{{ r.contact_phone || '—' }}</strong></div></div>
        <p v-if="r.notes" class="schools-muted">Request notes: {{ r.notes }}</p>
        <p v-if="r.review_notes" class="schools-muted">Review notes: {{ r.review_notes }}</p>
        <template v-if="r.status==='pending'"><label class="schools-request-label">Private review notes<textarea v-model="requestNotes[r.id]" rows="2" placeholder="Verification details or reasons for the decision"></textarea></label><div class="schools-actions"><button class="schools-primary" type="button" :disabled="!!requestBusy || !!requestInviteBusy" @click="reviewRequest(r,true)">Approve School</button><button class="schools-danger-outline" type="button" :disabled="!!requestBusy || !!requestInviteBusy" @click="reviewRequest(r,false)">Reject Request</button></div></template>
        <div v-if="r.status==='approved'" class="schools-request-invite"><h3>Invite first School Administrator</h3><p class="schools-muted">The invitation must be accepted by a verified account using the same email address.</p><label class="schools-request-label">Administrator email<input v-model="requestInviteEmails[r.id]" type="email" :placeholder="r.contact_email"></label><button class="schools-primary" type="button" :disabled="!!requestInviteBusy || !!requestBusy" @click="inviteRequest(r)">Send Invitation</button></div>
      </div>
      <p v-if="!shownRequests.length" class="schools-muted">{{requestFilter==='pending'?'No pending school requests.':'No school requests yet.'}}</p>
    </section>
    <template v-else>
    <p v-if="error" class="schools-alert schools-error" role="alert">{{ error }}</p>
    <p v-if="message" class="schools-alert schools-success" role="status">{{ message }}</p>
    <section v-if="showAddSchool" class="schools-panel schools-add">
      <h2>Create a new school</h2>
      <form class="schools-form schools-add-form" @submit.prevent="addSchool">
        <label>School name<input v-model="name" required maxlength="150" placeholder="School name"></label>
        <label>Code (optional)<input v-model="code" maxlength="30" placeholder="SJE"></label>
        <button class="schools-primary" :disabled="busy">Create School</button>
      </form>
    </section>
    <section class="schools-stats">
      <div class="schools-stat"><span class="schools-stat-icon">▦</span><div><strong>{{ schools.length }}</strong><span>Total Schools</span></div></div>
      <div class="schools-stat"><span class="schools-stat-icon">✓</span><div><strong>{{ activeCount }}</strong><span>Active Schools</span></div></div>
      <div class="schools-stat"><span class="schools-stat-icon">✉</span><div><strong>{{ verifiedCount }}</strong><span>Verified Domains</span></div></div>
      <div class="schools-stat"><span class="schools-stat-icon">◈</span><div><strong>{{ registeredDomainsCount }}</strong><span>Signup Domains</span></div></div>
    </section>
    <div class="schools-layout">
      <section class="schools-panel schools-directory">
        <div class="schools-panel-head"><h2>School Directory</h2><span>{{ filteredSchools.length }} schools</span></div>
        <input v-model="search" class="schools-search" placeholder="Search schools or codes…" aria-label="Search schools">
        <label class="schools-check"><input v-model="showInactive" type="checkbox"> Show deactivated schools</label>
        <div class="schools-list">
          <button v-for="school in filteredSchools" :key="school.id" type="button" class="schools-school" :class="{'schools-school-active':selectedId===school.id}" @click="selectedId=school.id;activeTab='overview';clearMessages()">
            <span class="schools-school-avatar">{{ school.name.slice(0,1).toUpperCase() }}</span>
            <span class="schools-school-info"><strong>{{ school.name }}</strong><small>{{ school.code || 'No school code' }}</small></span>
            <span class="schools-status" :class="school.deactivated_at ? 'schools-inactive' : 'schools-active'">{{ school.deactivated_at ? 'Inactive' : 'Active' }}</span>
          </button>
          <p v-if="!filteredSchools.length" class="schools-muted">No schools match your search.</p>
        </div>
      </section>
      <section class="schools-panel schools-detail" v-if="selectedSchool">
        <div class="schools-selected-header"><div class="schools-selected-avatar">{{ selectedSchool.name.slice(0,1).toUpperCase() }}</div><div><h2>{{ selectedSchool.name }}</h2><p>{{ selectedSchool.code || 'School code not set' }} · {{ selectedSchool.deactivated_at ? 'Deactivated' : 'Active school' }}</p></div></div>
        <nav class="schools-tabs" aria-label="School management sections">
          <button v-for="tab in [{id:'overview',label:'Overview'},{id:'details',label:'School Details'},{id:'domains',label:'Email Domains'},{id:'administration',label:'Administration'}]" :key="tab.id" type="button" :class="{'schools-tab-active':activeTab===tab.id}" @click="setTab(tab.id)">{{ tab.label }}</button>
        </nav>
        <div v-if="activeTab==='overview'" class="schools-tab-content">
          <h3>School Overview</h3>
          <div class="schools-overview-grid"><div><span>School status</span><strong>{{ selectedSchool.deactivated_at ? 'Deactivated' : 'Active' }}</strong></div><div><span>Email domains</span><strong>{{ domainRows.length }}</strong></div><div><span>Verified domains</span><strong>{{ domainRows.filter(d=>d.is_verified).length }}</strong></div><div><span>Student self-registration</span><strong>{{ selectedSchool.allow_student_self_registration ? 'Enabled' : 'Disabled' }}</strong></div></div>
          <h3>Quick Actions</h3>
          <div class="schools-actions"><button class="schools-primary" type="button" @click="activeTab='details'">Edit School</button><button class="schools-secondary" type="button" @click="activeTab='domains'">Manage Domains</button><button class="schools-secondary" type="button" @click="activeTab='administration'">Administration</button></div>
        </div>
        <div v-if="activeTab==='details'" class="schools-tab-content"><h3>School Details</h3><form class="schools-form" @submit.prevent="saveSchool"><label>School name<input v-model="selectedSchool.name" required maxlength="150"></label><label>School code<input v-model="selectedSchool.code" maxlength="30"></label><label class="schools-check"><input v-model="selectedSchool.allow_student_self_registration" type="checkbox"> Allow student self-registration</label><button class="schools-primary" :disabled="busy">Save School</button></form></div>
        <div v-if="activeTab==='domains'" class="schools-tab-content"><h3>Email Domains</h3><p class="schools-muted">Only verified, enabled domains permit new student registration. Verify ownership independently before marking a domain as verified.</p><form class="schools-form schools-domain-form" @submit.prevent="addDomain"><label>New school email domain<input v-model="newDomain" required placeholder="school.vic.edu.au" autocomplete="off"></label><button class="schools-primary" :disabled="busy">Add Domain</button></form><div v-for="d in domainRows" :key="d.id" class="schools-domain"><div><strong>@{{ d.domain }}</strong><span v-if="d.is_primary" class="schools-primary-tag">Primary</span><p>{{ d.is_verified ? 'Ownership verified' : 'Unverified' }} · {{ d.allow_student_registration ? 'Student signup enabled' : 'Student signup disabled' }}</p></div><div class="schools-actions"><button class="schools-secondary" type="button" :disabled="busy || d.is_primary" @click="makePrimary(d)">Make Primary</button><button class="schools-secondary" type="button" :disabled="busy" @click="updateDomain(d,'is_verified',!d.is_verified)">{{d.is_verified?'Revoke Verification':'Mark Verified'}}</button><button class="schools-secondary" type="button" :disabled="busy || (!d.is_verified && !d.allow_student_registration)" @click="updateDomain(d,'allow_student_registration',!d.allow_student_registration)">{{d.allow_student_registration?'Disable Signup':'Enable Signup'}}</button><button class="schools-danger-outline" type="button" :disabled="busy" @click="removeDomain(d)">Remove</button></div></div><p v-if="!domainRows.length" class="schools-muted">No email domains configured for this school.</p></div>
        <div v-if="activeTab==='administration'" class="schools-tab-content"><h3>School Administration</h3><p v-if="selectedSchool.deactivated_at" class="schools-muted">This school is deactivated. School membership access is suspended. Review competition-specific staff grants separately.</p><p v-else class="schools-muted">Deactivating a school suspends school-based access while preserving its records.</p><button v-if="!selectedSchool.deactivated_at" type="button" class="schools-danger-outline" :disabled="busy" @click="lifecycle('deactivate')">Deactivate School</button><template v-else><button type="button" class="schools-primary" :disabled="busy" @click="lifecycle('restore')">Restore School</button><div class="schools-danger-zone"><h3>Permanently Delete School</h3><p>Only empty schools can be deleted. Schools with linked records must remain deactivated. This action cannot be undone.</p><label>Type <strong>{{ selectedSchool.name }}</strong> to confirm<input v-model="confirmation" autocomplete="off" placeholder="Exact school name"></label><button class="schools-danger" type="button" :disabled="busy || confirmation!==selectedSchool.name" @click="lifecycle('delete')">Permanently Delete School</button></div></template><p><NuxtLink to="/admin/student-requests">Review student account requests →</NuxtLink></p></div>
      </section>
      <section v-else class="schools-panel schools-detail"><p class="schools-muted">Select a school to view its details.</p></section>
    </div>
    </template>
  </div>
</template>
<style scoped>
.schools-workspace{padding:28px;max-width:1600px;margin:auto;color:#f1f6ff}.schools-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}.schools-breadcrumb{display:flex;gap:12px;align-items:center;color:#95b3d7;font-size:13px;margin-bottom:12px}.schools-breadcrumb a{color:#7ec4ff}.schools-heading h1{font-size:clamp(26px,3vw,38px);font-weight:800;margin:0;display:flex;align-items:center;gap:14px}.schools-title-icon,.schools-selected-avatar{display:grid;place-items:center;background:#0752b4;border-radius:12px;width:52px;height:52px;color:white}.schools-heading p,.schools-selected-header p{color:#9eb5d3;margin:8px 0 0}.schools-primary,.schools-secondary,.schools-danger,.schools-danger-outline{border:1px solid #37628e;border-radius:9px;padding:10px 16px;color:#eef6ff;background:#16365b;cursor:pointer;font-weight:650;white-space:nowrap}.schools-primary{background:#075bc9;border-color:#2276ec}.schools-danger{background:#a52c37;border-color:#c94d55}.schools-danger-outline{color:#ffb7bd;border-color:#8a4855;background:#422431}.schools-primary:disabled,.schools-secondary:disabled,.schools-danger:disabled,.schools-danger-outline:disabled{opacity:.45;cursor:not-allowed}.schools-panel,.schools-stat{background:linear-gradient(140deg,#102b4d,#0a1d37);border:1px solid #28527d;border-radius:14px;min-width:0}.schools-add{padding:22px;margin-bottom:20px}.schools-panel h2{font-size:19px;margin:0}.schools-panel h3{font-size:17px;margin:0 0 18px}.schools-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:20px}.schools-stat{display:flex;gap:18px;align-items:center;padding:20px}.schools-stat-icon{font-size:27px;color:#6cb7ff}.schools-stat strong{display:block;font-size:30px;line-height:1.1}.schools-stat span:last-child{display:block;color:#c2d3e8;margin-top:4px}.schools-layout{display:grid;grid-template-columns:minmax(280px,1fr) minmax(0,2fr);gap:20px;align-items:start}.schools-directory{padding:20px}.schools-detail{padding:24px;min-height:420px}.schools-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.schools-panel-head span,.schools-muted{color:#a7bdd7}.schools-search,.schools-form input:not([type=checkbox]),.schools-danger-zone input{width:100%;min-width:0;background:#091b32;color:#f3f7ff;border:1px solid #3b5d81;border-radius:8px;padding:12px;box-sizing:border-box}.schools-check{display:flex!important;align-items:center;gap:10px;color:#b9cde6;font-size:13px;margin:14px 0}.schools-check input{width:auto!important;accent-color:#2185ff}.schools-list{display:grid;gap:9px;max-height:650px;overflow:auto}.schools-school{width:100%;display:flex;gap:12px;align-items:center;text-align:left;border:1px solid #294a70;border-radius:10px;background:#102844;padding:12px;color:#fff;cursor:pointer}.schools-school-active{background:#104582;border-color:#2888fa}.schools-school-avatar{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:9px;background:#0860c8;font-weight:800}.schools-school-info{flex:1;min-width:0}.schools-school-info strong,.schools-school-info small{display:block;overflow:hidden;text-overflow:ellipsis}.schools-school-info small{color:#aac2df;margin-top:3px}.schools-status{font-size:11px;padding:5px 8px;border-radius:20px}.schools-active{background:#164f40;color:#a9f2c6}.schools-inactive{background:#56393d;color:#ffbec1}.schools-selected-header{display:flex;gap:16px;align-items:center;margin-bottom:23px}.schools-selected-avatar{width:58px;height:58px;font-size:25px;font-weight:800}.schools-tabs{display:flex;gap:5px;border:1px solid #2d537c;background:#0b2340;border-radius:10px;padding:5px;overflow:auto}.schools-tabs button{flex:1;border:0;background:transparent;color:#c7d9ef;padding:13px 9px;border-radius:8px;white-space:nowrap;cursor:pointer;font-weight:650}.schools-tabs .schools-tab-active{background:#095bc9;color:white}.schools-tab-content{padding-top:25px}.schools-overview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:26px}.schools-overview-grid>div{border:1px solid #2a527d;border-radius:10px;padding:16px;background:#0b2543}.schools-overview-grid span{display:block;color:#a8bfdc;font-size:13px;margin-bottom:8px}.schools-overview-grid strong{font-size:19px}.schools-actions{display:flex;gap:9px;flex-wrap:wrap}.schools-form{display:grid;gap:16px;max-width:650px}.schools-form label,.schools-danger-zone label{display:grid;gap:7px;color:#d4e4f7}.schools-form .schools-check{display:flex}.schools-add-form{grid-template-columns:2fr 1fr auto;align-items:end;max-width:none}.schools-domain-form{grid-template-columns:1fr auto;align-items:end;margin-bottom:20px}.schools-domain{border-top:1px solid #294b70;padding:18px 0}.schools-domain p{color:#a7bfdc;font-size:13px;margin:6px 0 14px}.schools-primary-tag{display:inline-block;margin-left:10px;font-size:11px;border-radius:20px;background:#134d86;color:#c5e4ff;padding:3px 8px}.schools-danger-zone{margin:25px 0;padding:20px;border:1px solid #874955;border-radius:12px;background:#321f30}.schools-danger-zone p{color:#e8b8c0}.schools-danger-zone label{margin-bottom:14px}.schools-alert{padding:13px 17px;border-radius:9px;margin-bottom:18px}.schools-error{background:#492634;color:#ffc9cf}.schools-success{background:#1a493e;color:#b3f2ce}@media(max-width:1100px){.schools-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.schools-layout{grid-template-columns:1fr}.schools-list{max-height:300px}}@media(max-width:620px){.schools-workspace{padding:14px}.schools-heading{align-items:flex-start}.schools-heading h1{font-size:25px}.schools-heading .schools-primary{padding:10px}.schools-stats{gap:9px}.schools-stat{padding:13px;gap:9px}.schools-stat strong{font-size:23px}.schools-stat span:last-child{font-size:12px}.schools-detail,.schools-directory{padding:15px}.schools-add-form,.schools-domain-form,.schools-overview-grid{grid-template-columns:1fr}.schools-selected-header h2{font-size:19px}.schools-tabs button{flex:none}.schools-school{flex-wrap:wrap}}
.schools-main-tabs{display:flex;gap:8px;margin:0 0 20px;border-bottom:1px solid #31577c;padding-bottom:9px}.schools-main-tabs button{border:0;background:transparent;color:#bcd4f1;padding:12px 18px;border-radius:9px;font-weight:700;cursor:pointer}.schools-main-tabs .schools-main-active{background:#075bc9;color:#fff}.schools-request-count{display:inline-block;margin-left:7px;background:#1b4c83;border-radius:20px;padding:2px 8px}.schools-requests-panel{padding:24px}.schools-request-card{border:1px solid #31577c;background:#0a2340;border-radius:12px;padding:20px;margin-top:16px}.schools-request-head{display:flex;align-items:center;gap:18px;margin-bottom:18px}.schools-request-logo{max-width:110px;max-height:90px;object-fit:contain}.schools-request-head h3{margin:0 0 8px}.schools-pending{background:#57431f;color:#ffe1a0}.schools-request-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.schools-request-facts>div{min-width:0}.schools-request-facts span{display:block;color:#9fb8d7;font-size:12px;margin-bottom:5px}.schools-request-facts strong{overflow-wrap:anywhere}.schools-request-label{display:grid;gap:8px;color:#d4e4f7;margin:15px 0}.schools-request-label input,.schools-request-label textarea{width:100%;background:#091b32;color:#fff;border:1px solid #3b5d81;border-radius:8px;padding:12px;box-sizing:border-box}.schools-request-invite{margin-top:18px;padding:16px;border:1px solid #31577c;border-radius:10px}.schools-request-invite h3{margin-bottom:6px}@media(max-width:620px){.schools-request-facts{grid-template-columns:1fr}.schools-requests-panel{padding:14px}.schools-requests-panel .schools-panel-head{flex-wrap:wrap}.schools-main-tabs button{padding:10px}}
.schools-email-panel{max-width:900px}.schools-email-info{padding:18px;border:1px solid #31577c;background:#0a2340;border-radius:10px;margin:18px 0 24px}.schools-email-info span{display:block;color:#9fb8d7;font-size:13px;margin-bottom:7px}.schools-email-info strong{overflow-wrap:anywhere}.schools-email-info p{margin:10px 0 0}.schools-email-form{margin:15px 0 20px}.schools-email-form button{justify-self:start}.schools-email-note{margin-top:26px;line-height:1.6}@media(max-width:620px){.schools-main-tabs{overflow-x:auto}.schools-main-tabs button{white-space:nowrap}}
</style>
