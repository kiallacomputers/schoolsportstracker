<script setup lang="ts">
const db=useSupabaseClient()
const email=ref('')
onMounted(async()=>{const {data:{user}}=await db.auth.getUser();email.value=user?.email||''})
async function signOut(){await db.auth.signOut();await navigateTo('/login')}
</script>
<template>
 <main class="grid min-h-screen place-items-center bg-slate-50 px-4">
  <section class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
   <h1 class="text-2xl font-bold text-slate-900">Account awaiting school access</h1>
   <p class="mt-3 text-slate-600">You're signed in<span v-if="email"> as <strong>{{email}}</strong></span>, but your account hasn't been assigned to a school yet.</p>
   <p class="mt-3 text-slate-600">Ask your Platform Administrator to assign you a School Administrator or Teacher role. Once assigned, sign out and sign back in to open your school dashboard.</p>
   <div class="mt-6 flex gap-3"><button type="button" class="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white" @click="signOut">Sign out</button><NuxtLink to="/dashboard" class="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Retry dashboard</NuxtLink></div>
  </section>
 </main>
</template>