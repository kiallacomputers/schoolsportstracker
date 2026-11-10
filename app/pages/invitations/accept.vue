<script setup lang="ts">
const route=useRoute()
const db=useSupabaseClient()
const user=useSupabaseUser()
const token=computed(()=>typeof route.query.token==='string'?route.query.token:'')
const returnPath=computed(()=>`/invitations/accept?token=${encodeURIComponent(token.value)}`)
const signInPath=computed(()=>`/login?redirect=${encodeURIComponent(returnPath.value)}`)
const registerPath=computed(()=>`/invitations/register?redirect=${encodeURIComponent(returnPath.value)}`)
const busy=ref(false),error=ref(''),success=ref('')
async function accept(){
 error.value='';success.value='';busy.value=true
 try{
  if(!user.value)throw new Error('Please sign in using the invited email address.')
  const {error:e}=await db.rpc('accept_school_admin_invitation',{p_token:token.value})
  if(e)throw e
  success.value='Invitation accepted. Your School Administrator access is now active.'
 }catch(e:any){error.value=e?.message||'Unable to accept invitation'}finally{busy.value=false}
}
</script>
<template>
 <div class="page"><div class="shell admin-section" style="max-width:760px;margin:2rem auto">
  <NuxtLink class="brand" to="/"><img src="/logo.png" alt="School Sports Tracker logo"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink>
  <section class="auth" style="max-width:none;margin-top:2rem;padding:2rem">
   <h1>School Administrator Invitation</h1>
   <p>Accept your invitation to manage your school in School Sports Tracker.</p>
   <p v-if="!token" class="error" role="alert">The invitation link is missing its token. Open the original email link again.</p>
   <template v-else-if="!user">
    <p>Sign in or create an account using the <strong>same email address</strong> that received the invitation. Your email must be verified before you can accept.</p>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem">
     <NuxtLink class="btn" :to="signInPath">Sign in</NuxtLink>
     <NuxtLink class="btn" :to="registerPath">Create account</NuxtLink>
    </div>
   </template>
   <template v-else>
    <p>Signed in as <strong>{{user.email}}</strong>. Make sure this matches the email that received your invitation.</p>
    <button v-if="!success" class="btn" :disabled="busy" @click="accept">{{busy?'Accepting invitation…':'Accept invitation'}}</button>
    <p v-if="error" class="error" role="alert">{{error}}</p>
    <p v-if="success" class="success" role="status">{{success}} <NuxtLink to="/dashboard"><u>Go to dashboard</u></NuxtLink></p>
    <p v-if="error"><NuxtLink :to="signInPath">Sign in with a different account</NuxtLink></p>
   </template>
  </section>
 </div></div>
</template>
