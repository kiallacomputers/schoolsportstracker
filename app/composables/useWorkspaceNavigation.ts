export function useWorkspaceNavigation() {
  const context = useSchoolContext()
  const links = computed(() => {
    const school = context.selectedSchoolId.value
    const suffix = school ? '?school=' + encodeURIComponent(school) : ''
    const base = [{ label: 'Dashboard', to: '/dashboard', icon: 'home' }]
    const admin = context.isPlatformAdmin.value ? [
      { label: 'Schools', to: '/admin/schools', icon: 'building' },
      { label: 'School requests', to: '/admin/school-requests', icon: 'inbox' },
      { label: 'Student requests', to: '/admin/student-requests', icon: 'clipboard' },
      { label: 'Platform issues', to: '/admin/issues', icon: 'alert' },
      { label: 'Email', to: '/admin/email', icon: 'mail' },
    ] : []
    const schoolLinks = school ? [
      { label: 'Students', to: '/school/students' + suffix, icon: 'users' },
      { label: 'Staff', to: '/school/staff' + suffix, icon: 'user' },
      { label: 'Houses', to: '/school/houses' + suffix, icon: 'flag' },
      { label: 'Competitions', to: '/school/competitions' + suffix, icon: 'trophy' },
      { label: 'Registrations', to: '/school/entries' + suffix, icon: 'clipboard' },
      { label: 'Results', to: '/school/results' + suffix, icon: 'medal' },
      { label: 'Race day', to: '/school/race-day' + suffix, icon: 'timer' },
      ...(context.canManage.value ? [{ label: 'Year rollover', to: '/school/rollover' + suffix, icon: 'calendar' }] : [])
    ] : []
    return [...base, ...admin, ...schoolLinks]
  })
  return { links }
}
