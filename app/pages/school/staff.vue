<script setup lang="ts">
const db=useSupabaseClient(),route=useRoute()
const busy=ref(true),saving=ref(false),error=ref(''),notice=ref(''),schoolName=ref(''),schoolId=ref(''),isAdmin=ref(false),inviteEmail=ref('')
const members=ref<any[]>([]),requests=ref<any[]>([])
const staffSearch=ref(''),staffCandidates=ref<any[]>([]),selectedStaff=ref(''),searchingStaff=ref(false),staffSearchError=ref('')
let searchSequence=0
async function searchRegisteredStaff(){
  const seq=++searchSequence
  staffCandidates.value=[];selectedStaff.value='';staffSearchError.value=''
  if(!isAdmin.value || !schoolId.value || staffSearch.value.trim().length<2)return
  searchingStaff.value=true
  try{
    const {data,error:e}=await db.rpc('available_school_staff_accounts',{p_school_id:schoolId.value,p_search:staffSearch.value.trim()})
    if(e)throw e
    if(seq===searchSequence)staffCandidates.value=data||[]
  }catch(e:any){if(seq===searchSequence)staffSearchError.value=e.message||'Unable to search accounts'}
  finally{if(seq===searchSequence)searchingStaff.value=false}
}
watch(staffSearch,()=>{void searchRegisteredStaff()})
async function assignStaff(){
  if(!selectedStaff.value || !isAdmin.value)return
  saving.value=true;error.value='';notice.value='';staffSearchError.value=''
  try{
    const {error:e}=await db.rpc('assign_registered_school_staff',{p_school_id:schoolId.value,p_user_id:selectedStaff.value})
    if(e)throw e
    notice.value='Staff account assigned as Teacher.'
    dismissAction();await load()
  }catch(e:any){staffSearchError.value=e.message||'Unable to assign staff'}
  finally{saving.value=false}
}


const actionModal = ref(false)
const actionKind = ref('')
function dismissAction(){
  actionModal.value=false
  staffSearch.value='';staffCandidates.value=[];selectedStaff.value='';staffSearchError.value='';++searchSequence
  if(typeof route.query.action==='string')navigateTo({path:route.path,query:{...route.query,action:undefined},replace:true})
}
watch(()=>route.query.action,(action)=>{
  if(typeof action==='string' && ['invite','assign'].includes(action)){actionKind.value=action;actionModal.value=true}
},{immediate:true})

async function load(){
  error.value=''; schoolId.value=''; schoolName.value=''; isAdmin.value=false
  const {data:{user},error:authError}=await db.auth.getUser()
  if(authError || !user){await navigateTo('/login');return}
  // Check platform role independently: SuperAdmins do not need school_memberships rows.
  const platform=await db.rpc('is_platform_admin')
  if(platform.error){error.value=platform.error.message;return}
  const isPlatformAdmin=platform.data===true
  const {data:mine,error:me}=await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id)
  if(me){error.value=me.message;return}
  let wanted=typeof route.query.school==='string'?route.query.school:''
  // If a flyout or bookmark omitted the school, recover a valid school context.
  // Never use an arbitrary school for a non-platform administrator.
  if(!wanted){
    if(isPlatformAdmin){
      const {data:schools,error:schoolsError}=await db.from('schools').select('id').order('name').limit(1)
      if(schoolsError){error.value=schoolsError.message;return}
      wanted=schools?.[0]?.id||''
    }else{
      wanted=(mine||[]).find((m:any)=>['school_admin','teacher'].includes(m.role))?.school_id||''
    }
    if(wanted){await navigateTo({path:route.path,query:{...route.query,school:wanted},replace:true});return}
  }
  const membership=(mine||[]).find((m:any)=>m.school_id===wanted&&['school_admin','teacher'].includes(m.role))
  if(!wanted || (!isPlatformAdmin && !membership)){
    error.value='You do not have access to this school.';return
  }
  const {data:school,error:schoolError}=await db.from('schools').select('name').eq('id',wanted).single()
  if(schoolError){error.value=schoolError.message;return}
  schoolId.value=wanted
  schoolName.value=school.name
  isAdmin.value=isPlatformAdmin || membership?.role==='school_admin'
  const result=await db.rpc('school_member_directory',{p_school_id:wanted})
  if(result.error){error.value=result.error.message;return}
  members.value=result.data||[]
  if(isAdmin.value){
    const r=await db.from('school_staff_requests').select('id,user_id,email,given_name,family_name,status,created_at').eq('school_id',wanted).order('created_at',{ascending:false}).limit(500)
    if(r.error){error.value=r.error.message;return}
    requests.value=r.data||[]
  }else{requests.value=[]}
}

watch(()=>route.query.school,async()=>{busy.value=true;try{await load()}finally{busy.value=false}})
onMounted(async()=>{try{await load()}finally{busy.value=false}})
async function review(id:string,approve:boolean){if(!confirm(`${approve?'Approve':'Reject'} this staff request?`))return;saving.value=true;error.value='';notice.value='';try{const {error:e}=await db.rpc('review_staff_request',{p_request_id:id,p_approve:approve});if(e)throw e;notice.value=approve?'Staff member approved.':'Request rejected.';await load()}catch(e:any){error.value=e.message}finally{saving.value=false}}
async function revoke(userId:string){if(!confirm('Remove this teacher’s access to this school?'))return;saving.value=true;error.value='';notice.value='';try{const {error:e}=await db.rpc('revoke_school_staff',{p_school_id:schoolId.value,p_user_id:userId});if(e)throw e;notice.value='Teacher access removed.';await load()}catch(e:any){error.value=e.message}finally{saving.value=false}}
async function invite(){saving.value=true;error.value='';notice.value='';try{const {data:{session}}=await db.auth.getSession();if(!session)throw Error('Sign in again');const r=await $fetch<{message:string}>('/api/staff/invite',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:{school_id:schoolId.value,email:inviteEmail.value}});notice.value=r.message;inviteEmail.value='';dismissAction()}catch(e:any){error.value=e?.data?.statusMessage||e.message||'Unable to send invitation'}finally{saving.value=false}}
</script>
<template><div class="page"><div class="shell admin-section"><NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink><h1>{{schoolName}} — Staff</h1><p v-if="busy">Loading…</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="success" role="status">{{notice}}</p><template v-if="!busy&&schoolId"><AdminActionModal :open="actionModal && isAdmin" :title="actionKind==='assign'?'Assign Staff':'Invite Staff'" @close="dismissAction">
<div v-if="actionKind==='assign'">
  <p>Search verified, registered accounts belonging to this school's approved email domain. Accounts already assigned to this school are excluded. Staff are assigned the Teacher role.</p>
  <label class="field"><span>Search by name or school email (at least 2 characters)</span><input v-model="staffSearch" type="search" autocomplete="off" placeholder="Search registered school accounts" /></label>
  <p v-if="searchingStaff">Searching…</p><p v-if="staffSearchError" class="error" role="alert">{{staffSearchError}}</p>
  <label v-if="staffCandidates.length" class="field"><span>Select account</span><select v-model="selectedStaff"><option value="">Choose a staff account</option><option v-for="person in staffCandidates" :key="person.user_id" :value="person.user_id">{{person.display_name}} — {{person.email}}</option></select></label>
  <p v-else-if="staffSearch.trim().length>=2 && !searchingStaff && !staffSearchError">No eligible registered accounts found.</p>
  <div style="display:flex;gap:.75rem;margin-top:1rem"><button type="button" class="btn" :disabled="saving||!selectedStaff" @click="assignStaff">{{saving?'Assigning…':'Assign Staff'}}</button><button type="button" class="btn" :disabled="saving" @click="dismissAction">Cancel</button></div>
</div>
<div v-else><h2>Invite a teacher</h2><p>Invitations are emailed to staff. They must verify their email and be approved before access is granted.</p><form @submit.prevent="invite"><label class="field"><span>Staff email address</span><input v-model="inviteEmail" type="email" required maxlength="254" placeholder="teacher@school.edu.au"></label><button class="btn" :disabled="saving">{{saving?'Sending…':'Send staff invitation'}}</button></form></div></AdminActionModal><div v-if="isAdmin" class="card" style="margin-top:1rem"><h2>Registration requests</h2><div v-for="r in requests" :key="r.id" class="data-row" style="display:flex;justify-content:space-between;gap:1rem;align-items:center"><div><strong>{{r.given_name}} {{r.family_name}}</strong><div>{{r.email}} · {{r.status}}</div></div><div v-if="r.status==='pending'" style="display:flex;gap:.5rem"><button class="btn" :disabled="saving" @click="review(r.id,true)">Approve</button><button class="btn" :disabled="saving" @click="review(r.id,false)">Reject</button></div></div><p v-if="!requests.length">No staff requests yet.</p></div><div class="card" style="margin-top:1rem"><h2>School members ({{members.length}})</h2><div v-for="m in members" :key="m.user_id" class="data-row" style="display:flex;align-items:center;justify-content:space-between;gap:1rem"><div><strong>{{m.display_name || 'Name not provided'}}</strong><small style="display:block">{{m.role==='school_admin'?'School Administrator':'Teacher'}}</small></div><button v-if="isAdmin&&m.role==='teacher'" class="btn" :disabled="saving" @click="revoke(m.user_id)">Remove access</button></div><p v-if="!members.length">No members found.</p></div></template></div></div></template>
