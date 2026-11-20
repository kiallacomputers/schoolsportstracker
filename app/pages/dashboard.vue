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
<main class="v3-dashboard">
  <V3PageHeader :title="isPlatformAdmin ? 'Overview' : 'School overview'" :description="isPlatformAdmin ? 'Monitor schools, competitions and activity across the platform.' : schoolName + ' · Competitions, participants and meet operations.'" eyebrow="WORKSPACE">
    <template #actions><NuxtLink v-if="!isPlatformAdmin && selectedId" class="primary-action" :to="schoolLink('competitions')">Manage competitions <span aria-hidden="true">→</span></NuxtLink></template>
  </V3PageHeader>
  <p v-if="loading" class="feedback" role="status">Loading dashboard…</p>
  <p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
  <template v-if="!loading && !errorMessage">
    <label v-if="!isPlatformAdmin && schoolOptions.length > 1" class="school-picker">Viewing school <select v-model="selectedId"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
    <div class="metrics">
      <div class="metric"><span class="metric-top"><span>Students</span><span class="metric-icon">🎓</span></span><strong>{{isPlatformAdmin?'—':counts.students}}</strong><small>Enrolled students</small></div>
      <div class="metric"><span class="metric-top"><span>Competitions</span><span class="metric-icon">🏆</span></span><strong>{{isPlatformAdmin?recent.length:counts.competitions}}</strong><small>Available meets</small></div>
      <div class="metric"><span class="metric-top"><span>{{isPlatformAdmin?'Schools':'Houses'}}</span><span class="metric-icon">🏫</span></span><strong>{{isPlatformAdmin?schools.length:counts.houses}}</strong><small>{{isPlatformAdmin?'Registered schools':'School houses'}}</small></div>
      <div class="metric"><span class="metric-top"><span>Staff</span><span class="metric-icon">👥</span></span><strong>{{isPlatformAdmin?'—':counts.staff}}</strong><small>Assigned members</small></div>
    </div>
    <div class="dashboard-grid">
      <V3Panel title="Recent competitions" description="Your latest meets and competition activity">
        <template #actions><NuxtLink v-if="!isPlatformAdmin" class="text-action" :to="schoolLink('competitions')">View all →</NuxtLink></template>
        <div class="competition-table">
          <div class="table-header"><span>Competition</span><span>Year</span><span>Status</span><span></span></div>
          <div v-for="c in recent" :key="c.id" class="competition-row">
            <span class="competition-name"><span class="competition-symbol">🏅</span><strong>{{c.name}}</strong></span>
            <span class="table-muted">{{c.school_year || '—'}}</span>
            <span><span class="status-pill">{{c.status || 'Unknown'}}</span></span>
            <NuxtLink v-if="!isPlatformAdmin" class="text-action" :to="{path:'/school/competitions',query:{school:selectedId,competition:c.id}}">Open →</NuxtLink><span v-else></span>
          </div>
          <p v-if="!recent.length" class="empty">No competitions to display yet.</p>
        </div>
      </V3Panel>
      <V3Panel title="Quick actions" description="Jump straight into your everyday tasks">
        <div class="quick-actions">
          <template v-if="!isPlatformAdmin">
            <NuxtLink class="quick-link" :to="schoolLink('competitions')"><span>🏆</span> Competition workspace <span class="arrow">→</span></NuxtLink>
            <NuxtLink class="quick-link" :to="schoolLink('entries')"><span>📝</span> Event registrations <span class="arrow">→</span></NuxtLink>
            <NuxtLink class="quick-link" :to="schoolLink('race-day')"><span>🏁</span> Event day <span class="arrow">→</span></NuxtLink>
            <NuxtLink class="quick-link" :to="schoolLink('mobile-results')"><span>📱</span> Mobile result entry <span class="arrow">→</span></NuxtLink>
          </template>
          <template v-else><NuxtLink v-for="link in platformLinks.slice(0,6)" :key="link.to" class="quick-link" :to="link.to"><span>{{link.icon}}</span>{{link.label}}<span class="arrow">→</span></NuxtLink></template>
        </div>
      </V3Panel>
    </div>
  </template>
</main>
</template>
<style scoped>
.v3-dashboard{display:grid;gap:22px;max-width:1500px;margin:0 auto;color:var(--v3-text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.primary-action{display:inline-flex;align-items:center;gap:12px;background:#246bb8;color:#fff;text-decoration:none;padding:12px 17px;border-radius:10px;font-size:13px;font-weight:750;white-space:nowrap}.primary-action:hover{background:#175496}
.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.metric{background:var(--v3-surface);border:1px solid var(--v3-border);border-radius:15px;padding:22px;display:flex;flex-direction:column;gap:11px;box-shadow:var(--v3-shadow)}.metric-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;color:var(--v3-muted);font-weight:650}.metric-icon{display:grid;place-items:center;width:36px;height:36px;background:var(--v3-surface-alt);border-radius:10px;font-size:19px}.metric strong{font-size:34px;letter-spacing:-.04em;line-height:1.1}.metric small{font-size:12px;color:var(--v3-muted)}.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,1fr);gap:18px}.competition-table{overflow-x:auto}.table-header,.competition-row{display:grid;grid-template-columns:minmax(190px,1fr) 75px 105px 60px;gap:12px;align-items:center;min-width:460px;padding:13px 0}.table-header{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--v3-muted);font-weight:800;border-bottom:1px solid var(--v3-border)}.competition-row{border-bottom:1px solid var(--v3-border);font-size:13px}.competition-row:last-child{border-bottom:0}.competition-name{display:flex;align-items:center;gap:11px;min-width:0}.competition-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.competition-symbol{display:grid;place-items:center;width:34px;height:34px;background:var(--v3-surface-alt);border-radius:9px;flex-shrink:0}.table-muted,.empty{color:var(--v3-muted)}.status-pill{display:inline-flex;background:var(--v3-surface-alt);border:1px solid var(--v3-border);color:var(--v3-text);border-radius:99px;padding:5px 9px;text-transform:capitalize;font-size:11px}.text-action{color:var(--v3-accent);text-decoration:none;font-size:12px;font-weight:750}.quick-actions{display:grid;gap:9px}.quick-link{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--v3-border);border-radius:10px;color:var(--v3-text);text-decoration:none;font-size:13px;font-weight:600}.quick-link:hover{background:var(--v3-surface-alt)}.arrow{margin-left:auto;color:var(--v3-accent)}.school-picker{display:flex;align-items:center;gap:10px;color:var(--v3-muted);font-size:13px}.school-picker select{border:1px solid var(--v3-border);background:var(--v3-surface);color:var(--v3-text);padding:9px;border-radius:9px}.feedback{padding:14px;color:var(--v3-muted)}.error{color:#c94b4b}
@media(max-width:1050px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-grid{grid-template-columns:1fr}}@media(max-width:540px){.metrics{gap:10px}.metric{padding:15px}.metric strong{font-size:28px}}
</style>
