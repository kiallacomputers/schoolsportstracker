<script setup lang="ts">
const db = useSupabaseClient()
const { verify } = useAdmin()
const route = useRoute()
const loading = ref(true)
const errorMessage = ref('')
const isPlatformAdmin = ref(false)
const memberships = ref<any[]>([])
const selectedId = ref('')
const mobileOpen = ref(false)
const schools = ref<any[]>([])
const recent = ref<any[]>([])
const counts = ref({ houses: 0, students: 0, staff: 0, competitions: 0 })
const selectedMembership = computed(() => memberships.value.find(m => m.school_id === selectedId.value))
const isSchoolAdmin = computed(() => selectedMembership.value?.role === 'school_admin')
const schoolName = computed(() => selectedMembership.value?.schools?.name || 'School Dashboard')
const schoolOptions = computed(() => memberships.value.map(m => ({ id: m.school_id, name: m.schools?.name || 'School' })))
const schoolLink = (page: string) => `/school/${page}?school=${encodeURIComponent(selectedId.value)}`
const platformLinks = [
  { label: 'Schools', icon: '🏫', to: '/admin/schools' },
  { label: 'School Requests', icon: '📨', to: '/admin/school-requests' },
  { label: 'Students', icon: '🎓', to: '/admin/students' },
  { label: 'Student Approvals', icon: '✓', to: '/admin/student-requests' },
  { label: 'Staff', icon: '👥', to: '/admin/staff' },
  { label: 'Houses', icon: '🏠', to: '/admin/houses' },
  { label: 'Competitions', icon: '🏆', to: '/admin/competitions' },
  { label: 'Email Settings', icon: '✉', to: '/admin/email' }
]
const schoolLinks = computed(() => selectedId.value ? [
  { label: 'Students', icon: '🎓', to: schoolLink('students') },
  { label: 'Staff', icon: '👥', to: schoolLink('staff') },
  { label: 'Houses', icon: '🏠', to: schoolLink('houses') },
  { label: 'Competitions', icon: '🏆', to: schoolLink('competitions') },
  { label: 'Event Registrations', icon: '📝', to: schoolLink('entries') },
  { label: 'Results & House Points', icon: '🥇', to: schoolLink('results') }
] : [])
async function loadSchool() {
  if (!selectedId.value || isPlatformAdmin.value) return
  errorMessage.value = ''
  const id = selectedId.value
  const [h, s, m, organised, participating] = await Promise.all([
    db.from('school_houses').select('id', { count: 'exact', head: true }).eq('school_id', id),
    db.from('students').select('id', { count: 'exact', head: true }).eq('school_id', id),
    db.from('school_memberships').select('user_id', { count: 'exact', head: true }).eq('school_id', id),
    db.from('competitions').select('id,name,status,school_year').eq('organiser_school_id', id).limit(100),
    db.from('competition_schools').select('competition_id,competitions(id,name,status,school_year)').eq('school_id', id).limit(100)
  ])
  const failure = [h,s,m,organised,participating].find(x => x.error)?.error
  if (failure) { errorMessage.value = failure.message; return }
  const all = new Map<string, any>()
  for (const c of organised.data || []) all.set(c.id, c)
  for (const row of participating.data || []) {
    const c: any = row.competitions
    if (c && !Array.isArray(c)) all.set(c.id, c)
  }
  counts.value = { houses: h.count || 0, students: s.count || 0, staff: m.count || 0, competitions: all.size }
  recent.value = [...all.values()].slice(0, 8)
}
onMounted(async () => {
  try {
    const { data: { user } } = await db.auth.getUser()
    if (!user) { await navigateTo('/login?redirect=%2Fdashboard', { replace: true }); return }
    isPlatformAdmin.value = await verify()
    if (isPlatformAdmin.value) {
      const [s,c] = await Promise.all([
        db.from('schools').select('id,name,code').order('name'),
        db.from('competitions').select('id,name,status,competition_type').order('created_at', { ascending: false }).limit(8)
      ])
      if (s.error || c.error) throw s.error || c.error
      schools.value = s.data || []
      recent.value = c.data || []
    } else {
      const { data, error } = await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id', user.id)
      if (error) throw error
      memberships.value = (data || []).filter(m => m.role === 'school_admin' || m.role === 'teacher')
      if (!memberships.value.length) { await navigateTo('/student', { replace: true }); return }
      const requested = typeof route.query.school === 'string' ? route.query.school : ''
      selectedId.value = memberships.value.some(m => m.school_id === requested) ? requested : memberships.value[0].school_id
      await loadSchool()
    }
  } catch (e: any) { errorMessage.value = e?.message || 'Unable to load dashboard.' }
  finally { loading.value = false }
})
watch(selectedId, async (id, previous) => { if (id && previous && id !== previous) await loadSchool() })
async function signOut() { await db.auth.signOut(); await navigateTo('/login') }
</script>

<template>
  <div class="unified-layout">
    <div v-if="mobileOpen" class="mobile-shade" @click="mobileOpen = false"></div>
    <aside class="sidebar" :class="{ 'sidebar-open': mobileOpen }">
      <NuxtLink to="/dashboard" class="sidebar-brand" @click="mobileOpen = false">
        <img src="/logo.png" alt="School Sports Tracker" />
        <span><strong>School Sports Tracker</strong><small>COMPETE · ACHIEVE · INSPIRE</small></span>
      </NuxtLink>
      <div class="role-label">{{ isPlatformAdmin ? 'Platform Administration' : isSchoolAdmin ? 'School Administrator' : 'School Staff' }}</div>
      <nav class="sidebar-nav" aria-label="Dashboard navigation">
        <NuxtLink to="/dashboard" class="nav-item" exact-active-class="nav-active" @click="mobileOpen = false"><span>▦</span> Dashboard</NuxtLink>
        <template v-if="isPlatformAdmin">
          <NuxtLink v-for="item in platformLinks" :key="item.to" :to="item.to" class="nav-item" active-class="nav-active" @click="mobileOpen = false"><span>{{ item.icon }}</span> {{ item.label }}</NuxtLink>
        </template>
        <template v-else>
          <NuxtLink v-for="item in schoolLinks" :key="item.to" :to="item.to" class="nav-item" active-class="nav-active" @click="mobileOpen = false"><span>{{ item.icon }}</span> {{ item.label }}</NuxtLink>
        </template>
      </nav>
      <button class="signout" @click="signOut">Sign Out</button>
    </aside>
    <div class="main-column">
      <header class="dashboard-header"><button class="menu-toggle" aria-label="Open navigation menu" @click="mobileOpen = !mobileOpen">☰</button><strong>{{ isPlatformAdmin ? 'Administration Dashboard' : schoolName }}</strong></header>
      <main class="dashboard-main">
        <div class="eyebrow">{{ isPlatformAdmin ? 'Platform Administration' : 'School Portal' }}</div>
        <h1>{{ isPlatformAdmin ? 'Sports Dashboard' : schoolName }}</h1>
        <p v-if="loading">Checking your account…</p>
        <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
        <template v-if="!loading && !errorMessage">
          <template v-if="isPlatformAdmin">
            <div class="summary-grid"><div class="summary-card"><h2>Schools</h2><strong>{{ schools.length }}</strong></div><div class="summary-card"><h2>Recent Competitions</h2><strong>{{ recent.length }}</strong></div></div>
            <div class="summary-card"><h2>Schools</h2><p v-for="s in schools" :key="s.id">{{ s.name }}</p><p v-if="!schools.length">No schools yet.</p></div>
          </template>
          <template v-else>
            <label v-if="schoolOptions.length > 1" class="school-picker">School <select v-model="selectedId"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{ s.name }}</option></select></label>
            <p class="muted">{{ isSchoolAdmin ? 'School Administrator' : 'School Staff' }} · Showing information for your assigned school.</p>
            <div class="summary-grid"><div class="summary-card"><h2>Houses</h2><strong>{{ counts.houses }}</strong></div><div class="summary-card"><h2>Students</h2><strong>{{ counts.students }}</strong></div><div class="summary-card"><h2>School Members</h2><strong>{{ counts.staff }}</strong></div><div class="summary-card"><h2>Competitions</h2><strong>{{ counts.competitions }}</strong></div></div>
          </template>
          <div class="summary-card"><h2>Recent Competitions</h2><p v-for="c in recent" :key="c.id">{{ c.name }} — {{ c.status }}</p><p v-if="!recent.length">No competitions to display.</p></div>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.unified-layout{display:flex;min-height:100vh;background:#07172c;color:#f4f8ff}
.sidebar{width:260px;flex-shrink:0;background:#0d2342;border-right:1px solid #25486e;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh}
.sidebar-brand{display:flex;gap:12px;align-items:center;padding:22px 16px;color:white;text-decoration:none;border-bottom:1px solid #25486e}
.sidebar-brand img{width:42px;height:42px;object-fit:contain}.sidebar-brand strong{display:block;font-size:14px}.sidebar-brand small{font-size:9px;letter-spacing:1px;color:#afc5e0}
.role-label{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9eb6d5;padding:22px 18px 10px}
.sidebar-nav{display:flex;flex-direction:column;gap:4px;padding:0 10px;overflow-y:auto;flex:1}.nav-item{display:flex;align-items:center;gap:12px;padding:11px 12px;color:#d4e4f9;text-decoration:none;border-radius:8px;font-size:14px}.nav-item span{min-width:20px;text-align:center}.nav-item:hover{background:#173a66}.nav-active{background:#175da5;color:white;font-weight:700}
.signout{margin:12px;background:#142f52;color:white;border:1px solid #355679;padding:12px;border-radius:8px;cursor:pointer}.signout:hover{background:#1c4677}
.main-column{flex:1;min-width:0}.dashboard-header{height:72px;border-bottom:1px solid #25486e;display:flex;align-items:center;gap:14px;padding:0 30px;background:#0a1e38}.dashboard-main{max-width:1300px;padding:36px 32px;margin:auto}.dashboard-main h1{font-size:30px;margin:8px 0 26px}.eyebrow{text-transform:uppercase;letter-spacing:1.6px;color:#81b7f6;font-size:12px}.muted{color:#b3c8e1}.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin:22px 0}.summary-card{background:#102b4c;border:1px solid #2a4b71;border-radius:12px;padding:22px;margin-bottom:16px}.summary-card h2{font-size:15px;color:#c1d8f1;margin:0 0 12px}.summary-card strong{font-size:32px}.summary-card p{margin:8px 0}.school-picker{display:flex;gap:12px;align-items:center}.school-picker select{background:#102b4c;color:white;border:1px solid #4b729b;padding:8px;border-radius:6px}.menu-toggle{display:none;color:white;background:none;border:0;font-size:26px;cursor:pointer}.mobile-shade{display:none}.error{color:#ffaaaa}
@media(max-width:800px){.sidebar{position:fixed;z-index:30;left:0;transform:translateX(-100%);transition:transform .2s}.sidebar-open{transform:translateX(0)}.mobile-shade{display:block;position:fixed;inset:0;background:#0009;z-index:29}.menu-toggle{display:block}.dashboard-main{padding:24px 16px}.dashboard-header{padding:0 16px}}
</style>
