<script setup lang="ts">
const db = useSupabaseClient()
const { admin, verify } = useAdmin()
const loading = ref(true)
const errorMessage = ref('')
const schools = ref<any[]>([])
const competitions = ref<any[]>([])
onMounted(async () => {
  try {
    const { data: { user } } = await db.auth.getUser()
    if (!user) { await navigateTo('/login?redirect=%2Fdashboard', { replace: true }); return }
    if (!await verify()) {
      const { data, error } = await db.from('school_memberships').select('school_id,role').eq('user_id', user.id).limit(20)
      if (error) throw error
      if ((data || []).some(m => m.role === 'school_admin' || m.role === 'teacher')) {
        await navigateTo('/school/dashboard', { replace: true }); return
      }
      await navigateTo('/student', { replace: true }); return
    }
    const [s,c] = await Promise.all([
      db.from('schools').select('id,name,code').order('name'),
      db.from('competitions').select('id,name,status,competition_type').order('created_at', { ascending:false }).limit(8)
    ])
    if (s.error || c.error) throw s.error || c.error
    schools.value = s.data || []; competitions.value = c.data || []
  } catch (e:any) { errorMessage.value = e?.message || 'Unable to load dashboard.' }
  finally { loading.value = false }
})
async function signOut() { await db.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div class="page"><div class="shell">
    <header class="top"><NuxtLink to="/" class="brand"><img src="/logo.png" alt="School Sports Tracker"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink><button class="btn" @click="signOut">Sign Out</button></header>
    <section class="admin-section"><div class="eyebrow">V2 · Platform Administration</div><h1>Sports Dashboard</h1>
      <p v-if="loading">Checking your account…</p><p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <template v-if="!loading && admin">
        <div class="admin-nav"><NuxtLink to="/admin/schools">Manage Schools</NuxtLink><NuxtLink to="/admin/houses">Manage Houses</NuxtLink><NuxtLink to="/admin/students">Manage Students</NuxtLink><NuxtLink to="/admin/student-requests">Student Approvals &amp; Domains</NuxtLink><NuxtLink to="/admin/school-requests">School Requests &amp; Approvals</NuxtLink><NuxtLink to="/admin/email">Email Settings</NuxtLink><NuxtLink to="/admin/staff">Manage Staff</NuxtLink><NuxtLink to="/admin/competitions">Manage Competitions</NuxtLink></div>
        <div class="cards"><div class="card"><h2>Schools ({{ schools.length }})</h2><p v-for="s in schools" :key="s.id">{{ s.name }}</p><p v-if="!schools.length">No schools yet.</p></div><div class="card"><h2>Recent Competitions</h2><p v-for="c in competitions" :key="c.id">{{ c.name }} — {{ c.status }}</p><p v-if="!competitions.length">No competitions yet.</p></div></div>
      </template>
    </section>
  </div></div>
</template>
