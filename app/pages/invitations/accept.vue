<script setup lang="ts">
const route=useRoute()
const db=useSupabaseClient()
const user=useSupabaseUser()
const token=computed(()=>typeof route.query.token==='string'?route.query.token:'')
const busy=ref(false),error=ref(''),success=ref('')
async function accept(){
 error.value='';success.value='';busy.value=true
 try {
  if(!user.value) throw new Error('Sign in with the invited email address first, then return to this link.')
  const {data,error:e}=await db.rpc('accept_school_admin_invitation',{p_token:token.value})
  if(e)throw e
  success.value='Invitation accepted. Your school administrator access is now active.'
 }catch(e:any){error.value=e?.message||'Unable to accept invitation'}finally{busy.value=false}
}
</script>
<template><div class="page"><div class="shell"><h1>School Administrator Invitation</h1><p>Sign in with the email address that received this invitation. Your email must be verified.</p><p v-if="!user"><NuxtLink :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`">Sign in</NuxtLink> or register using your invited email address, then return to this link.</p><button v-if="user && token && !success" class="btn" :disabled="busy" @click="accept">{{busy?'Accepting…':'Accept invitation'}}</button><p v-if="!token" class="error">Missing invitation token.</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="success" class="success" role="status">{{success}} <NuxtLink to="/dashboard">Go to dashboard</NuxtLink></p></div></div></template>
