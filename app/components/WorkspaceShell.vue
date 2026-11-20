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
function selected(to:string) { return route.path === to.split('?')[0] }
async function signOut(){ await db.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div class="workspace v3-workspace" :data-theme="resolvedTheme">
    <div v-if="mobileOpen" class="shade" @click="mobileOpen=false"></div>
    <aside class="side" :class="{'open':mobileOpen, 'collapsed':desktopCollapsed}">
      <NuxtLink class="brand" to="/dashboard" @click="mobileOpen=false">
        <img src="/logo.png" alt="School Sports Tracker" />
        <span><strong>School Sports Tracker</strong><small>COMPETE · ACHIEVE · INSPIRE</small></span>
      </NuxtLink>
      <div class="role">{{ roleLabel }}</div><div class="nav-section-label">WORKSPACE</div>
      <label v-if="schoolOptions.length>0 && (platformAdmin || schoolOptions.length>1)" class="school-select">School
        <select v-model="activeSchool"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{ s.name }}</option></select>
      </label>
      <nav class="nav" aria-label="Administration navigation">
        <NuxtLink :to="{path:'/admin/v3-preview',query:activeSchool ? {school:activeSchool} : {}}" class="item v3-preview-link" :class="{'current':route.path==='/admin/v3-preview'}" @click="mobileOpen=false"><span class="nav-icon" aria-hidden="true">✨</span><span>V3 Workspace Preview</span></NuxtLink>
        <NuxtLink :to="platformAdmin ? '/dashboard' : '/dashboard?school='+encodeURIComponent(activeSchool)" class="item" :class="{'current':route.path==='/dashboard'}" @click="mobileOpen=false"><span>▦</span> Dashboard</NuxtLink>
        <template v-for="item in links" :key="item.to">
          <NuxtLink :to="item.to" class="item" :class="{'current':selected(item.to)}" @click="mobileOpen=false">
            <span class="nav-icon" aria-hidden="true">{{item.icon}}</span><span>{{item.label}}</span>
          </NuxtLink>
        </template>
      </nav>
      <div class="side-footer"><span class="side-footer-school">{{ schoolName }}</span><button class="logout" type="button" @click="signOut">Sign Out ↗</button></div>
    </aside>
    <div class="content">
      <header class="top"><button class="toggle" type="button" aria-label="Toggle navigation" @click="mobileOpen=!mobileOpen; desktopCollapsed=!desktopCollapsed">☰</button><div class="top-context"><small>SCHOOL SPORTS TRACKER <span class="v3-version">V3 PREVIEW</span></small><strong>{{ platformAdmin ? 'Platform Administration' : schoolName }}</strong></div><div class="v3-top-actions"><label class="v3-theme-control"><span>Appearance</span><select :value="themePreference" aria-label="Appearance theme" @change="setTheme(($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system')"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><span class="top-role">{{ roleLabel }}</span></div></header>
      <main class="page" :class="{ 'competition-workspace-background': route.path === '/school/competitions' }"><slot /></main>
    </div>
  </div>
</template>
<style scoped>
.v3-workspace{--v3-bg:#f3f6fb;--v3-surface:#fff;--v3-surface-alt:#eaf0f8;--v3-text:#162b46;--v3-muted:#63758d;--v3-border:#dbe4ef;--v3-accent:#2369bd;--v3-sidebar:#102742;--v3-sidebar-text:#c7d8ed;--v3-shadow:0 8px 30px rgba(18,45,77,.05);display:flex;min-height:100vh;background:var(--v3-bg);color:var(--v3-text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.v3-workspace[data-theme=dark]{--v3-bg:#0b1628;--v3-surface:#14243b;--v3-surface-alt:#1b304c;--v3-text:#eff5fd;--v3-muted:#a6bbd4;--v3-border:#2c4462;--v3-accent:#83baff;--v3-sidebar:#09182c;--v3-sidebar-text:#c7d8ed;--v3-shadow:0 10px 32px rgba(0,0,0,.12)}
.side{position:sticky;top:0;width:264px;min-width:264px;height:100vh;background:var(--v3-sidebar);border-right:1px solid #29405b;display:flex;flex-direction:column;z-index:30}
.brand{display:flex;align-items:center;gap:12px;padding:24px 19px;border-bottom:1px solid #2c435f;color:#fff;text-decoration:none}
.brand img{height:46px;width:46px;object-fit:contain}.brand strong{display:block;font-size:15px;line-height:1.25}.brand small{display:block;margin-top:5px;font-size:9px;color:#9fbfe5;letter-spacing:1px}
.role{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#9db9d9;padding:18px 19px 7px}.nav-section-label{padding:15px 20px 9px;font-size:10px;letter-spacing:1.6px;color:#86a7ce;font-weight:750}
.school-select{padding:0 16px 12px;color:#bed3ef;font-size:12px}.school-select select{display:block;width:100%;margin-top:8px;background:#183755;color:white;border:1px solid #46617e;border-radius:10px;padding:10px}
.nav{display:flex;flex-direction:column;gap:4px;padding:0 12px 18px;overflow-y:auto;flex:1}.item{display:flex;align-items:center;gap:13px;padding:12px 14px;color:var(--v3-sidebar-text);text-decoration:none;border-radius:10px;font-size:13px;font-weight:600;transition:background .15s,color .15s}.nav-icon{width:24px;text-align:center;font-size:17px;flex-shrink:0}.item:hover{background:#224462;color:white}.current{background:#286db8;color:#fff;font-weight:750}
.v3-preview-link{border:1px solid #3a5e84;margin-bottom:10px;background:#183b5c}
.side-footer{border-top:1px solid #2c435f;padding:14px 12px}.side-footer-school{display:block;font-size:11px;color:#a9c1dc;padding:4px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.logout{width:100%;padding:12px;background:#1b3957;color:#e3f0ff;border:1px solid #41617e;border-radius:10px;cursor:pointer;text-align:left}
.content{flex:1;min-width:0}.top{min-height:82px;display:flex;align-items:center;gap:17px;padding:12px 34px;background:var(--v3-surface);border-bottom:1px solid var(--v3-border);color:var(--v3-text)}.top-context{display:flex;flex-direction:column;gap:4px}.top-context small{font-size:10px;letter-spacing:1.2px;color:var(--v3-muted)}.top-context strong{font-size:17px}.v3-version{margin-left:8px;color:var(--v3-accent);font-weight:800}.v3-top-actions{margin-left:auto;display:flex;align-items:center;gap:14px}.top-role{background:var(--v3-surface-alt);border:1px solid var(--v3-border);border-radius:999px;padding:9px 14px;font-size:12px;color:var(--v3-muted)}
.v3-theme-control{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--v3-muted)}.v3-theme-control select{border:1px solid var(--v3-border);border-radius:9px;background:var(--v3-surface-alt);color:var(--v3-text);padding:9px 10px;font:inherit;cursor:pointer}
.page{box-sizing:border-box;width:100%;max-width:1600px;margin-inline:auto;padding:30px 34px;overflow-x:auto;background:transparent;min-height:calc(100vh - 82px)}.toggle{background:none;border:0;color:var(--v3-text);font-size:24px;cursor:pointer}.shade{display:none}
/* The shell controls the page canvas; legacy image overlays should not appear behind content. */
.v3-workspace :deep(.admin-section::before){content:none!important;display:none!important}
.v3-workspace :deep(.sports-page-heading::before){content:none!important;display:none!important}
@media(min-width:801px){.side.collapsed{width:0;min-width:0;overflow:hidden;border-right:0}}
@media(max-width:800px){.side{position:fixed;left:0;transform:translateX(-100%);transition:transform .2s}.side.open{transform:translateX(0)}.shade{display:block;position:fixed;inset:0;background:#0009;z-index:29}.top{padding:12px 16px;min-height:72px}.top-role{display:none}.page{padding:18px 14px;min-height:calc(100vh - 72px)}}
@media(max-width:480px){.v3-theme-control>span{display:none}.top-context strong{font-size:14px}.top{gap:10px}}
</style>
