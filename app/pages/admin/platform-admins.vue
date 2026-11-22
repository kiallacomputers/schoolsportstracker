<script setup lang="ts">
definePageMeta({layout:'workspace'})
const db=useSupabaseClient()
const {platformAdmin}=useSchool()
const email=ref(''),busy=ref(false),error=ref(''),notice=ref(''),confirm=ref(false),invitations=ref<any[]>([])
async function load(){
 if(!platformAdmin.value)return
 const r=await db.from('platform_admin_invitations').select('id,email,created_at,expires_at,accepted_at,revoked_at').order('created_at',{ascending:false})
 if(r.error)error.value=r.error.message
 else invitations.value=r.data||[]
}
function requestInvite(){
 if(!platformAdmin.value||!email.value.trim())return
 error.value='';confirm.value=true
}
async function send(){
 if(!platformAdmin.value||busy.value)return
 confirm.value=false;busy.value=true;error.value='';notice.value=''
 try{
  const {data:{session}}=await db.auth.getSession()
  if(!session?.access_token)throw new Error('Please sign in again')
  const r=await $fetch<{message:string}>('/api/platform-admin/invite',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},body:{email:email.value.trim().toLowerCase()}})
  notice.value=r.message;email.value='';await load()
 }catch(e:any){error.value=e?.data?.statusMessage||e?.data?.message||e?.message||'Invitation failed'}
 finally{busy.value=false}
}
const status=(i:any)=>i.accepted_at?'Accepted':i.revoked_at?'Revoked':new Date(i.expires_at).getTime()<Date.now()?'Expired':'Pending'
watch(platformAdmin,()=>{void load()},{immediate:true})
</script>
<template>
<div class="space-y-6">
 <UiPageHeader title="Platform Administrators" description="Invite trusted administrators to manage the entire SportsTracker platform."/>
 <UiPanel v-if="!platformAdmin">Only Platform Administrators can access this page.</UiPanel>
 <template v-else>
  <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-700">{{error}}</p>
  <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-green-700">{{notice}}</p>
  <UiPanel>
   <h2 class="mb-3 text-lg font-bold">Invite a Platform Administrator</h2>
   <p class="mb-4 text-sm text-[var(--muted)]">This grants platform-wide administrator access only after the recipient accepts the email invitation. Invitations expire after seven days.</p>
   <form class="flex flex-wrap items-end gap-3" @submit.prevent="requestInvite">
    <label class="min-w-[240px] flex-1 text-sm font-semibold">Email address<input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="administrator@example.com" class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <button type="submit" :disabled="busy" class="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">Send invitation</button>
   </form>
  </UiPanel>
  <UiPanel>
   <h2 class="mb-3 text-lg font-bold">Invitation history</h2>
   <div v-for="i in invitations" :key="i.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-3"><div><strong>{{i.email}}</strong><p class="text-xs text-[var(--muted)]">Invited {{new Date(i.created_at).toLocaleDateString('en-AU')}} · Expires {{new Date(i.expires_at).toLocaleDateString('en-AU')}}</p></div><span class="text-sm font-semibold">{{status(i)}}</span></div>
   <p v-if="!invitations.length" class="text-sm text-[var(--muted)]">No invitations yet.</p>
  </UiPanel>
 </template>
 <div v-if="confirm" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="confirm=false">
  <section role="dialog" aria-modal="true" aria-label="Confirm Platform Administrator invitation" class="w-full max-w-md rounded-xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
   <h2 class="text-xl font-bold">Confirm invitation</h2><p class="my-4">Invite <strong>{{email}}</strong> as a Platform Administrator? They will gain access to all schools and platform administration after accepting.</p>
   <div class="flex justify-end gap-3"><button type="button" class="rounded-lg border border-[var(--border)] px-4 py-2" @click="confirm=false">Cancel</button><button type="button" class="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white" @click="send">Confirm & send</button></div>
  </section>
 </div>
</div>
</template>