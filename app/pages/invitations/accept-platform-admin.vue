<script setup lang="ts">
const route=useRoute(),db=useSupabaseClient()
const token=computed(()=>typeof route.query.token==='string'?route.query.token:'')
const busy=ref(false),checking=ref(true),success=ref(false),error=ref('')
const next=computed(()=>'/invitations/accept-platform-admin?token='+encodeURIComponent(token.value))
async function accept(){
 if(busy.value)return
 busy.value=true;error.value=''
 try{const r=await db.rpc('accept_platform_admin_invitation',{p_token:token.value});if(r.error)throw r.error;success.value=true}
 catch(e:any){error.value=e?.message||'Unable to accept invitation'}
 finally{busy.value=false}
}
onMounted(async()=>{
 if(!/^[a-f0-9]{64}$/.test(token.value)){error.value='Invalid invitation link';checking.value=false;return}
 const {data:{user}}=await db.auth.getUser()
 checking.value=false
 if(user)await accept()
})
</script>
<template>
<div class="grid min-h-screen place-items-center bg-slate-50 p-4">
 <section class="w-full max-w-lg rounded-2xl bg-white p-8 text-slate-900 shadow">
  <h1 class="text-2xl font-bold">Platform Administrator invitation</h1>
  <p class="mt-3 text-sm">Platform Administrators have access to all schools and platform settings.</p>
  <p v-if="checking||busy" class="mt-4">Checking invitation…</p>
  <p v-if="success" class="mt-4 text-green-700">Your Platform Administrator access is active. <NuxtLink class="underline" to="/dashboard">Go to dashboard</NuxtLink></p>
  <template v-else-if="!checking&&!busy">
   <p v-if="error" role="alert" class="mt-4 text-red-700">{{error}}</p>
   <p class="mt-4">Sign in or create an account using the invited email address. Confirm your email before accepting.</p>
   <div class="mt-5 flex flex-wrap gap-3">
    <NuxtLink class="rounded-lg bg-blue-600 p-3 text-white" :to="'/login?redirect='+encodeURIComponent(next)">Sign in</NuxtLink>
    <NuxtLink class="rounded-lg border p-3" :to="'/invitations/register-platform-admin?token='+encodeURIComponent(token)">Create account</NuxtLink>
   </div>
   <button v-if="error" type="button" class="mt-4 underline" @click="accept">Try again</button>
  </template>
 </section>
</div>
</template>