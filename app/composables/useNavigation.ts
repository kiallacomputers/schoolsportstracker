export function useNavigation() {
  const {schoolId,platformAdmin,schoolRole}=useSchool()
  const route=useRoute()
  const organizationLevel=computed(()=>!platformAdmin.value&&schoolRole.value==='school_admin'&&!route.path.startsWith('/school/')&&!(route.path==='/dashboard'&&route.query.school))
  const links=computed(()=>{
    if(organizationLevel.value)return [{label:'Organizations',to:'/dashboard'},{label:'Administrators',to:'/dashboard?view=administrators'},{label:'Account',to:'/dashboard?view=account'},{label:"What's New",to:'/dashboard?view=news'},{label:'Support',to:'/dashboard?view=support'}]
    const suffix=schoolId.value?'?school='+encodeURIComponent(schoolId.value):''
    const admin=platformAdmin.value?[{label:'Schools',to:'/admin/schools'},{label:'Platform Administrators',to:'/admin/platform-admins'}]:[]
    const school=schoolId.value?[
      {label:'Houses',to:'/school/houses'+suffix},
      {label:'Staff',to:'/school/staff'+suffix},
      {label:'Students',to:'/school/students'+suffix},
      {label:'Competitions',to:'/school/competitions'+suffix},
      {label:'Registrations',to:'/school/entries'+suffix},
      {label:'Event Day',to:'/school/race-day'+suffix},
      {label:'Results',to:'/school/results'+suffix},
      {label:'School Records',to:'/school/records'+suffix},
      ...(platformAdmin.value||schoolRole.value==='school_admin'?[{label:'Year Rollover',to:'/school/rollover'+suffix},{label:'Access Scopes',to:'/school/access-scopes'+suffix}]:[])
    ]:[]
    return [...(!platformAdmin.value&&schoolRole.value==='school_admin'?[{label:'Back to Organizations',to:'/dashboard'}]:[]),{label:'Overview',to:'/dashboard'+suffix},...admin,...school,...(platformAdmin.value?[{label:'Issues & New Features',to:'/admin/issues'}]:[])]
  })
  return {links,organizationLevel}
}
