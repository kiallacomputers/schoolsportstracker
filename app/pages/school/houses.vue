<script setup lang="ts">
const db=useSupabaseClient(),route=useRoute()
const busy=ref(true),error=ref(''),rows=ref<any[]>([]),schoolId=ref(''),schoolName=ref(''),role=ref(''),name=ref(''),colour=ref('#2563eb'),saving=ref(false)
async function load(){
  const {data:{user}}=await db.auth.getUser();if(!user){await navigateTo('/login');return}
  const {data:m,error:e}=await db.from('school_memberships').select('school_id,role,schools(name)').eq('user_id',user.id)
  if(e){error.value=e.message;busy.value=false;return}
  const eligible=(m||[]).filter(x=>['school_admin','teacher'].includes(x.role));const requested=typeof route.query.school==='string'?route.query.school:''
  const membership=eligible.find(x=>x.school_id===requested)||(!requested?eligible[0]:null)
  if(!membership){error.value='You do not have access to this school.';busy.value=false;return}
  schoolId.value=membership.school_id;role.value=membership.role;schoolName.value=(membership.schools as any)?.name||'School';await refresh();busy.value=false
}
async function refresh(){const r=await db.from('school_houses').select('id,name,colour').eq('school_id',schoolId.value).order('name');rows.value=r.data||[];error.value=r.error?.message||''}
async function add(){if(role.value!=='school_admin')return;saving.value=true;error.value='';const r=await db.from('school_houses').insert({school_id:schoolId.value,name:name.value.trim(),colour:colour.value});saving.value=false;if(r.error){error.value=r.error.message;return}name.value='';await refresh()}
onMounted(load)
</script>
<template><div class="page"><div class="shell admin-section"><NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink><h1>{{schoolName}} — Houses</h1><p v-if="busy">Loading…</p><p v-if="error" class="error" role="alert">{{error}}</p><template v-if="!busy&&schoolId"><form v-if="role==='school_admin'" class="card editor" @submit.prevent="add"><h2>Add House</h2><label>House name<input v-model="name" required maxlength="120"></label><label>Colour<input v-model="colour" type="color"></label><button class="btn" :disabled="saving">{{saving?'Saving…':'Add House'}}</button></form><div class="card"><h2>School Houses</h2><div v-for="h in rows" :key="h.id" class="data-row"><span>{{h.name}}</span><span>{{h.colour||'—'}}</span></div><p v-if="!rows.length">No houses recorded.</p></div></template></div></div></template>
