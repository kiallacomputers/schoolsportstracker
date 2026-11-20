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
 formError.value='';try{const studentId=await data.save(student,level,house);const saved=data.students.value.find(s=>s.id===studentId);if(!saved)throw new Error('Student saved but could not be loaded');selected.value=saved;notice.value='Student saved successfully'}catch(e:any){formError.value=e.message||'Unable to save student'}
}
watch([schoolId,data.year],()=>{void data.load()},{immediate:true})
</script>
<template><div class="space-y-6">
<div class="flex flex-wrap items-stretch justify-end gap-3">
  <div class="flex flex-1 flex-wrap items-stretch justify-end gap-2">
    <div v-for="metric in [{label:'Total students',value:data.students.value.length},{label:'Active',value:active},{label:'Showing',value:filtered.length}]" :key="metric.label" class="flex min-w-[112px] flex-1 items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 sm:max-w-[180px]">
      <span class="text-xs font-medium leading-tight text-[var(--muted)]">{{metric.label}}</span>
      <strong class="text-xl font-bold tabular-nums">{{metric.value}}</strong>
    </div>
  </div>
  <button v-if="canManage" class="flex min-h-[54px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" @click="open(null)"><span aria-hidden="true" class="text-xl leading-none">+</span> Add student</button>
</div>
<p v-if="data.error.value" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{data.error.value}}</p><p v-if="notice" role="status" class="text-sm text-green-700">{{notice}}</p>
<UiPanel><div class="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-bold">Student directory</h2><label class="text-sm text-[var(--muted)]">School year <input v-model.number="data.year.value" type="number" min="2000" max="2100" class="ml-2 w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"/></label></div>
<StudentsStudentFilters v-model:search="search" v-model:status="status" v-model:year-level="yearLevel" v-model:house-id="houseId" :years="years" :houses="data.houses.value" />
<p v-if="data.loading.value" class="py-8">Loading students…</p><StudentsStudentTable v-else :students="filtered" :enrolments="data.enrolmentMap.value" :houses="data.houseMap.value" @select="open"/></UiPanel>
<p v-if="formError" role="alert" class="rounded-xl bg-red-50 p-4 text-red-700">{{formError}}</p>
<StudentsStudentEditor v-if="editorOpen" :student="selected" :houses="data.houses.value" :year-level="selected?data.enrolmentMap.value.get(selected.id)?.year_level||'':''" :house-id="selected?data.enrolmentMap.value.get(selected.id)?.house_id||'':''" :busy="data.saving.value" @close="editorOpen=false" @save="save"/>
</div></template>