<script setup lang="ts">
const db=useSupabaseClient(),route=useRoute()
const busy=ref(true),saving=ref(false),error=ref(''),notice=ref(''),schoolName=ref(''),schoolId=ref(''),isAdmin=ref(false),isPlatformAdmin=ref(false),inviteEmail=ref('')
const members=ref<any[]>([]),requests=ref<any[]>([])
const staffSearch=ref(''),staffCandidates=ref<any[]>([]),selectedStaff=ref(''),searchingStaff=ref(false),staffSearchError=ref(''),assignRole=ref('teacher'),editingRoleUser=ref(''),editingRole=ref('teacher'),promotionRequests=ref<any[]>([]),invitations=ref<any[]>([])
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
    if(assignRole.value==='school_admin' && !isPlatformAdmin.value)throw new Error('Only SuperAdmin can assign the School Administrator role')
    if(assignRole.value==='school_admin'){
      const promoted=await db.rpc('set_school_staff_role',{p_school_id:schoolId.value,p_user_id:selectedStaff.value,p_role:'school_admin'})
      if(promoted.error)throw new Error('Staff assigned as Teacher, but promotion failed: '+promoted.error.message)
    }
    notice.value=assignRole.value==='school_admin'?'Staff account assigned as School Administrator.':'Staff account assigned as Teacher.'
    dismissAction();await load()
  }catch(e:any){staffSearchError.value=e.message||'Unable to assign staff'}
  finally{saving.value=false}
}


const actionModal = ref(false)
const actionKind = ref('')
function dismissAction(){
  actionModal.value=false
  staffSearch.value='';staffCandidates.value=[];selectedStaff.value='';staffSearchError.value='';assignRole.value='teacher';++searchSequence
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
  const platformAdmin=platform.data===true
  isPlatformAdmin.value=platformAdmin
  const {data:mine,error:me}=await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id)
  if(me){error.value=me.message;return}
  let wanted=typeof route.query.school==='string'?route.query.school:''
  // If a flyout or bookmark omitted the school, recover a valid school context.
  // Never use an arbitrary school for a non-platform administrator.
  if(!wanted){
    if(platformAdmin){
      const {data:schools,error:schoolsError}=await db.from('schools').select('id').order('name').limit(1)
      if(schoolsError){error.value=schoolsError.message;return}
      wanted=schools?.[0]?.id||''
    }else{
      wanted=(mine||[]).find((m:any)=>['school_admin','teacher'].includes(m.role))?.school_id||''
    }
    if(wanted){await navigateTo({path:route.path,query:{...route.query,school:wanted},replace:true});return}
  }
  const membership=(mine||[]).find((m:any)=>m.school_id===wanted&&['school_admin','teacher'].includes(m.role))
  if(!wanted || (!platformAdmin && !membership)){
    error.value='You do not have access to this school.';return
  }
  const {data:school,error:schoolError}=await db.from('schools').select('name').eq('id',wanted).single()
  if(schoolError){error.value=schoolError.message;return}
  schoolId.value=wanted
  schoolName.value=school.name
  isAdmin.value=platformAdmin || membership?.role==='school_admin'
  const result=await db.rpc('school_member_directory',{p_school_id:wanted})
  if(result.error){error.value=result.error.message;return}
  members.value=result.data||[]
  requests.value=[]
  if(isAdmin.value){
    const inv=await db.rpc('list_school_staff_invitations',{p_school_id:wanted})
    if(inv.error){error.value=inv.error.message;return}
    invitations.value=inv.data||[]
  }else{invitations.value=[]}
  const pr=await db.rpc('list_school_admin_promotion_requests',{p_school_id:wanted})
  if(pr.error){error.value=pr.error.message;return}
  promotionRequests.value=pr.data||[]
}

watch(()=>route.query.school,async()=>{busy.value=true;try{await load()}finally{busy.value=false}})
onMounted(async()=>{try{await load()}finally{busy.value=false}})
async function revoke(userId:string){if(!confirm('Remove this teacher’s access to this school?'))return;saving.value=true;error.value='';notice.value='';try{const {error:e}=await db.rpc('revoke_school_staff',{p_school_id:schoolId.value,p_user_id:userId});if(e)throw e;notice.value='Teacher access removed.';await load()}catch(e:any){error.value=e.message}finally{saving.value=false}}
async function changeRole(userId:string){
  if(!isPlatformAdmin.value || !schoolId.value || !['teacher','school_admin'].includes(editingRole.value))return
  saving.value=true;error.value='';notice.value=''
  try{
    const {error:e}=await db.rpc('set_school_staff_role',{p_school_id:schoolId.value,p_user_id:userId,p_role:editingRole.value})
    if(e)throw e
    notice.value='Staff role updated.'
    editingRoleUser.value=''
    await load()
  }catch(e:any){error.value=e.message||'Unable to update staff role'}
  finally{saving.value=false}
}
async function requestPromotion(userId:string){
  saving.value=true;error.value='';notice.value=''
  try{
    const {data:{session}}=await db.auth.getSession()
    if(!session)throw Error('Sign in again')
    const r=await $fetch<{message:string}>('/api/staff/promotion-request',{method:'POST',
      headers:{Authorization:`Bearer ${session.access_token}`},
      body:{school_id:schoolId.value,user_id:userId}})
    notice.value=r.message;await load()
  }catch(e:any){error.value=e?.data?.statusMessage||e.message||'Request failed'}
  finally{saving.value=false}
}
async function decidePromotion(requestId:string,approve:boolean){
  if(!isPlatformAdmin.value)return
  saving.value=true;error.value='';notice.value=''
  try{
    const {error:e}=await db.rpc('decide_school_admin_promotion',{p_request_id:requestId,p_approve:approve})
    if(e)throw e
    notice.value=approve?'Promotion approved.':'Promotion rejected.'
    await load()
  }catch(e:any){error.value=e.message||'Unable to review request'}
  finally{saving.value=false}
}
async function cancelInvite(id:string){
 if(!confirm('Cancel this invitation?'))return
 saving.value=true;error.value='';notice.value=''
 try{const {error:e}=await db.rpc('cancel_school_staff_invitation',{p_school_id:schoolId.value,p_invitation_id:id});if(e)throw e;notice.value='Invitation cancelled.';await load()}
 catch(e:any){error.value=e.message||'Unable to cancel invitation'}finally{saving.value=false}
}
async function resendInvite(email:string){
 if(!confirm(`Send a new invitation to ${email}? The previous link will stop working.`))return
 saving.value=true;error.value='';notice.value=''
 try{
 const {data:{session}}=await db.auth.getSession();if(!session)throw Error('Sign in again')
 const r=await $fetch<{message:string}>('/api/staff/invite',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:{school_id:schoolId.value,email}})
 notice.value=r.message;await load()
 }catch(e:any){error.value=e?.data?.statusMessage||e.message||'Unable to resend invitation'}finally{saving.value=false}
}
async function invite(){saving.value=true;error.value='';notice.value='';try{const {data:{session}}=await db.auth.getSession();if(!session)throw Error('Sign in again');const r=await $fetch<{message:string}>('/api/staff/invite',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:{school_id:schoolId.value,email:inviteEmail.value}});notice.value=r.message;inviteEmail.value='';dismissAction();await load()}catch(e:any){error.value=e?.data?.statusMessage||e.message||'Unable to send invitation'}finally{saving.value=false}}
</script>
<template><div class="page"><div class="shell admin-section"><NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink><h1>{{schoolName}} — Staff</h1><p v-if="busy">Loading…</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="success" role="status">{{notice}}</p><template v-if="!busy&&schoolId"><AdminActionModal :open="actionModal && isAdmin" :title="actionKind==='assign'?'Assign Staff':'Invite Staff'" @close="dismissAction">
<div v-if="actionKind==='assign'">
  <p>Search verified, registered accounts belonging to this school's approved email domain. Accounts already assigned to this school are excluded.</p>
  <label class="field"><span>Search by name or school email (at least 2 characters)</span><input v-model="staffSearch" type="search" autocomplete="off" placeholder="Search registered school accounts" /></label>
  <p v-if="searchingStaff">Searching…</p><p v-if="staffSearchError" class="error" role="alert">{{staffSearchError}}</p>
  <label v-if="staffCandidates.length" class="field"><span>Select account</span><select v-model="selectedStaff"><option value="">Choose a staff account</option><option v-for="person in staffCandidates" :key="person.user_id" :value="person.user_id">{{person.display_name}} — {{person.email}}</option></select></label>
  <p v-else-if="staffSearch.trim().length>=2 && !searchingStaff && !staffSearchError">No eligible registered accounts found.</p>
  <label class="field"><span>School role</span><select v-model="assignRole"><option value="teacher">Teacher</option><option v-if="isPlatformAdmin" value="school_admin">School Administrator</option></select></label>
  <div style="display:flex;gap:.75rem;margin-top:1rem"><button type="button" class="btn" :disabled="saving||!selectedStaff" @click="assignStaff">{{saving?'Assigning…':'Assign Staff'}}</button><button type="button" class="btn" :disabled="saving" @click="dismissAction">Cancel</button></div>
</div>
<div v-else><h2>Invite a teacher</h2><p>Invitations are emailed to staff. After accepting with their verified school email, they are automatically assigned as a Teacher.</p><form @submit.prevent="invite"><label class="field"><span>Staff email address</span><input v-model="inviteEmail" type="email" required maxlength="254" placeholder="teacher@school.edu.au"></label><button class="btn" :disabled="saving">{{saving?'Sending…':'Send staff invitation'}}</button></form></div></AdminActionModal><div v-if="isAdmin" class="card" style="margin-top:1rem"><h2>Staff Invitations</h2>
<div v-for="i in invitations" :key="i.id" class="data-row" style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
<div><strong>{{i.email}}</strong><small style="display:block">Sent {{new Date(i.created_at).toLocaleDateString()}} · {{i.accepted_at?'Accepted':i.revoked_at?'Cancelled':new Date(i.expires_at).getTime()<=Date.now()?'Expired':'Pending'}}</small></div>
<div v-if="!i.accepted_at && !i.revoked_at && new Date(i.expires_at).getTime()>Date.now()" style="display:flex;gap:.5rem">
<button class="btn" :disabled="saving" @click="resendInvite(i.email)">Resend</button>
<button class="btn" :disabled="saving" @click="cancelInvite(i.id)">Cancel</button>
</div></div><p v-if="!invitations.length">No invitations sent to this school yet.</p></div><div v-if="promotionRequests.length" class="card" style="margin-top:1rem">
<h2>School Administrator promotion requests</h2>
<div v-for="r in promotionRequests" :key="r.id" class="data-row" style="display:flex;justify-content:space-between;gap:1rem;align-items:center">
<div><strong>{{r.staff_name || r.staff_email || r.user_id}}</strong><small style="display:block">{{r.status}} · Requested {{new Date(r.created_at).toLocaleDateString()}}</small></div>
<div v-if="isPlatformAdmin && r.status==='pending'" style="display:flex;gap:.5rem">
<button class="btn" :disabled="saving" @click="decidePromotion(r.id,true)">Approve</button>
<button class="btn" :disabled="saving" @click="decidePromotion(r.id,false)">Reject</button>
</div></div></div><div class="card" style="margin-top:1rem"><h2>School members ({{members.length}})</h2><div v-for="m in members" :key="m.user_id" class="data-row" style="display:flex;align-items:center;justify-content:space-between;gap:1rem"><div><strong>{{m.display_name || 'Name not provided'}}</strong><small style="display:block">{{m.role==='school_admin'?'School Administrator':'Teacher'}}</small></div><div v-if="isAdmin" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
  <template v-if="isPlatformAdmin && editingRoleUser===m.user_id">
    <select v-model="editingRole" aria-label="Staff role"><option value="teacher">Teacher</option><option value="school_admin">School Administrator</option></select>
    <button class="btn" :disabled="saving || editingRole===m.role" @click="changeRole(m.user_id)">Save role</button>
    <button class="btn" :disabled="saving" @click="editingRoleUser=''">Cancel</button>
  </template>
  <button v-if="isPlatformAdmin" class="btn" :disabled="saving" @click="editingRoleUser=m.user_id;editingRole=m.role">Change Role</button>
  <button v-else-if="m.role==='teacher'" class="btn" :disabled="saving || promotionRequests.some((r:any)=>r.user_id===m.user_id && r.status==='pending')" @click="requestPromotion(m.user_id)">Request School Admin</button>
  <button v-if="m.role==='teacher'" class="btn" :disabled="saving" @click="revoke(m.user_id)">Remove access</button>
</div></div><p v-if="!members.length">No members found.</p></div></template></div></div></template>
