export function useSchoolPermissions(){
 const db=useSupabaseClient()
 const {schoolId,schoolRole,platformAdmin}=useSchool()
 const permissions=ref<string[]>([])
 const isAdmin=computed(()=>platformAdmin.value||schoolRole.value==='school_admin')
 async function load(){permissions.value=[];if(!schoolId.value||isAdmin.value)return
 const {data:{user}}=await db.auth.getUser();if(!user)return
 const a=await db.from('school_staff_scope_assignments').select('scope_id').eq('school_id',schoolId.value).eq('user_id',user.id)
 if(a.error||!a.data?.length)return
 const s=await db.from('school_access_scopes').select('permissions').eq('school_id',schoolId.value).in('id',a.data.map(x=>x.scope_id))
 if(!s.error)permissions.value=[...new Set((s.data||[]).flatMap(x=>x.permissions||[]))]
 }
 function has(permission:string){return isAdmin.value||permissions.value.includes(permission)}
 watch([schoolId,isAdmin],()=>{void load()},{immediate:true})
 return {permissions,isAdmin,has,load}
}
