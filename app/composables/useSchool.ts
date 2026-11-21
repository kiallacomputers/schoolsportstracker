type School = {id:string;name:string}
const schoolOptions = ref<School[]>([])
const schoolId = ref('')
const platformAdmin = ref(false)
const membershipRoles = ref<Record<string,string>>({})
const schoolRole = computed(()=>platformAdmin.value?'platform_admin':membershipRoles.value[schoolId.value]||'')
export function useSchool() {
  const db = useSupabaseClient()
  async function load() {
    const {data:{user},error} = await db.auth.getUser()
    if(error) throw error
    if(!user) return false
    const {data:admin,error:adminError}=await db.rpc('is_platform_admin')
    if(adminError) throw adminError
    platformAdmin.value = admin === true
    membershipRoles.value={}
    if(platformAdmin.value) {
      const {data,error}=await db.from('schools').select('id,name').order('name')
      if(error) throw error
      schoolOptions.value=data||[]
    } else {
      const {data,error}=await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id)
      if(error) throw error
      const memberships=(data||[]).filter((m:any)=>['teacher','school_admin'].includes(m.role))
      schoolOptions.value=memberships.map((m:any)=>({id:m.school_id,name:m.schools?.name||'School'}))
      membershipRoles.value=Object.fromEntries(memberships.map((m:any)=>[m.school_id,m.role]))
    }
    if(!schoolOptions.value.some(s=>s.id===schoolId.value)) schoolId.value=schoolOptions.value[0]?.id||''
    return true
  }
  return { schoolOptions,schoolId,platformAdmin,schoolRole,load }
}
