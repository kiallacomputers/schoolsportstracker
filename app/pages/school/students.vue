<script setup lang="ts">
import type {Student} from '~/composables/useStudents'
definePageMeta({layout:'workspace'})
const {schoolId,schoolRole,platformAdmin}=useSchool()
const data=useStudents()
const search=ref(''),status=ref('active'),yearLevel=ref('all'),houseId=ref('all')
const selected=ref<Student|null>(null),editorOpen=ref(false),notice=ref(''),formError=ref('')
const canManage=computed(()=>platformAdmin.value||schoolRole.value==='school_admin')
const years=computed(()=>[...new Set(data.enrolments.value.map(e=>e.year_level).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})))
const filtered=computed(()=>data.students.value.filter(s=>{
 const e=data.enrolmentMap.value.get(s.id),term=search.value.toLowerCase()
 return (status.value==='all'||(status.value==='active')===s.is_active)
 &&(yearLevel.value==='all'||e?.year_level===yearLevel.value)
 &&(houseId.value==='all'||e?.house_id===houseId.value)
 &&[s.given_name,s.family_name,s.student_number,s.email||''].join(' ').toLowerCase().includes(term)
}))
const active=computed(()=>data.students.value.filter(s=>s.is_active).length)
function open(student:Student|null){selected.value=student;formError.value='';editorOpen.value=true}
async function save(student:Partial<Student>&{student_number:string;given_name:string;family_name:string},level:string,house:string){
 formError.value='';try{await data.save(student,level,house);editorOpen.value=false;notice.value='Student saved successfully'}catch(e:any){formError.value=e.message||'Unable to save student'}
}
watch([schoolId,data.year],()=>{void data.load()},{immediate:true})
</script>
<template><div class="space-y-6">
<UiPageHeader title="Students" description="Manage student records, enrolments and house assignments."><template #actions><button v-if="canManage" class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700" @click="open(null)">+ Add student</button></template></UiPageHeader>
<p v-if="data.error.value" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{data.error.value}}</p><p v-if="notice" role="status" class="text-sm text-green-700">{{notice}}</p>
<div class="grid gap-4 sm:grid-cols-3"><UiStatCard title="Total students" :value="data.students.value.length"/><UiStatCard title="Active students" :value="active"/><UiStatCard title="Showing" :value="filtered.length"/></div>
<UiPanel><div class="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-bold">Student directory</h2><label class="text-sm text-[var(--muted)]">School year <input v-model.number="data.year.value" type="number" min="2000" max="2100" class="ml-2 w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"/></label></div>
<StudentsStudentFilters v-model:search="search" v-model:status="status" v-model:year-level="yearLevel" v-model:house-id="houseId" :years="years" :houses="data.houses.value" />
<p v-if="data.loading.value" class="py-8">Loading students…</p><StudentsStudentTable v-else :students="filtered" :enrolments="data.enrolmentMap.value" :houses="data.houseMap.value" @select="open"/></UiPanel>
<p v-if="formError" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{formError}}</p>
<StudentsStudentEditor v-if="editorOpen && canManage" :student="selected" :houses="data.houses.value" :year-level="selected?data.enrolmentMap.value.get(selected.id)?.year_level||'':''" :house-id="selected?data.enrolmentMap.value.get(selected.id)?.house_id||'':''" :busy="data.saving.value" @close="editorOpen=false" @save="save"/>
</div></template>