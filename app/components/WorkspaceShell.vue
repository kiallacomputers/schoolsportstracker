<script setup lang="ts">
const db = useSupabaseClient()
const { verify } = useAdmin()
const route = useRoute()
const platformAdmin = ref(false)
const memberships = ref<any[]>([])
const activeSchool = ref('')
const mobileOpen = ref(false)
const desktopCollapsed = ref(false)
const ready = ref(false)
const studentFlyoutOpen = ref(false)
const studentMenuAnchor = ref<HTMLElement | null>(null)
function closeFlyoutOnOutsideClick(event: PointerEvent) {
  if (!studentFlyoutOpen.value) return
  const target = event.target
  if (target instanceof Node && !studentMenuAnchor.value?.contains(target)) {
    studentFlyoutOpen.value = false
  }
}
onMounted(() => document.addEventListener('pointerdown', closeFlyoutOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeFlyoutOnOutsideClick))
const studentMenuEnabled = computed(() => !platformAdmin.value && !!activeSchool.value && memberships.value.some(m => m.school_id === activeSchool.value && m.role === 'school_admin'))
const studentPage = computed(() => '/school/students?school=' + encodeURIComponent(activeSchool.value))
function openStudentAdd() {
  if (!studentMenuEnabled.value) return
  studentFlyoutOpen.value = false
  mobileOpen.value = false
  navigateTo({ path: '/school/students', query: { school: activeSchool.value, action: 'add' } })
}
const roleLabel = computed(() => platformAdmin.value ? 'Platform Administration' : memberships.value.find(m => m.school_id === activeSchool.value)?.role === 'school_admin' ? 'School Administrator' : 'School Staff')
const schoolName = computed(() => memberships.value.find(m => m.school_id === activeSchool.value)?.schools?.name || 'School Sports Tracker')
const schoolOptions = computed(() => memberships.value.map(m => ({ id:m.school_id, name:m.schools?.name || 'School' })))
const links = computed(() => {
  if (platformAdmin.value) return [
    {label:'Schools',to:'/admin/schools',icon:'🏫'},
    {label:'School Requests',to:'/admin/school-requests',icon:'📨'},
    {label:'Students',to:'/admin/students',icon:'🎓'},
    {label:'Student Approvals',to:'/admin/student-requests',icon:'✓'},
    {label:'Staff',to:'/admin/staff',icon:'👥'},
    {label:'Houses',to:'/admin/houses',icon:'🏠'},
    {label:'Competitions',to:'/admin/competitions',icon:'🏆'},
    {label:'Email Settings',to:'/admin/email',icon:'✉'},
    ...(typeof route.query.school === 'string' && route.query.school ? [{label:'Year Rollover',to:'/school/rollover?school='+encodeURIComponent(route.query.school),icon:'📅'}] : [])
  ]
  if (!activeSchool.value) return []
  const suffix = '?school=' + encodeURIComponent(activeSchool.value)
  return [
    {label:'Students',to:'/school/students'+suffix,icon:'🎓'},
    ...(memberships.value.find(m=>m.school_id===activeSchool.value)?.role === 'school_admin' ? [{label:'Year Rollover',to:'/school/rollover'+suffix,icon:'📅'}] : []),
    {label:'Staff',to:'/school/staff'+suffix,icon:'👥'},
    {label:'Houses',to:'/school/houses'+suffix,icon:'🏠'},
    {label:'Competitions',to:'/school/competitions'+suffix,icon:'🏆'},
    {label:'Event Registrations',to:'/school/entries'+suffix,icon:'📝'},
    {label:'Results & House Points',to:'/school/results'+suffix,icon:'🥇'}
  ]
})
async function checkAccess() {
  ready.value = false
  try {
    const {data:{user}} = await db.auth.getUser()
    if (!user) { await navigateTo('/login'); return }
    platformAdmin.value = await verify()
    if (!platformAdmin.value) {
      const {data,error} = await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id)
      if (error) throw error
      memberships.value = (data || []).filter((m:any)=>m.role === 'school_admin' || m.role === 'teacher')
      const requested = typeof route.query.school === 'string' ? route.query.school : ''
      const previous = activeSchool.value
      activeSchool.value = memberships.value.some(m=>m.school_id===requested) ? requested : memberships.value.some(m=>m.school_id===previous) ? previous : (memberships.value[0]?.school_id || '')
      if (!activeSchool.value) { await navigateTo('/student'); return }
    }
  } catch (err) { console.error('Unable to load navigation permissions',err) }
  finally { ready.value = true }
}
onMounted(checkAccess)
watch(() => route.query.school, (id) => {
  if (typeof id === 'string' && memberships.value.some(m=>m.school_id === id)) activeSchool.value = id
})
watch(() => route.path, () => { mobileOpen.value = false; studentFlyoutOpen.value = false })
watch(activeSchool, async (id,old) => {
  studentFlyoutOpen.value = false
  if (!id || !old || id===old || platformAdmin.value) return
  const path = route.path
  if (path.startsWith('/school/')) await navigateTo({path,query:{...route.query,school:id}})
  else if (path === '/dashboard') await navigateTo({path:'/dashboard',query:{...route.query,school:id}})
})
function selected(to:string) { return route.path === to.split('?')[0] }
async function signOut(){ await db.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div class="workspace">
    <div v-if="mobileOpen" class="shade" @click="mobileOpen=false"></div>
    <aside class="side" :class="{'open':mobileOpen, 'collapsed':desktopCollapsed}">
      <NuxtLink class="brand" to="/dashboard" @click="mobileOpen=false">
        <img :src="'/images/school-sports-tracker-logo.png'" alt="School Sports Tracker" />
        <span><strong>School Sports Tracker</strong><small>COMPETE · ACHIEVE · INSPIRE</small></span>
      </NuxtLink>
      <div class="role">{{ roleLabel }}</div>
      <label v-if="!platformAdmin && schoolOptions.length>1" class="school-select">School
        <select v-model="activeSchool"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{ s.name }}</option></select>
      </label>
      <nav class="nav" aria-label="Administration navigation">
        <NuxtLink :to="platformAdmin ? '/dashboard' : '/dashboard?school='+encodeURIComponent(activeSchool)" class="item" :class="{'current':route.path==='/dashboard'}" @click="mobileOpen=false"><span>▦</span> Dashboard</NuxtLink>
        <template v-for="item in links" :key="item.to">
          <div v-if="item.label === 'Students' && studentMenuEnabled" class="student-menu-anchor" ref="studentMenuAnchor">
            <button type="button" class="item student-menu-trigger" :class="{'current':route.path==='/school/students'}" :aria-expanded="studentFlyoutOpen" aria-controls="student-flyout" @click="studentFlyoutOpen=!studentFlyoutOpen">
              <span>{{item.icon}}</span> Students <span class="menu-chevron">{{studentFlyoutOpen ? '‹' : '›'}}</span>
            </button>
            <div v-if="studentFlyoutOpen" id="student-flyout" class="student-flyout" aria-label="Student actions">
              <div class="flyout-heading">Students</div>
              <NuxtLink :to="studentPage" class="flyout-item" @click="studentFlyoutOpen=false;mobileOpen=false">View Students</NuxtLink>
              <button type="button" class="flyout-item" @click="openStudentAdd">Add Student</button>
            </div>
          </div>
          <NuxtLink v-else :to="item.to" class="item" :class="{'current':selected(item.to)}" @click="mobileOpen=false;studentFlyoutOpen=false"><span>{{item.icon}}</span>{{item.label}}</NuxtLink>
        </template>
      </nav>
      <button class="logout" type="button" @click="signOut">Sign Out</button>
    </aside>
    <div class="content">
      <header class="top"><button class="toggle" type="button" aria-label="Toggle navigation" @click="mobileOpen=!mobileOpen; desktopCollapsed=!desktopCollapsed">☰</button><strong>{{ platformAdmin ? 'Platform Administration' : schoolName }}</strong></header>
      <main class="page"><slot /></main>
    </div>
  </div>
</template>
<style scoped>
.workspace{display:flex;min-height:100vh;background:#07172c;color:#f4f8ff}
.side{position:sticky;top:0;width:260px;min-width:260px;height:100vh;background:#0d2342;border-right:1px solid #25486e;display:flex;flex-direction:column;z-index:30}
.brand{display:flex;align-items:center;gap:12px;padding:18px 12px;border-bottom:1px solid #25486e;color:white;text-decoration:none}.brand img{height:45px;width:45px;object-fit:contain}.brand strong{display:block;font-size:14px}.brand small{display:block;font-size:9px;color:#afc5e0;letter-spacing:.7px}
.role{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9eb6d5;padding:20px 18px 10px}
.school-select{padding:0 14px 12px;color:#c7d9ef;font-size:12px}.school-select select{display:block;width:100%;margin-top:5px;background:#102b4c;color:white;border:1px solid #4b729b;border-radius:6px;padding:8px}
.nav{display:flex;flex-direction:column;gap:4px;padding:0 10px;overflow-y:auto;flex:1}.item{display:flex;align-items:center;gap:12px;padding:11px 12px;color:#d4e4f9;text-decoration:none;border-radius:8px;font-size:14px}.item span{min-width:22px;text-align:center}.item:hover{background:#173a66}.current{background:#175da5;color:white;font-weight:700}
.student-menu-anchor{position:relative}.student-menu-trigger{width:100%;background:transparent;border:0;text-align:left;font-family:inherit;cursor:pointer}.menu-chevron{margin-left:auto!important;min-width:12px!important}.student-flyout{position:fixed;top:146px;left:260px;width:224px;background:#102b4c;border:1px solid #355c84;border-radius:0 12px 12px 0;box-shadow:0 14px 35px #0008;padding:12px;z-index:70}.flyout-heading{color:#a9c9ed;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:4px 8px 10px}.flyout-item{display:block;width:100%;padding:12px 10px;border:0;border-radius:7px;text-align:left;background:transparent;color:white;font:inherit;font-size:14px;text-decoration:none;cursor:pointer}.flyout-item:hover,.flyout-item:focus-visible{background:#175da5}.logout{margin:12px;padding:12px;background:#142f52;color:white;border:1px solid #355679;border-radius:8px;cursor:pointer}
.content{flex:1;min-width:0}.top{min-height:70px;display:flex;align-items:center;gap:14px;padding:0 26px;background:#0a1e38;border-bottom:1px solid #25486e}.page{padding:24px 28px;max-width:100%;overflow-x:auto}
.toggle{display:block;background:none;border:0;color:white;font-size:26px;cursor:pointer}.shade{display:none}
@media(min-width:801px){.side.collapsed .student-flyout{display:none}.side.collapsed{width:0;min-width:0;overflow:hidden;border-right:0}.content{min-width:0}}
@media(max-width:800px){.student-flyout{position:static;width:auto;margin:4px 0 8px 12px;border-radius:9px}.side.collapsed{width:260px;min-width:260px;overflow:visible}.side{position:fixed;left:0;transform:translateX(-100%);transition:transform .2s}.side.open{transform:translateX(0)}.shade{display:block;position:fixed;inset:0;background:#0009;z-index:29}.toggle{display:block}.top{padding:0 16px}.page{padding:18px 12px}}
</style>
