export function useNavigation() {
  const { schoolId, platformAdmin, schoolRole, organizationAdmin } = useSchool()
  const route = useRoute()
  const canManageSchool = computed(() => platformAdmin.value || schoolRole.value === 'school_admin')
  const administrationLevel = computed(() => platformAdmin.value && route.path.startsWith('/admin/'))
  const organizationLevel = computed(() => organizationAdmin.value && !administrationLevel.value
    && route.path === '/dashboard' && !route.query.school)
  const back = { label: 'Back to Organizations', to: '/dashboard', icon: 'back' }
  const links = computed(() => {
    if (administrationLevel.value) return [
      { label: 'Schools', to: '/admin/schools', icon: 'school' },
      { label: 'Platform Administrators', to: '/admin/platform-admins', icon: 'people' },
      { label: 'Issues & New Features', to: '/admin/issues', icon: 'news' },
      back
    ]
    if (organizationLevel.value) return [
      { label: 'Organizations', to: '/dashboard', icon: 'school' },
      { label: 'Administrators', to: '/dashboard?view=administrators', icon: 'people' },
      { label: 'Account', to: '/dashboard?view=account', icon: 'account' },
      { label: "What's New", to: '/dashboard?view=news', icon: 'news' },
      { label: 'Support', to: '/dashboard?view=support', icon: 'help' },
      ...(platformAdmin.value ? [{ label: 'Administration', to: '/admin/schools', icon: 'settings' }] : [])
    ]

    const suffix = schoolId.value ? '?school=' + encodeURIComponent(schoolId.value) : ''
    const overview = { label: 'Overview', to: '/dashboard' + suffix, icon: 'school' }
    if (!schoolId.value) return [overview]
    return [
      { label: 'Meets', to: '/school/competitions' + suffix, icon: 'calendar' },
      { label: 'Registrations', to: '/school/registrations' + suffix, icon: 'news' },
      { label: canManageSchool.value ? 'Administrators & Staff' : 'Staff', to: '/school/staff' + suffix, icon: 'people' },
      { label: 'Students', to: '/school/students' + suffix, icon: 'account' },
      { label: 'Teams & Houses', to: '/school/houses' + suffix, icon: 'people' },
      { label: 'Event Day', to: '/school/race-day' + suffix, icon: 'calendar' },
      { label: 'Results', to: '/school/results' + suffix, icon: 'results' },
      { label: 'Records', to: '/school/records' + suffix, icon: 'award' },
      ...(canManageSchool.value ? [{ label: 'Access Scopes', to: '/school/access-scopes' + suffix, icon: 'settings' }] : []),
      overview,
      ...(organizationAdmin.value ? [back] : [])
    ]
  })
  return { links, organizationLevel, administrationLevel }
}
