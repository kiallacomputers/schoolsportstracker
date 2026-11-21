<script setup lang="ts">
definePageMeta({layout:'workspace'})
type Competition={id:string;name:string;sport_id:string|null;competition_type:string;management_mode:string;organiser_school_id:string|null;school_year:number;starts_on:string|null;status:string}
type Sport={id:string;name:string}
const db=useSupabaseClient()
const {schoolId,platformAdmin}=useSchool()
const {has}=useSchoolPermissions()
const competitions=ref<Competition[]>([])
const sports=ref<Sport[]>([])
const loading=ref(false),busy=ref(false),error=ref(''),notice=ref('')
const search=ref(''),statusFilter=ref('all'),dialog=ref(false),selected=ref<Competition|null>(null)
const statuses=['draft','registration','active','completed','archived']
const form=reactive({name:'',sport_id:'',school_year:new Date().getFullYear(),starts_on:'',status:'draft'})
const visible=computed(()=>competitions.value.filter(c=>(statusFilter.value==='all'||c.status===statusFilter.value)&&[c.name,c.school_year,sportName(c.sport_id)].join(' ').toLowerCase().includes(search.value.toLowerCase())))
const canCreate=computed(()=>!!schoolId.value&&has('competitions.create'))
const canEdit=(c:Competition)=>c.competition_type==='intra_school'&&c.organiser_school_id===schoolId.value&&has('competitions.manage')
function sportName(id:string|null){return sports.value.find(s=>s.id===id)?.name||'Not specified'}
function reset(){selected.value=null;Object.assign(form,{name:'',sport_id:sports.value[0]?.id||'',school_year:new Date().getFullYear(),starts_on:'',status:'draft'});dialog.value=true;error.value=''}
function edit(c:Competition){selected.value=c;Object.assign(form,{name:c.name,sport_id:c.sport_id||'',school_year:c.school_year,starts_on:c.starts_on||'',status:c.status});dialog.value=true;error.value=''}
function close(){if(!busy.value)dialog.value=false}
async function load(){
 if(!schoolId.value){competitions.value=[];return}
 loading.value=true;error.value=''
 try{
  const [c,s]=await Promise.all([
   db.from('competitions').select('id,name,sport_id,competition_type,management_mode,organiser_school_id,school_year,starts_on,status').eq('organiser_school_id',schoolId.value).order('school_year',{ascending:false}).order('starts_on',{ascending:false}),
   db.from('sports').select('id,name').order('name')
  ])
  if(c.error||s.error)throw c.error||s.error
  competitions.value=(c.data||[]) as Competition[]
  sports.value=(s.data||[]) as Sport[]
 }catch(e:any){error.value=e.message||'Unable to load competitions'}
 finally{loading.value=false}
}
async function save(){
 if(busy.value||!schoolId.value)return
 if(selected.value?!canEdit(selected.value):!canCreate.value)return
 busy.value=true;error.value='';notice.value=''
 try{
  const name=form.name.trim()
  if(name.length<3||name.length>180)throw new Error('Competition name must be 3 to 180 characters')
  if(!Number.isInteger(form.school_year)||form.school_year<2000||form.school_year>2100)throw new Error('Enter a valid school year')
  if(!sports.value.some(s=>s.id===form.sport_id))throw new Error('Select a sport')
  if(selected.value){
   const {data,error:e}=await db.from('competitions').update({name,sport_id:form.sport_id,school_year:form.school_year,starts_on:form.starts_on||null,status:form.status}).eq('id',selected.value.id).eq('organiser_school_id',schoolId.value).select('id').single()
   if(e)throw e
   if(!data)throw new Error('Competition could not be updated')
  }else{
   const {data,error:e}=await db.rpc('create_school_competition',{p_school_id:schoolId.value,p_name:name,p_sport_id:form.sport_id,p_school_year:form.school_year,p_starts_on:form.starts_on||null})
   if(e)throw e
   if(!data)throw new Error('Competition could not be created')
  }
  dialog.value=false
  notice.value=selected.value?'Competition updated successfully':'Competition created as a draft'
  await load()
 }catch(e:any){error.value=e.message||'Unable to save competition'}
 finally{busy.value=false}
}
watch(schoolId,()=>{dialog.value=false;void load()},{immediate:true})
</script>
<template>
<div class="space-y-6">
 <UiPageHeader title="Competitions" description="Create and manage your school's athletics, swimming and other sporting competitions.">
  <template #actions><button v-if="canCreate" class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700" @click="reset">+ New competition</button></template>
 </UiPageHeader>
 <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{error}}</p>
 <p v-if="notice" role="status" class="text-sm text-green-700">{{notice}}</p>
 <div class="grid gap-4 sm:grid-cols-3"><UiStatCard title="Competitions" :value="competitions.length"/><UiStatCard title="Active" :value="competitions.filter(c=>c.status==='active').length"/><UiStatCard title="Draft / Registration" :value="competitions.filter(c=>['draft','registration'].includes(c.status)).length"/></div>
 <UiPanel>
  <div class="mb-5 flex flex-wrap gap-3">
   <input v-model="search" aria-label="Search competitions" placeholder="Search competitions" type="search" class="min-w-48 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"/>
   <select v-model="statusFilter" aria-label="Filter competition status" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"><option value="all">All statuses</option><option v-for="s in statuses" :key="s" :value="s">{{s.replaceAll('_',' ')}}</option></select>
  </div>
  <p v-if="loading">Loading competitions…</p>
  <div v-else class="overflow-x-auto"><table class="w-full min-w-[650px] text-left text-sm">
   <thead><tr class="border-b border-[var(--border)] text-[var(--muted)]"><th class="py-3">Competition</th><th class="p-3">Sport</th><th class="p-3">School year</th><th class="p-3">Date</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead>
   <tbody><tr v-for="c in visible" :key="c.id" class="border-b border-[var(--border)]"><td class="py-4 font-semibold">{{c.name}}</td><td class="p-3">{{sportName(c.sport_id)}}</td><td class="p-3">{{c.school_year}}</td><td class="p-3">{{c.starts_on||'Not scheduled'}}</td><td class="p-3 capitalize">{{c.status.replaceAll('_',' ')}}</td><td class="p-3"><button v-if="canEdit(c)" class="rounded-lg border border-[var(--border)] px-3 py-2 text-blue-600 hover:underline" @click="edit(c)">Edit</button><span v-else class="text-xs text-[var(--muted)]">View only</span></td></tr></tbody>
  </table><p v-if="!visible.length" class="py-8 text-center text-sm text-[var(--muted)]">No matching competitions.</p></div>
 </UiPanel>
 <div v-if="dialog" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="close"><section role="dialog" aria-modal="true" aria-label="Competition details" class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl">
  <header class="mb-5 flex items-center justify-between"><h2 class="text-xl font-bold">{{selected?'Edit competition':'New competition'}}</h2><button aria-label="Close" class="text-red-700" @click="close">✕</button></header>
  <form class="space-y-4" @submit.prevent="save">
   <label class="block text-sm font-semibold">Competition name<input v-model="form.name" required minlength="3" maxlength="180" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   <label class="block text-sm font-semibold">Sport<select v-model="form.sport_id" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option disabled value="">Select a sport</option><option v-for="s in sports" :key="s.id" :value="s.id">{{s.name}}</option></select></label>
   <div class="grid gap-4 sm:grid-cols-2">
    <label class="block text-sm font-semibold">School year<input v-model.number="form.school_year" type="number" min="2000" max="2100" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
    <label class="block text-sm font-semibold">Competition date<input v-model="form.starts_on" type="date" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
   </div>
   <label v-if="selected" class="block text-sm font-semibold">Status<select v-model="form.status" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option v-for="s in statuses" :key="s" :value="s">{{s.replaceAll('_',' ')}}</option></select></label>
   <p v-else class="text-sm text-[var(--muted)]">New competitions are created as drafts. Registration and event settings will be configured in the next stage.</p>
   <div class="flex justify-end gap-3"><button type="button" class="rounded-xl border border-[var(--border)] px-5 py-3" @click="close">Cancel</button><button type="submit" :disabled="busy||!sports.length" class="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{{busy?'Saving…':'Save competition'}}</button></div>
  </form>
 </section></div>
</div>
</template>