<script setup lang="ts">
const client = useSupabaseClient()
const {admin,verify}=useAdmin()
const schools=ref<any[]>([]), competitions=ref<any[]>([]), loading=ref(true), errorMessage=ref('')
onMounted(async()=>{
  const {data:{user}}=await client.auth.getUser()
  if(!user){await navigateTo('/login');return}
  await verify()
  const [s,c]=await Promise.all([client.from('schools').select('id,name,code').order('name'),client.from('competitions').select('id,name,status,competition_type').order('created_at',{ascending:false}).limit(8)])
  schools.value=s.data||[];competitions.value=c.data||[];errorMessage.value=s.error?.message||c.error?.message||'';loading.value=false
})
async function signOut(){await client.auth.signOut();await navigateTo('/login')}
</script>
<template><div class="page"><div class="shell"><header class="top"><NuxtLink to="/" class="brand"><img src="/logo.png" alt="School Sports Tracker"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink><button class="btn" @click="signOut">Sign Out</button></header><section class="admin-section"><div class="eyebrow">V2 · Administration</div><h1>Sports Dashboard</h1><p v-if="loading">Loading dashboard…</p><p v-if="errorMessage" class="error">{{errorMessage}}</p><template v-if="!loading"><div v-if="admin" class="admin-nav"><NuxtLink to="/admin/schools">Manage Schools</NuxtLink><NuxtLink to="/admin/school-requests">School Requests</NuxtLink><NuxtLink to="/admin/houses">Manage Houses</NuxtLink><NuxtLink to="/admin/students">Manage Students</NuxtLink><NuxtLink to="/admin/student-requests">Student Approvals & Domains</NuxtLink><NuxtLink to="/admin/staff">Manage Staff</NuxtLink><NuxtLink to="/admin/competitions">Manage Competitions</NuxtLink></div><p v-else class="notice">You are signed in, but have not been assigned platform administrator access.</p><div class="cards"><div class="card"><h2>Schools ({{schools.length}})</h2><p v-for="s in schools" :key="s.id">{{s.name}}</p><p v-if="!schools.length">No accessible schools yet.</p></div><div class="card"><h2>Recent Competitions</h2><p v-for="c in competitions" :key="c.id">{{c.name}} — {{c.status}}</p><p v-if="!competitions.length">No competitions yet.</p></div><div class="card"><h2>Phase 2</h2><p>Schools, houses, student records, staff membership and competition setup.</p></div></div></template></section></div></div></template>
