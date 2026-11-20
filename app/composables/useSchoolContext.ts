import { computed, ref } from 'vue'
type School = { id: string; name: string }
type Membership = { school_id: string; role: string; schools?: { name: string } | null }
const schools = ref<School[]>([])
const memberships = ref<Membership[]>([])
const selectedSchoolId = ref('')
const isPlatformAdmin = ref(false)
const loaded = ref(false)
export function useSchoolContext() {
  const db = useSupabaseClient()
  const { verify } = useAdmin()
  const school = computed(() => schools.value.find(item => item.id === selectedSchoolId.value))
  const membership = computed(() => memberships.value.find(item => item.school_id === selectedSchoolId.value))
  const canManage = computed(() => isPlatformAdmin.value || membership.value?.role === 'school_admin')
  const canEnterResults = computed(() => canManage.value || membership.value?.role === 'teacher')
  async function load(requested?: string) {
    loaded.value = false
    try {
      const { data: { user }, error: authError } = await db.auth.getUser()
      if (authError) throw authError
      if (!user) { schools.value = []; memberships.value = []; selectedSchoolId.value = ''; return false }
      isPlatformAdmin.value = await verify()
      if (isPlatformAdmin.value) {
        const { data, error } = await db.from('schools').select('id,name').order('name')
        if (error) throw error
        schools.value = data || []
        memberships.value = []
      } else {
        const { data, error } = await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id', user.id)
        if (error) throw error
        memberships.value = (data || []).filter((item: any) => ['school_admin','teacher'].includes(item.role)) as Membership[]
        schools.value = memberships.value.map(item => ({ id: item.school_id, name: item.schools?.name || 'School' }))
      }
      const preferred = requested || selectedSchoolId.value
      selectedSchoolId.value = schools.value.some(item => item.id === preferred) ? preferred : schools.value[0]?.id || ''
      return true
    } finally { loaded.value = true }
  }
  return { schools, memberships, selectedSchoolId, isPlatformAdmin, loaded, school, membership, canManage, canEnterResults, load }
}
