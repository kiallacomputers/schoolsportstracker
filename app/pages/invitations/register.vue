<script setup lang="ts">
const route=useRoute(),db=useSupabaseClient()
const redirect=computed(()=>{
 const v=route.query.redirect
 return typeof v==='string'&&v.startsWith('/invitations/accept?token=')&&!v.includes('\\')?v:'/login'
})
const email=ref(''),password=ref(''),firstName=ref(''),lastName=ref(''),busy=ref(false),error=ref(''),message=ref('')
async function register(){
 error.value='';message.value='';busy.value=true
 try{
  const {data,error:e}=await db.auth.signUp({
   email:email.value.trim(),password:password.value,
   options:{data:{full_name:`${firstName.value.trim()} ${lastName.value.trim()}`},emailRedirectTo:`${window.location.origin}${redirect.value}`}
  })
  if(e)throw e
  if(data.session){await navigateTo(redirect.value);return}
  message.value='Check your email for the verification link. Once verified, sign in and return to your invitation to accept it.'
 }catch(e:any){error.value=e?.message||'Unable to create account'}finally{busy.value=false}
}
</script>
<template><div class="page"><div class="shell admin-section" style="max-width:720px;margin:2rem auto">
 <NuxtLink :to="`/login?redirect=${encodeURIComponent(redirect)}`">← Already have an account? Sign in</NuxtLink>
 <form class="auth" style="max-width:none;margin-top:1.5rem" @submit.prevent="register">
  <h1>Create School Administrator Account</h1>
  <p>Register using the exact email address that received your school invitation. Creating an account does not grant administrator access until you accept the invitation.</p>
  <label class="field"><span>First name</span><input v-model="firstName" required maxlength="100" autocomplete="given-name"></label>
  <label class="field"><span>Last name</span><input v-model="lastName" required maxlength="100" autocomplete="family-name"></label>
  <label class="field"><span>Invited email address</span><input v-model="email" required type="email" autocomplete="email"></label>
  <label class="field"><span>Password (minimum 8 characters)</span><input v-model="password" required type="password" minlength="8" autocomplete="new-password"></label>
  <p v-if="error" class="error" role="alert">{{error}}</p>
  <p v-if="message" class="success" role="status">{{message}} <NuxtLink :to="`/login?redirect=${encodeURIComponent(redirect)}`"><u>Sign in</u></NuxtLink></p>
  <button class="btn" :disabled="busy">{{busy?'Creating account…':'Create account'}}</button>
 </form>
 </div></div></template>
