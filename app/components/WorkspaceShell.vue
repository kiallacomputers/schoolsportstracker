<script setup lang="ts">
const db = useSupabaseClient()
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
      {label:'School Requests',to:'/admin/school-requests',icon:'📨'},
      {label:'Student Approvals',to:'/admin/student-requests',icon:'✓'},
      {label:'Email Settings',to:'/admin/email',icon:'✉'},
      {label:'All Competitions',to:'/admin/competitions',icon:'🏆'},
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
  <div class="workspace">
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
      <header class="top"><button class="toggle" type="button" aria-label="Toggle navigation" @click="mobileOpen=!mobileOpen; desktopCollapsed=!desktopCollapsed">☰</button><div class="top-context"><small>SCHOOL SPORTS TRACKER / WORKSPACE</small><strong>{{ platformAdmin ? 'Platform Administration' : schoolName }}</strong></div><span class="top-role">{{ roleLabel }}</span></header>
      <main class="page"><slot /></main>
    </div>
  </div>
</template>
<style scoped>
.workspace{display:flex;min-height:100vh;background:#071426;color:#edf5ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.side{position:sticky;top:0;width:266px;min-width:266px;height:100vh;background:linear-gradient(180deg,#102a4b 0%,#0b1c36 100%);border-right:1px solid #284365;display:flex;flex-direction:column;z-index:30;box-shadow:8px 0 32px #020b1922}
.brand{display:flex;align-items:center;gap:12px;padding:25px 19px 23px;border-bottom:1px solid #294669;color:white;text-decoration:none}
.brand img{height:49px;width:49px;object-fit:contain}.brand strong{display:block;font-size:15px;line-height:1.25}.brand small{display:block;margin-top:5px;font-size:9px;color:#9fbfe5;letter-spacing:1px}
.role{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#94b7e2;padding:20px 19px 10px}.nav-section-label{padding:20px 20px 9px;font-size:10px;letter-spacing:1.6px;color:#6e95c4;font-weight:750}
.school-select{padding:0 16px 8px;color:#bed3ef;font-size:12px}.school-select select{display:block;width:100%;margin-top:8px;background:#132e52;color:white;border:1px solid #395b83;border-radius:10px;padding:10px}
.nav{display:flex;flex-direction:column;gap:5px;padding:0 12px 18px;overflow-y:auto;flex:1}.item{display:flex;align-items:center;gap:13px;padding:13px 14px;color:#c8d9ef;text-decoration:none;border-radius:11px;font-size:13px;font-weight:570;transition:background .15s,color .15s}.nav-icon{width:24px;text-align:center;font-size:17px;flex-shrink:0}.item:hover{background:#1c3d66;color:white}.current{background:linear-gradient(90deg,#2168ba,#174781);color:#fff;font-weight:750;box-shadow:0 4px 14px #0002}
.side-footer{border-top:1px solid #284365;padding:14px 12px}.side-footer-school{display:block;font-size:11px;color:#95b6dd;padding:4px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.logout{width:100%;padding:12px;background:#193657;color:#e3f0ff;border:1px solid #34577e;border-radius:10px;cursor:pointer;text-align:left}
.content{flex:1;min-width:0}.top{min-height:82px;display:flex;align-items:center;gap:17px;padding:12px 34px;background:#0b1d35;border-bottom:1px solid #294263}.top-context{display:flex;flex-direction:column;gap:4px}.top-context small{font-size:10px;letter-spacing:1.5px;color:#81a8d5}.top-context strong{font-size:17px}.top-role{margin-left:auto;background:#1a3556;border:1px solid #355579;border-radius:999px;padding:9px 14px;font-size:12px;color:#c8dcf7}.page{padding:28px 34px;max-width:100%;overflow-x:auto}.toggle{background:none;border:0;color:white;font-size:24px;cursor:pointer}.shade{display:none}
@media(min-width:801px){.side.collapsed{width:0;min-width:0;overflow:hidden;border-right:0}}
@media(max-width:800px){.side{position:fixed;left:0;transform:translateX(-100%);transition:transform .2s}.side.open{transform:translateX(0)}.shade{display:block;position:fixed;inset:0;background:#0009;z-index:29}.top{padding:12px 16px;min-height:72px}.top-role{display:none}.page{padding:18px 12px}}
</style>
