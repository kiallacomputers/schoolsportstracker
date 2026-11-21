export function useNavigation() {
  const {schoolId,platformAdmin,schoolRole}=useSchool()
  const links=computed(()=>{
    const suffix=schoolId.value?'?school='+encodeURIComponent(schoolId.value):''
    const admin=platformAdmin.value?[{label:'Schools',to:'/admin/schools'}]:[]
    const school=schoolId.value?[
      {label:'Houses',to:'/school/houses'+suffix},
      {label:'Staff',to:'/school/staff'+suffix},
      {label:'Students',to:'/school/students'+suffix},
      {label:'Competitions',to:'/school/competitions'+suffix},
      {label:'Registrations',to:'/school/entries'+suffix},
      {label:'Event Day',to:'/school/race-day'+suffix},
      {label:'Results',to:'/school/results'+suffix},
      ...(platformAdmin.value||schoolRole.value==='school_admin'?[{label:'Year Rollover',to:'/school/rollover'+suffix},{label:'Access Scopes',to:'/school/access-scopes'+suffix}]:[])
    ]:[]
    return [{label:'Overview',to:'/dashboard'},...admin,...school,...(platformAdmin.value?[{label:'Issues & New Features',to:'/admin/issues'}]:[])]
  })
  return {links}
}
