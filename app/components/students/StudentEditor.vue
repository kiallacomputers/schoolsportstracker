<script setup lang="ts">
import type {Student,House} from '~/composables/useStudents'
const props=defineProps<{student:Student|null;houses:House[];yearLevel:string;houseId:string;busy:boolean}>()
const emit=defineEmits<{close:[];save:[Partial<Student>&{student_number:string;given_name:string;family_name:string},string,string]}>()
const form=reactive({id:props.student?.id,student_number:props.student?.student_number||'',given_name:props.student?.given_name||'',family_name:props.student?.family_name||'',email:props.student?.email||'',date_of_birth:props.student?.date_of_birth||'',gender:props.student?.gender||'',sporting_division:props.student?.sporting_division||'',is_active:props.student?.is_active!==false})
const level=ref(props.yearLevel),house=ref(props.houseId)
const editing=ref(!props.student)
const confirmSave=ref(false)
function saveConfirmed(){if(props.busy)return;confirmSave.value=false;emit('save',{...form},level.value,house.value)}
watch(()=>props.student,(student)=>{if(student)editing.value=false})
const details=computed(()=>[
 {label:'Student number',value:props.student?.student_number},
 {label:'Given name',value:props.student?.given_name},
 {label:'Family name',value:props.student?.family_name},
 {label:'Email',value:props.student?.email},
 {label:'Date of birth',value:props.student?.date_of_birth},
 {label:'Year level',value:props.yearLevel},
 {label:'House',value:props.houses.find(h=>h.id===props.houseId)?.name},
 {label:'Gender',value:props.student?.gender},
 {label:'Sporting division',value:props.student?.sporting_division},
 {label:'Status',value:props.student?.is_active?'Active':'Inactive'}
])
</script>
<template><div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="emit('close')"><section role="dialog" aria-modal="true" aria-label="Student details" class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><header class="mb-5 flex items-center justify-between"><h2 class="text-xl font-bold">{{!student?'Add student':editing?'Edit student':'Student details'}}</h2><div class="flex items-center gap-2"><button v-if="student && !editing" type="button" aria-label="Edit student" title="Edit student" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-blue-600 hover:bg-[var(--panel)]" @click="editing=true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg></button><button type="button" aria-label="Close" class="rounded-lg px-2 py-1 hover:bg-[var(--panel)]" @click="emit('close')">✕</button></div></header><div v-if="student && !editing" class="grid gap-4 sm:grid-cols-2"><div v-for="detail in details" :key="detail.label" class="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3"><p class="text-xs font-medium text-[var(--muted)]">{{detail.label}}</p><p class="mt-1 font-semibold">{{detail.value||'—'}}</p></div><div class="flex justify-end sm:col-span-2"><button type="button" class="rounded-xl border border-[var(--border)] px-5 py-3" @click="emit('close')">Close</button></div></div><form v-else class="grid gap-4 sm:grid-cols-2" @submit.prevent="confirmSave=true">
<label class="text-sm font-semibold">Student number<input v-model="form.student_number" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">Given name<input v-model="form.given_name" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">Family name<input v-model="form.family_name" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">Email<input v-model="form.email" type="email" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">Date of birth<input v-model="form.date_of_birth" type="date" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">Year level<input v-model="level" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">House<select v-model="house" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"><option value="">Unassigned</option><option v-for="h in houses" :key="h.id" :value="h.id">{{h.name}}</option></select></label>
<label class="text-sm font-semibold">Gender<input v-model="form.gender" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="text-sm font-semibold">Sporting division<input v-model="form.sporting_division" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"/></label>
<label class="flex items-center gap-2 text-sm font-semibold"><input v-model="form.is_active" type="checkbox"/> Active student</label>
<div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="rounded-xl border border-[var(--border)] px-5 py-3" @click="student?editing=false:emit('close')">Cancel</button><button :disabled="busy" class="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{{busy?'Saving…':'Save student'}}</button></div>
</form></section><div v-if="confirmSave" class="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4" @click.self="confirmSave=false"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-student-save-title" aria-describedby="confirm-student-save-description" class="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl"><h3 id="confirm-student-save-title" class="text-lg font-bold">Save student?</h3><p id="confirm-student-save-description" class="mt-3 text-sm text-[var(--muted)]">Are you sure you want to {{student?'save changes to':'add'}} <strong class="text-[var(--ink)]">{{form.given_name}} {{form.family_name}}</strong>? You will return to their details after saving.</p><div class="mt-6 flex justify-end gap-3"><button type="button" class="rounded-xl border border-[var(--border)] px-4 py-2.5" @click="confirmSave=false">Cancel</button><button type="button" :disabled="busy" class="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50" @click="saveConfirmed">{{busy?'Saving…':'Yes, save'}}</button></div></section></div></div></template>