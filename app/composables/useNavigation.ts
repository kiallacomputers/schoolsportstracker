export function useNavigation() {
  const {schoolId,platformAdmin,schoolRole}=useSchool()
  const links=computed(()=>{
    const suffix=schoolId.value?'?school='+encodeURIComponent(schoolId.value):''
    const admin=platformAdmin.value?[{label:'Schools',to:'/school/settings'},{label:'School requests',to:'/admin/school-requests'},{label:'Student requests',to:'/admin/student-requests'},{label:'Issues & New Features',to:'/admin/issues'}]:[]
    const school=schoolId.value?[{label:'Students',to:'/school/students'+suffix},{label:'Staff',to:'/school/staff'+suffix},...(platformAdmin.value||schoolRole.value==='school_admin'?[{label:'Access Scopes',to:'/school/access-scopes'+suffix}]:[]),{label:'Houses',to:'/school/houses'+suffix},{label:'Competitions',to:'/school/competitions'+suffix},{label:'Registrations',to:'/school/entries'+suffix},{label:'Race day',to:'/school/race-day'+suffix},{label:'Results',to:'/school/results'+suffix},...(platformAdmin.value||schoolRole.value==='school_admin'?[{label:'Year rollover',to:'/school/rollover'+suffix}]:[])]:[]
    return [{label:'Overview',to:'/dashboard'},...admin,...school]
  })
  return {links}
}
