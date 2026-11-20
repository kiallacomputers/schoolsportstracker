<script setup lang="ts">
const db = useSupabaseClient()
const { themePreference, resolvedTheme, setTheme } = useWorkspaceTheme()
const { verify } = useAdmin()
const route = useRoute()
const platformAdmin = ref(false)
const memberships = ref<any[]>([])
const allSchools = ref<any[]>([])
const activeSchool = ref('')
const mobileOpen = ref(false)
const desktopCollapsed = ref(false)
const ready = ref(false)
const openFlyout = ref<string | null>(null)
const flyoutTop = ref(100)
const canManageSchool = computed(() => !!activeSchool.value && (platformAdmin.value || memberships.value.some(m => m.school_id === activeSchool.value && m.role === 'school_admin')))
const canAssign = computed(() => !!activeSchool.value && (platformAdmin.value || memberships.value.some(m => m.school_id === activeSchool.value && ['school_admin','teacher'].includes(m.role))))
const submenuItems = computed(() => ({
  Students: [{label:'View Students',action:'view'}, ...(canManageSchool.value?[{label:'Add Student',action:'add'},{label:'Import Students',action:'import'}]:[])],
  Staff: [{label:'View Staff',action:'view'}, ...(canManageSchool.value?[{label:'Assign Staff',action:'assign'},{label:'Invite Staff',action:'invite'}]:[])],
  Houses: [{label:'View Houses',action:'view'}, ...(canManageSchool.value?[{label:'Add House',action:'add'}]:[])],
  Competitions: [{label:'View Competitions',action:'view'}, {label:'Event Day',action:'eventday'}, ...(canManageSchool.value?[{label:'Add Competition',action:'add'},{label:'Add Event',action:'event'}]:[])],
  'Event Registrations': [{label:'View Registrations',action:'view'}, ...(canAssign.value?[{label:'Assign Student',action:'add'}]:[])],
  'Results & House Points': [{label:'View Results',action:'view'}, {label:'Mobile Result Entry',action:'mobile'}, ...(canAssign.value?[{label:'Enter Result',action:'add'}]:[])]
}))
const flyoutSections = ['Students','Staff','Houses','Competitions','Event Registrations','Results & House Points']
function toggleFlyout(label:string,event:MouseEvent){
  if(openFlyout.value===label){openFlyout.value=null;return}
  const el=event.currentTarget as HTMLElement
  flyoutTop.value=Math.max(12,Math.min(el.getBoundingClientRect().top,window.innerHeight-240))
  openFlyout.value=label
}
function outsideClick(event:PointerEvent){
  if(!openFlyout.value)return
  const target=event.target
  if(target instanceof Element && !target.closest('.student-menu-anchor'))openFlyout.value=null
}
onMounted(()=>document.addEventListener('pointerdown',outsideClick))
onBeforeUnmount(()=>document.removeEventListener('pointerdown',outsideClick))
async function chooseFlyout(item:any,action:string){
  openFlyout.value=null;mobileOpen.value=false
  const path=item.to.split('?')[0]
  if(action==='view'){await navigateTo(item.to);return}
  if(action==='eventday'){await navigateTo({path:'/school/race-day',query:{school:activeSchool.value}});return}
  if(action==='mobile'){await navigateTo({path:'/school/mobile-results',query:{school:activeSchool.value}});return}
  if(!activeSchool.value){
    // A platform administrator must select a school before creating school-scoped records.
    await navigateTo(item.to)
    return
  }
  const schoolPages: Record<string,string> = {
    Students:'/school/students', Staff:'/school/staff', Houses:'/school/houses',
    Competitions:'/school/competitions', 'Event Registrations':'/school/entries',
    'Results & House Points':'/school/results'
  }
  await navigateTo({path:schoolPages[item.label] || path,query:{school:activeSchool.value,action}})
}
const roleLabel = computed(() => platformAdmin.value ? 'Platform Administration' : memberships.value.find(m => m.school_id === activeSchool.value)?.role === 'school_admin' ? 'School Administrator' : 'School Staff')
const schoolName = computed(() => (platformAdmin.value ? allSchools.value.find(s => s.id === activeSchool.value)?.name : memberships.value.find(m => m.school_id === activeSchool.value)?.schools?.name) || 'School Sports Tracker')
const schoolOptions = computed(() => platformAdmin.value ? allSchools.value : memberships.value.map(m => ({ id:m.school_id, name:m.schools?.name || 'School' })))
const links = computed(() => {
  if (platformAdmin.value) {
    const suffix = activeSchool.value ? '?school=' + encodeURIComponent(activeSchool.value) : ''
    return [
      {label:'Schools',to:'/admin/schools',icon:'🏫'},
      {label:'Improvements & Faults',to:'/admin/issues',icon:'🛠️'},
      ...(activeSchool.value ? [
        {label:'Students',to:'/school/students'+suffix,icon:'🎓'},
        {label:'Year Rollover',to:'/school/rollover'+suffix,icon:'📅'},
        {label:'Staff',to:'/school/staff'+suffix,icon:'👥'},
        {label:'Houses',to:'/school/houses'+suffix,icon:'🏠'},
        {label:'Competitions',to:'/school/competitions'+suffix,icon:'🏆'},
        {label:'Event Registrations',to:'/school/entries'+suffix,icon:'📝'},
        {label:'Results & House Points',to:'/school/results'+suffix,icon:'🥇'},
        {label:'Event Day',to:'/school/race-day'+suffix,icon:'🏁'}
      ] : [])
    ]
  }
  if (!activeSchool.value) return []
  const suffix = '?school=' + encodeURIComponent(activeSchool.value)
  return [
    {label:'Students',to:'/school/students'+suffix,icon:'🎓'},
    ...(memberships.value.find(m=>m.school_id===activeSchool.value)?.role === 'school_admin' ? [{label:'Year Rollover',to:'/school/rollover'+suffix,icon:'📅'}] : []),
    {label:'Staff',to:'/school/staff'+suffix,icon:'👥'},
    {label:'Houses',to:'/school/houses'+suffix,icon:'🏠'},
    {label:'Competitions',to:'/school/competitions'+suffix,icon:'🏆'},
    {label:'Event Registrations',to:'/school/entries'+suffix,icon:'📝'},
    {label:'Results & House Points',to:'/school/results'+suffix,icon:'🥇'},
    {label:'Event Day',to:'/school/race-day'+suffix,icon:'🏁'}
  ]
})
async function checkAccess() {
  ready.value = false
  try {
    const {data:{user}} = await db.auth.getUser()
    if (!user) { await navigateTo('/login'); return }
    platformAdmin.value = await verify()
    if (platformAdmin.value) {
      const {data:schools,error:schoolsError} = await db.from('schools').select('id,name').order('name')
      if (schoolsError) throw schoolsError
      allSchools.value = schools || []
      const requested = typeof route.query.school === 'string' ? route.query.school : ''
      activeSchool.value = allSchools.value.some(s => s.id === requested) ? requested : (allSchools.value[0]?.id || '')
    }
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
  if (typeof id === 'string' && (platformAdmin.value ? allSchools.value.some(s=>s.id===id) : memberships.value.some(m=>m.school_id === id))) activeSchool.value = id
})
watch(() => route.path, () => { mobileOpen.value = false; openFlyout.value = null })
watch(activeSchool, async (id,old) => {
  openFlyout.value = null
  if (!id || !old || id===old) return
  const path = route.path
  if (path.startsWith('/school/')) await navigateTo({path,query:{...route.query,school:id}})
  else if (path === '/dashboard') await navigateTo({path:'/dashboard',query:{...route.query,school:id}})
})
function toggleNavigation() { if (window.innerWidth <= 800) mobileOpen.value = !mobileOpen.value; else desktopCollapsed.value = !desktopCollapsed.value }
async function signOut(){ await db.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div class="workspace v3-workspace" :data-theme="resolvedTheme">
    <div v-if="mobileOpen" class="shade" @click="mobileOpen=false"></div>
    <V3Sidebar :open="mobileOpen" :collapsed="desktopCollapsed" :platform-admin="platformAdmin" :active-school="activeSchool" :school-options="schoolOptions" :school-name="schoolName" :role-label="roleLabel" :links="links" @close="mobileOpen=false" @update:school="activeSchool=$event" @sign-out="signOut" />
    <div class="content">
      <V3Topbar :school-name="schoolName" :role-label="roleLabel" :platform-admin="platformAdmin" :theme-preference="themePreference" @toggle="toggleNavigation" @theme="setTheme" />
      <main class="page" :class="{ 'competition-workspace-background': route.path === '/school/competitions' }"><slot /></main>
    </div>
  </div>
</template>
<style scoped>
.v3-workspace{--v3-bg:#ffffff;--v3-surface:#ffffff;--v3-surface-alt:#f3f5f8;--v3-text:#162b46;--v3-muted:#63758d;--v3-border:#dbe4ef;--v3-accent:#2369bd;--v3-sidebar:#102742;--v3-sidebar-text:#c7d8ed;--v3-shadow:0 8px 30px rgba(18,45,77,.05);display:flex;min-height:100vh;background:var(--v3-bg);color:var(--v3-text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.v3-workspace[data-theme=dark]{--v3-bg:#0b1628;--v3-surface:#14243b;--v3-surface-alt:#1b304c;--v3-text:#eff5fd;--v3-muted:#a6bbd4;--v3-border:#2c4462;--v3-accent:#83baff;--v3-sidebar:#09182c;--v3-sidebar-text:#c7d8ed;--v3-shadow:0 10px 32px rgba(0,0,0,.12)}
.content{flex:1;min-width:0}.page{box-sizing:border-box;width:100%;max-width:1600px;margin-inline:auto;padding:28px 30px;overflow-x:auto;background:transparent;min-height:calc(100vh - 74px)}.shade{display:none}
.v3-workspace :deep(.admin-section::before),.v3-workspace :deep(.sports-page-heading::before){content:none!important;display:none!important}
@media(max-width:800px){.shade{display:block;position:fixed;inset:0;background:#0009;z-index:29}.page{padding:18px 14px}}
</style>