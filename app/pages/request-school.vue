<script setup lang="ts">
useSeoMeta({title:'Register your school | School Sports Tracker'})
const db=useSupabaseClient()
const schoolName=ref(''),schoolDomain=ref(''),schoolCode=ref(''),contactName=ref(''),position=ref(''),phone=ref(''),notes=ref('')
const email=ref(''),password=ref(''),mode=ref<'register'|'signin'>('register')
const signedInEmail=ref(''),busy=ref(false),error=ref(''),notice=ref(''),submitted=ref(false)
async function refreshUser(){const {data:{user}}=await db.auth.getUser();signedInEmail.value=user?.email||'';if(user?.email&&!schoolDomain.value)schoolDomain.value=user.email.split('@')[1]||''}
onMounted(()=>{void refreshUser()})
async function authenticate(){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{
 const address=email.value.trim().toLowerCase()
 if(mode.value==='register'){if(password.value.length<12)throw new Error('Use a password of at least 12 characters.');const {error:e}=await db.auth.signUp({email:address,password:password.value,options:{emailRedirectTo:window.location.origin+'/request-school'}});if(e)throw e;notice.value='Check your school email to verify your account, then sign in here.'}
 else{const {error:e}=await db.auth.signInWithPassword({email:address,password:password.value});if(e)throw e;await refreshUser();notice.value='Signed in. Complete the school details below.'}
 password.value=''
}catch(e:any){error.value=e?.message||'Unable to authenticate'}finally{busy.value=false}}
async function submit(){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{
 const {data:{user},error:e}=await db.auth.getUser();if(e||!user||!user.email_confirmed_at)throw new Error('Sign in with a verified school email before submitting.')
 const domain=schoolDomain.value.trim().toLowerCase().replace(/^@/,'')
 if(!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)||user.email?.split('@')[1]?.toLowerCase()!==domain)throw new Error('Your school domain must match your verified email.')
 const {error:rpcError}=await db.rpc('submit_school_request',{p_school_name:schoolName.value.trim(),p_school_domain:domain,p_contact_name:contactName.value.trim(),p_contact_position:position.value.trim(),p_contact_phone:phone.value.trim()||null,p_school_code:schoolCode.value.trim()||null,p_notes:notes.value.trim()||null})
 if(rpcError)throw rpcError;submitted.value=true
}catch(e:any){error.value=e?.message||'Unable to submit request'}finally{busy.value=false}}
async function signOut(){await db.auth.signOut();signedInEmail.value='';notice.value=''}
</script>
<template>
<main class="min-h-screen bg-white px-4 py-12 text-[#172b45]">
<div class="mx-auto max-w-2xl">
<NuxtLink to="/" class="text-sm font-semibold text-blue-700">← Back to home</NuxtLink>
<img src="/logo.png" alt="School Sports Tracker" class="mx-auto mt-4 h-28 object-contain"/>
<h1 class="mt-5 text-center text-3xl font-extrabold">Register your school</h1>
<p class="mt-3 text-center text-slate-600">Request access for your school. A platform administrator will review your application.</p>
<section v-if="submitted" role="status" class="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6"><h2 class="text-xl font-bold">Request received</h2><p class="mt-2">Your school request has been submitted for review. Your school is not yet active.</p></section>
<div v-else class="mt-8 space-y-6">
<section class="rounded-2xl border border-slate-200 bg-slate-50 p-6">
<h2 class="text-lg font-bold">1. School email verification</h2>
<div v-if="signedInEmail" class="mt-3 text-sm">Signed in as <strong>{{signedInEmail}}</strong> <button type="button" class="ml-2 text-blue-700 underline" @click="signOut">Sign out</button></div>
<template v-else>
<p class="mt-2 text-sm text-slate-600">Use your school email address. Verify it using the email link before submitting.</p>
<div class="mt-4 flex gap-2"><button type="button" class="rounded-lg border border-blue-700 px-4 py-2" :class="mode==='register'?'bg-blue-700 text-white':'text-blue-700'" @click="mode='register'">Create account</button><button type="button" class="rounded-lg border border-blue-700 px-4 py-2" :class="mode==='signin'?'bg-blue-700 text-white':'text-blue-700'" @click="mode='signin'">Sign in</button></div>
<form class="mt-4 space-y-4" @submit.prevent="authenticate">
<label class="block text-sm font-semibold">School email<input v-model.trim="email" type="email" required autocomplete="email" maxlength="254" class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"/></label>
<label class="block text-sm font-semibold">Password<input v-model="password" type="password" required :minlength="mode==='register'?12:1" :autocomplete="mode==='register'?'new-password':'current-password'" class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"/></label>
<button :disabled="busy" class="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{{busy?'Please wait…':mode==='register'?'Create account':'Sign in'}}</button>
</form></template></section>
<form class="rounded-2xl border border-slate-200 p-6 shadow-sm" @submit.prevent="submit">
<h2 class="text-lg font-bold">2. School and contact details</h2><p class="mt-1 text-sm text-slate-600">Fields marked * are required.</p>
<div class="mt-5 grid gap-4 sm:grid-cols-2">
<label class="sm:col-span-2 text-sm font-semibold">School name *<input v-model.trim="schoolName" required minlength="3" maxlength="150" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="text-sm font-semibold">School email domain *<input v-model.trim="schoolDomain" required placeholder="school.vic.edu.au" maxlength="253" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="text-sm font-semibold">School code (optional)<input v-model.trim="schoolCode" maxlength="30" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="text-sm font-semibold">Contact full name *<input v-model.trim="contactName" required minlength="2" maxlength="150" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="text-sm font-semibold">Position at school *<input v-model.trim="position" required minlength="2" maxlength="120" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="text-sm font-semibold">Phone (optional)<input v-model.trim="phone" type="tel" maxlength="40" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="sm:col-span-2 text-sm font-semibold">Additional information (optional)<textarea v-model.trim="notes" rows="3" maxlength="1000" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
</div>
<p v-if="error" role="alert" class="mt-4 text-sm font-semibold text-red-700">{{error}}</p><p v-if="notice" role="status" class="mt-4 text-sm text-blue-700">{{notice}}</p>
<button :disabled="busy||!signedInEmail" class="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{{busy?'Submitting…':'Submit school registration request'}}</button>
<p v-if="!signedInEmail" class="mt-2 text-center text-xs text-slate-500">Sign in with a verified school email to enable submission.</p>
</form></div></div></main>
</template>