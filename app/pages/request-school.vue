<script setup lang="ts">
const db=useSupabaseClient()
const user=useSupabaseUser()
const mode=ref<'request'|'signup'>('request')
const schoolName=ref(''),domain=ref(''),code=ref(''),firstName=ref(''),lastName=ref(''),position=ref(''),phone=ref(''),website=ref(''),notes=ref('')
const contactEmail=ref(''),email=ref(''),password=ref(''),busy=ref(false),error=ref(''),message=ref(''),submitted=ref(false)
const logo=ref<File|null>(null),logoPreview=ref(''),requests=ref<any[]>([])
async function load(){if(!user.value)return;const r=await db.from('school_requests').select('id,school_name,school_domain,status,created_at,review_notes,logo_path').order('created_at',{ascending:false});requests.value=r.data||[]}
watch(user,(u)=>{if(u?.email)contactEmail.value=u.email;load()},{immediate:true})
async function signUp(){error.value='';message.value='';busy.value=true;const {error:e}=await db.auth.signUp({email:email.value.trim().toLowerCase(),password:password.value,options:{emailRedirectTo:`${window.location.origin}/request-school`}});busy.value=false;if(e){error.value=e.message;return}message.value='Check your school email and confirm your account. Then sign in to submit your school request.'}
function chooseLogo(event:Event){
 const file=(event.target as HTMLInputElement).files?.[0]||null
 error.value='';logo.value=null;logoPreview.value=''
 if(!file)return
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){error.value='Choose a PNG, JPG or WebP logo.';return}
 if(file.size>2097152){error.value='Logo must be 2 MB or smaller.';return}
 logo.value=file;logoPreview.value=URL.createObjectURL(file)
}
onBeforeUnmount(()=>{if(logoPreview.value)URL.revokeObjectURL(logoPreview.value)})
async function submit(){
 error.value='';message.value=''
 if(!user.value?.email || contactEmail.value.trim().toLowerCase()!==user.value.email.toLowerCase()){error.value='Contact email must match your verified account email.';return}
 const d=domain.value.trim().toLowerCase().replace(/^@/,'')
 if(user.value.email.split('@')[1]?.toLowerCase()!==d){error.value='Your account email must use the requested school domain.';return}
 busy.value=true
 try {
  const {data:id,error:e}=await db.rpc('submit_school_request',{p_school_name:schoolName.value,p_school_domain:d,p_school_code:code.value||null,p_contact_name:`${firstName.value.trim()} ${lastName.value.trim()}`,p_contact_position:position.value,p_contact_phone:phone.value||null,p_notes:[website.value.trim()?`Website: ${website.value.trim()}`:'',notes.value.trim()].filter(Boolean).join('\n')||null})
  if(e)throw e
  submitted.value=true
  if(logo.value){
   const ext=logo.value.type==='image/png'?'png':logo.value.type==='image/webp'?'webp':'jpg'
   const path=`${id}/logo.${ext}`
   const uploaded=await db.storage.from('school-logos').upload(path,logo.value,{contentType:logo.value.type,upsert:false})
   if(uploaded.error){message.value='School request submitted, but logo upload failed. Please contact the administrator with your logo.';error.value=uploaded.error.message}
   else {const attached=await db.rpc('attach_school_request_logo',{p_request_id:id,p_logo_path:path});if(attached.error){error.value=attached.error.message;message.value='School request submitted, but the logo could not be linked.'}}
  }
  if(!message.value)message.value='School request submitted. A platform administrator must verify your authority before approving it.'
  await load()
 }catch(e:any){error.value=e?.message||'Could not submit school request'}finally{busy.value=false}
}
</script>
<template>
<div class="page"><div class="shell admin-section"><NuxtLink to="/">← Home</NuxtLink><h1>Request a School</h1><p>Request to add your school and nominate yourself as its first School Administrator.</p><p class="notice">Use your verified school email. School access is granted only after independent administrator approval.</p>
<p v-if="error" class="error" role="alert">{{error}}</p><p v-if="message" class="success" role="status">{{message}}</p>
<div v-if="!user" class="card"><h2>School representative account</h2><p>Already registered? <NuxtLink to="/login?next=request-school"><u>Sign in to request a school</u></NuxtLink></p><button class="btn" type="button" @click="mode=mode==='signup'?'request':'signup'">{{mode==='signup'?'Hide registration':'Create a representative account'}}</button>
<form v-if="mode==='signup'" class="editor" @submit.prevent="signUp"><label>School email<input v-model="email" type="email" required autocomplete="email"></label><label>Password (8+ characters)<input v-model="password" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn" :disabled="busy">{{busy?'Creating…':'Register and verify email'}}</button></form></div>
<template v-else><form v-if="!submitted" class="card editor" @submit.prevent="submit"><h2>School details</h2><label>School name<input v-model="schoolName" required maxlength="150"></label><label>School email domain (without @)<input v-model="domain" required placeholder="school.vic.edu.au" maxlength="253"></label><label>School code (optional)<input v-model="code" maxlength="30"></label><label>School website (optional)<input v-model="website" type="url" placeholder="https://school.edu.au"></label><label>School logo (optional, PNG/JPG/WebP, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" @change="chooseLogo"></label><img v-if="logoPreview" :src="logoPreview" alt="Selected school logo preview" style="max-width:160px;max-height:120px;object-fit:contain" />
<h2>Proposed School Administrator</h2><label>First name<input v-model="firstName" required maxlength="70"></label><label>Last name<input v-model="lastName" required maxlength="70"></label><label>Position at school<input v-model="position" required maxlength="120" placeholder="e.g. Sports Coordinator"></label><label>Contact email address<input v-model="contactEmail" type="email" required autocomplete="email"></label><p>Must match your verified account email: <strong>{{user.email}}</strong></p><label>Contact phone (optional)<input v-model="phone" type="tel" maxlength="50"></label><label>Additional information<textarea v-model="notes" maxlength="1800" rows="3"></textarea></label><button class="btn" :disabled="busy">{{busy?'Submitting…':'Submit School Request'}}</button></form>
<div v-if="requests.length" class="card"><h2>My School Requests</h2><div v-for="r in requests" :key="r.id" class="data-row"><div><strong>{{r.school_name}}</strong> · @{{r.school_domain}}<p>Status: {{r.status}}</p><p v-if="r.review_notes">Review notes: {{r.review_notes}}</p></div></div></div></template></div></div>
</template>
