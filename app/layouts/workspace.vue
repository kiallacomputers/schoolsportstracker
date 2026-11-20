<script setup lang="ts">
const route = useRoute()
const db = useSupabaseClient()
const { theme } = useAppTheme()
const context = useSchoolContext()
const { links } = useWorkspaceNavigation()
const mobileOpen = ref(false)
const loadError = ref('')
const role = computed(() => context.isPlatformAdmin.value ? 'Platform administration' : context.membership.value?.role === 'school_admin' ? 'School administrator' : 'School staff')
const schoolName = computed(() => context.school.value?.name || 'School Sports Tracker')
async function load() {
  try {
    const authenticated = await context.load(typeof route.query.school === 'string' ? route.query.school : undefined)
    if (!authenticated) await navigateTo('/login')
    else if (!context.isPlatformAdmin.value && !context.selectedSchoolId.value) await navigateTo('/student')
  } catch (error: any) { loadError.value = error?.message || 'Unable to load your school access' }
}
onMounted(load)
watch(() => route.query.school, (id) => { if (typeof id === 'string' && context.schools.value.some(s => s.id === id)) context.selectedSchoolId.value = id })
async function selectSchool(id: string) {
  context.selectedSchoolId.value = id
  if (route.path.startsWith('/school/') || route.path === '/dashboard') await navigateTo({path:route.path,query:{...route.query,school:id}})
}
async function signOut() { await db.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div :data-theme="theme" class="sst-app min-h-screen bg-[var(--background)] text-[var(--text)]">
    <div v-if="mobileOpen" class="fixed inset-0 z-30 bg-black/50 lg:hidden" @click="mobileOpen=false" />
    <div class="flex min-h-screen">
      <LayoutAppSidebar :open="mobileOpen" :links="links" :schools="context.schools.value" :selected-school-id="context.selectedSchoolId.value" @close="mobileOpen=false" @select-school="selectSchool" @sign-out="signOut" />
      <div class="min-w-0 flex-1">
        <LayoutAppHeader :school-name="schoolName" :role="role" @menu="mobileOpen=true" />
        <main class="mx-auto w-full max-w-[1600px] px-4 py-7 md:px-8">
          <UiAppPanel v-if="loadError" role="alert">{{loadError}}</UiAppPanel>
          <slot v-else />
        </main>
      </div>
    </div>
  </div>
</template>
