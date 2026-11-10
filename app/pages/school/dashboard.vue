<script setup lang="ts">
const db = useSupabaseClient()
const loading = ref(true), errorMessage = ref('')
const memberships = ref<any[]>([])
const selectedId = ref('')
const schoolName = ref('')
const counts = ref({ houses:0, students:0, staff:0, competitions:0 })
const recent = ref<any[]>([])
const isAdmin = computed(() => memberships.value.some(m => m.school_id === selectedId.value && m.role === 'school_admin'))
const schools = computed(() => memberships.value.map(m => ({ id:m.school_id, name:m.schools?.name || 'School', role:m.role })))
async function loadSchool() {
  errorMessage.value = ''; schoolName.value = schools.value.find(s => s.id === selectedId.value)?.name || ''
  if (!selectedId.value) return
  const id = selectedId.value
  const [h, s, m, organised, participating] = await Promise.all([
    db.from('school_houses').select('id', { count:'exact', head:true }).eq('school_id',id),
    db.from('students').select('id', { count:'exact', head:true }).eq('school_id',id),
    db.from('school_memberships').select('user_id', { count:'exact', head:true }).eq('school_id',id),
    db.from('competitions').select('id,name,status,school_year').eq('organiser_school_id',id).limit(100),
    db.from('competition_schools').select('competition_id,competitions(id,name,status,school_year)').eq('school_id',id).limit(100)
  ])
  const failure = [h,s,m,organised,participating].find(x => x.error)?.error
  if (failure) { errorMessage.value = failure.message; return }
  const map = new Map<string,any>()
  for (const c of organised.data || []) map.set(c.id,c)
  for (const row of participating.data || []) {
    const c:any = row.competitions
    if (c && !Array.isArray(c)) map.set(c.id,c)
  }
  counts.value = { houses:h.count || 0, students:s.count || 0, staff:m.count || 0, competitions:map.size }
  recent.value = [...map.values()].slice(0,8)
}
onMounted(async () => {
  try {
    const { data:{user} } = await db.auth.getUser()
    if (!user) { await navigateTo('/login?redirect=%2Fschool%2Fdashboard',{replace:true}); return }
    const { data, error } = await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id)
    if (error) throw error
    memberships.value = (data || []).filter(m => m.role === 'school_admin' || m.role === 'teacher')
    if (!memberships.value.length) {
      const { data:platform } = await db.rpc('is_platform_admin')
      if (platform === true) { await navigateTo('/dashboard',{replace:true}); return }
      errorMessage.value = 'No school staff membership has been assigned to this account.'
    } else { selectedId.value = memberships.value[0].school_id; await loadSchool() }
  } catch (e:any) { errorMessage.value = e?.message || 'Unable to load your school.' }
  finally { loading.value = false }
})
watch(selectedId, async (id,old) => { if (id && old && id !== old) await loadSchool() })
async function signOut() { await db.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div class="page"><div class="shell"><header class="top"><NuxtLink class="brand" to="/"><img src="/logo.png" alt="School Sports Tracker"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink><button class="btn" @click="signOut">Sign Out</button></header>
    <section class="admin-section"><div class="eyebrow">School Portal</div><h1>{{ schoolName || 'School Dashboard' }}</h1>
      <p v-if="loading">Loading your school…</p><p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <template v-if="!loading && memberships.length">
        <label v-if="schools.length > 1" class="field"><span>School</span><select v-model="selectedId"><option v-for="s in schools" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
        <p class="notice">{{ isAdmin ? 'School Administrator' : 'School Staff' }} · Only information for your assigned school is shown.</p>
        <div class="cards"><div class="card"><h2>Houses</h2><p>{{counts.houses}} houses</p></div><div class="card"><h2>Students</h2><p>{{counts.students}} student records</p></div><div class="card"><h2>School Members</h2><p>{{counts.staff}} staff and administrator accounts</p></div><div class="card"><h2>Competitions</h2><p>{{counts.competitions}} associated competitions</p></div></div>
        <div class="admin-nav" style="margin-top:1.5rem"><NuxtLink :to="`/school/houses?school=${selectedId}`">{{isAdmin?'Manage':'View'}} Houses</NuxtLink><NuxtLink :to="`/school/students?school=${selectedId}`">View Students</NuxtLink><NuxtLink :to="`/school/staff?school=${selectedId}`">View School Staff</NuxtLink><NuxtLink :to="`/school/competitions?school=${selectedId}`">View Competitions</NuxtLink></div>
        <div class="card" style="margin-top:1.5rem"><h2>School Competitions</h2><p v-for="c in recent" :key="c.id">{{c.name}} — {{c.status}}</p><p v-if="!recent.length">No competitions associated with this school yet.</p></div>
        <p class="notice">Staff invitations, staff approvals and school competition editing are planned for a later phase. Platform-wide administration is restricted to SuperAdmins.</p>
      </template>
    </section>
  </div></div>
</template>
