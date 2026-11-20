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
<main class="sst-dashboard">
  <div class="dashboard-heading"><div><p v-if="!isPlatformAdmin" class="eyebrow">SCHOOL WORKSPACE</p><h1>{{ isPlatformAdmin ? 'Sports Dashboard' : 'School Dashboard' }}</h1><p v-if="!isPlatformAdmin" class="subheading">{{ schoolName }} · Your competitions, students and event management in one place</p></div><NuxtLink v-if="!isPlatformAdmin && selectedId" class="action-button" :to="schoolLink('competitions')">Manage Competitions →</NuxtLink></div>
  <p v-if="loading">Loading dashboard…</p><p v-if="errorMessage" class="error" role="alert">{{errorMessage}}</p>
  <template v-if="!loading && !errorMessage">
    <label v-if="!isPlatformAdmin && schoolOptions.length>1" class="school-picker">School <select v-model="selectedId"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
    <div class="metrics">
      <div class="metric"><span class="metric-icon">🎓</span><span>Students</span><strong>{{isPlatformAdmin?'—':counts.students}}</strong><small>School enrolments</small></div>
      <div class="metric"><span class="metric-icon">🏆</span><span>Competitions</span><strong>{{isPlatformAdmin?recent.length:counts.competitions}}</strong><small>Available competitions</small></div>
      <div class="metric"><span class="metric-icon">🏠</span><span>{{isPlatformAdmin?'Schools':'Houses'}}</span><strong>{{isPlatformAdmin?schools.length:counts.houses}}</strong><small>{{isPlatformAdmin?'Registered schools':'School houses'}}</small></div>
      <div class="metric"><span class="metric-icon">👥</span><span>School Staff</span><strong>{{isPlatformAdmin?'—':counts.staff}}</strong><small>Assigned members</small></div>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><div><p class="eyebrow">YOUR WORKSPACE</p><h2>Competitions</h2></div><NuxtLink v-if="!isPlatformAdmin" :to="schoolLink('competitions')">View all →</NuxtLink></div>
        <div v-for="c in recent" :key="c.id" class="competition-row"><span class="competition-symbol">🏊</span><div class="competition-details"><strong>{{c.name}}</strong><small>School year {{c.school_year || '—'}}</small></div><span class="status-pill">{{c.status}}</span><NuxtLink v-if="!isPlatformAdmin" class="row-action" :to="{path:'/school/competitions',query:{school:selectedId,competition:c.id}}">Open →</NuxtLink></div>
        <p v-if="!recent.length" class="empty">No competitions to display yet.</p>
      </section>
      <section class="panel"><div class="panel-head"><div><p class="eyebrow">QUICK ACCESS</p><h2>Manage your school</h2></div></div>
        <template v-if="!isPlatformAdmin"><NuxtLink class="quick-link" :to="schoolLink('competitions')">🏆 <span>Competition Workspace</span> →</NuxtLink><NuxtLink class="quick-link" :to="schoolLink('entries')">📝 <span>Event Registrations</span> →</NuxtLink><NuxtLink class="quick-link" :to="schoolLink('race-day')">🏁 <span>Event Day</span> →</NuxtLink><NuxtLink class="quick-link" :to="schoolLink('mobile-results')">📱 <span>Mobile Results Entry</span> →</NuxtLink></template>
        <template v-else><NuxtLink v-for="link in platformLinks.slice(0,5)" :key="link.to" class="quick-link" :to="link.to">{{link.icon}} <span>{{link.label}}</span> →</NuxtLink></template>
      </section>
    </div>
  </template>
</main>
</template>
<style scoped>
.sst-dashboard{max-width:1480px;margin:auto;color:#edf5ff;padding:4px 0 30px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}/* Sports artwork belongs to the dashboard title banner, not the navigation bar. */
.dashboard-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 27px;min-height:190px;padding:30px 34px;border:1px solid #2b4d75;border-radius:16px;background-image:linear-gradient(90deg,rgba(6,17,37,.97) 0%,rgba(6,17,37,.84) 38%,rgba(6,17,37,.24) 100%),url('/images/sports-embossed-header.webp');background-position:center,center 15%;background-size:cover,cover;background-repeat:no-repeat;overflow:hidden}
.dashboard-heading>div{position:relative;z-index:1}
.dashboard-heading .action-button{position:relative;z-index:1;flex-shrink:0}.eyebrow{font-size:10px;letter-spacing:1.7px;color:#80b7ff;font-weight:750;margin:0 0 10px}.dashboard-heading h1{font-size:clamp(27px,3vw,39px);letter-spacing:-.04em;margin:0 0 8px}.subheading{color:#9eb9d9;margin:0;font-size:14px}.action-button{background:#2774d0;color:white;text-decoration:none;padding:13px 18px;border-radius:10px;font-size:13px;font-weight:750}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:25px 0}.metric{background:linear-gradient(150deg,#142f53,#102642);border:1px solid #2b4d75;border-radius:16px;padding:21px;display:flex;flex-direction:column;gap:7px}.metric-icon{font-size:21px;margin-bottom:7px}.metric>span:not(.metric-icon){font-size:13px;color:#b7cce6}.metric strong{font-size:35px;line-height:1.15}.metric small{font-size:11px;color:#87a6c8}.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,1fr);gap:18px}.panel{background:#102641;border:1px solid #2b4b70;border-radius:17px;padding:24px}.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.panel-head h2{font-size:20px;margin:0}.panel-head a{color:#9ec8ff;text-decoration:none;font-size:13px}.competition-row{display:flex;align-items:center;gap:13px;padding:17px 0;border-top:1px solid #2a4767;flex-wrap:wrap}.competition-symbol{display:grid;place-items:center;width:42px;height:42px;background:#1b3c65;border-radius:12px;font-size:20px}.competition-details{display:flex;flex-direction:column;gap:6px;flex:1;min-width:160px}.competition-details strong{font-size:14px}.competition-details small{color:#94b1d2;font-size:12px}.status-pill{background:#1d4966;color:#b9e5f3;border-radius:99px;padding:6px 10px;text-transform:capitalize;font-size:11px}.row-action{color:#c7e1ff;text-decoration:none;font-size:13px}.quick-link{display:flex;align-items:center;gap:12px;text-decoration:none;color:#e6f1ff;border:1px solid #29496e;background:#173453;border-radius:11px;padding:16px;margin:10px 0;font-size:14px}.quick-link span{flex:1}.quick-link:hover{background:#215081}.empty{color:#a9c1dc}.school-picker{display:flex;align-items:center;gap:12px;margin-bottom:14px;color:#b8cce5}.school-picker select{background:#163658;color:white;border:1px solid #46688d;padding:9px;border-radius:9px}.error{color:#ffb5b5}
@media(max-width:1000px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-grid{grid-template-columns:1fr}}@media(max-width:600px){.dashboard-heading{align-items:flex-start;flex-direction:column;min-height:165px;padding:24px 20px;background-position:center,center 15%}.metrics{gap:9px}.metric{padding:15px}.metric strong{font-size:28px}.panel{padding:16px}}
</style>
