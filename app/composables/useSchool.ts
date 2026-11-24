type School = {id:string;name:string;code:string|null}
const schoolOptions = ref<School[]>([])
const schoolId = ref('')
const platformAdmin = ref(false)
const membershipRoles = ref<Record<string,string>>({})
const organizationAdmin = computed(() => platformAdmin.value || Object.values(membershipRoles.value).includes('school_admin'))
const schoolRole = computed(()=>platformAdmin.value?'platform_admin':membershipRoles.value[schoolId.value]||'')
export function useSchool() {
  const db = useSupabaseClient()
  const route = useRoute()
  function syncRouteSchool() {
    const requested = route.query.school
    if (typeof requested === 'string' && schoolOptions.value.some(school => school.id === requested)) {
      schoolId.value = requested
    }
  }
  async function load() {
    const {data:{user},error} = await db.auth.getUser()
    if(error || !user) {
      platformAdmin.value = false
      membershipRoles.value = {}
      schoolOptions.value = []
      schoolId.value = ''
      if(error) throw error
      return false
    }
    const {data:admin,error:adminError}=await db.rpc('is_platform_admin')
    if(adminError) throw adminError
    platformAdmin.value = admin === true
    membershipRoles.value={}
    if(platformAdmin.value) {
      const {data,error}=await db.from('schools').select('id,name,code').order('name')
      if(error) throw error
      schoolOptions.value=data||[]
    } else {
      const {data,error}=await db.from('school_memberships').select('school_id,role,schools(name,code)').eq('user_id',user.id)
      if(error) throw error
      const memberships=(data||[]).filter((m:any)=>['teacher','school_admin'].includes(m.role))
      schoolOptions.value=memberships.map((m:any)=>({id:m.school_id,name:m.schools?.name||'School',code:m.schools?.code??null}))
      membershipRoles.value=Object.fromEntries(memberships.map((m:any)=>[m.school_id,m.role]))
    }
    if(!schoolOptions.value.some(s=>s.id===schoolId.value)) schoolId.value=schoolOptions.value[0]?.id||''
    syncRouteSchool()
    return true
  }
  return { schoolOptions,schoolId,platformAdmin,schoolRole,organizationAdmin,load,syncRouteSchool }
}
