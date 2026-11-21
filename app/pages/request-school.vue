<script setup lang="ts">
useSeoMeta({title:'Request a school | School Sports Tracker'})
const schoolName=ref(''),contactName=ref(''),email=ref(''),position=ref(''),phone=ref(''),schoolCode=ref(''),notes=ref(''),website=ref('')
const busy=ref(false),error=ref(''),done=ref(false)
const domain=computed(()=>email.value.trim().toLowerCase().split('@')[1]||'')
async function submit(){if(busy.value)return;busy.value=true;error.value='';try{
 await $fetch('/api/schools/request',{method:'POST',body:{schoolName:schoolName.value,contactName:contactName.value,email:email.value,position:position.value,phone:phone.value,schoolCode:schoolCode.value,notes:notes.value,website:website.value}})
 done.value=true
}catch(e:any){error.value=e?.data?.statusMessage||e?.data?.message||e?.message||'Unable to submit request'}finally{busy.value=false}}
</script>
<template>
<main class="min-h-screen bg-white px-4 py-12 text-[#172b45]"><div class="mx-auto max-w-2xl">
<NuxtLink to="/" class="text-sm font-semibold text-blue-700">← Back to home</NuxtLink>
<img src="/logo.png" alt="School Sports Tracker" class="mx-auto mt-4 h-28 object-contain"/>
<h1 class="mt-5 text-center text-3xl font-extrabold">Request your school</h1>
<p class="mt-3 text-center text-slate-600">Tell us about your school and nominate its first administrator. No account is needed to request access.</p>
<section v-if="done" role="status" class="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6"><h2 class="text-xl font-bold">Request received</h2><p class="mt-2">Your request has been submitted for review. If approved, the nominated contact will receive a School Administrator invitation by email.</p></section>
<form v-else class="mt-8 space-y-5 rounded-2xl border border-slate-200 p-6 shadow-sm sm:p-8" @submit.prevent="submit">
<h2 class="text-lg font-bold">School details</h2>
<label class="block text-sm font-semibold">School name *<input v-model.trim="schoolName" required minlength="3" maxlength="150" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="block text-sm font-semibold">School code (optional)<input v-model.trim="schoolCode" maxlength="30" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<h2 class="pt-3 text-lg font-bold">Nominated School Administrator</h2>
<div class="grid gap-4 sm:grid-cols-2">
<label class="text-sm font-semibold">Full name *<input v-model.trim="contactName" required minlength="2" maxlength="150" autocomplete="name" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="text-sm font-semibold">Position *<input v-model.trim="position" required minlength="2" maxlength="120" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="sm:col-span-2 text-sm font-semibold">School email *<input v-model.trim="email" required type="email" maxlength="254" autocomplete="email" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<label class="sm:col-span-2 text-sm font-semibold">Phone (optional)<input v-model.trim="phone" type="tel" maxlength="40" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
</div>
<p v-if="domain" class="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Proposed school email domain: <strong>{{domain}}</strong>. Your School Administrator can request additional domains later.</p>
<label class="block text-sm font-semibold">Additional information (optional)<textarea v-model.trim="notes" maxlength="1000" rows="3" class="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
<div class="absolute -left-[10000px]" aria-hidden="true"><label>Website<input v-model="website" type="text" tabindex="-1" autocomplete="off"/></label></div>
<p v-if="error" role="alert" class="text-sm font-semibold text-red-700">{{error}}</p>
<button :disabled="busy" class="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{{busy?'Submitting…':'Submit school request'}}</button>
<p class="text-center text-xs text-slate-500">Submitting a request does not create an account or activate a school.</p>
</form></div></main>
</template>