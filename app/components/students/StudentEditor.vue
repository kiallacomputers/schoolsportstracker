<script setup lang="ts">
import type {Student,House} from '~/composables/useStudents'
const props=defineProps<{student:Student|null;houses:House[];yearLevel:string;houseId:string;busy:boolean}>()
const emit=defineEmits<{close:[];save:[Partial<Student>&{student_number:string;given_name:string;family_name:string},string,string]}>()
const form=reactive({id:props.student?.id,student_number:props.student?.student_number||'',given_name:props.student?.given_name||'',family_name:props.student?.family_name||'',email:props.student?.email||'',date_of_birth:props.student?.date_of_birth||'',gender:props.student?.gender||'',sporting_division:props.student?.sporting_division||'',is_active:props.student?.is_active!==false})
const level=ref(props.yearLevel),house=ref(props.houseId)
</script>
<template><div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" @click.self="emit('close')"><section role="dialog" aria-modal="true" aria-label="Student details" class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl"><header class="mb-5 flex items-center justify-between"><h2 class="text-xl font-bold">{{student?'Edit student':'Add student'}}</h2><button aria-label="Close" @click="emit('close')">✕</button></header><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="emit('save',form,level,house)">
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
<div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="rounded-xl border border-[var(--border)] px-5 py-3" @click="emit('close')">Cancel</button><button :disabled="busy" class="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{{busy?'Saving…':'Save student'}}</button></div>
</form></section></div></template>