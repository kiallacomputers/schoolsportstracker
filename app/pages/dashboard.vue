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
  <div class="space-y-7">
    <UiAppPageHeading :title="isPlatformAdmin ? 'Platform overview' : 'School overview'" :description="isPlatformAdmin ? 'Schools, competitions and activity across the platform.' : schoolName + ' · Competitions, participants and meet operations.'">
      <template #actions><NuxtLink v-if="!isPlatformAdmin && selectedId" :to="schoolLink('competitions')" class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Manage competitions</NuxtLink></template>
    </UiAppPageHeading>
    <p v-if="loading" role="status">Loading dashboard…</p>
    <UiAppPanel v-else-if="errorMessage"><p role="alert" class="text-red-600">{{ errorMessage }}</p></UiAppPanel>
    <template v-else>
      <label v-if="!isPlatformAdmin && schoolOptions.length > 1" class="flex items-center gap-3 text-sm">Viewing school <select v-model="selectedId" class="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2"><option v-for="item in schoolOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard label="Students" :value="isPlatformAdmin ? '—' : counts.students" detail="Enrolled students" symbol="🎓" />
        <DashboardMetricCard label="Competitions" :value="isPlatformAdmin ? recent.length : counts.competitions" detail="Available meets" symbol="🏆" />
        <DashboardMetricCard :label="isPlatformAdmin ? 'Schools' : 'Houses'" :value="isPlatformAdmin ? schools.length : counts.houses" :detail="isPlatformAdmin ? 'Registered schools' : 'School houses'" symbol="🏫" />
        <DashboardMetricCard label="Staff" :value="isPlatformAdmin ? '—' : counts.staff" detail="Assigned members" symbol="👥" />
      </div>
      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <DashboardRecentCompetitions :items="recent" :school-id="selectedId" :platform-admin="isPlatformAdmin" />
        <DashboardQuickActions :platform-admin="isPlatformAdmin" :school-id="selectedId" :admin-links="platformLinks" />
      </div>
    </template>
  </div>
</template>
