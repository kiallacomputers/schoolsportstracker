<script setup lang="ts">
defineProps<{search:string;status:string;yearLevel:string;houseId:string;years:string[];houses:{id:string;name:string}[]}>()
const emit=defineEmits<{'update:search':[string];'update:status':[string];'update:yearLevel':[string];'update:houseId':[string]}>()
</script>
<template><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
<input :value="search" type="search" placeholder="Search students" aria-label="Search students" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" @input="emit('update:search',($event.target as HTMLInputElement).value)"/>
<select :value="status" aria-label="Status" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" @change="emit('update:status',($event.target as HTMLSelectElement).value)"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option></select>
<select :value="yearLevel" aria-label="Year level" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" @change="emit('update:yearLevel',($event.target as HTMLSelectElement).value)"><option value="all">All year levels</option><option v-for="y in years" :key="y" :value="y">Year {{y}}</option></select>
<select :value="houseId" aria-label="House" class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" @change="emit('update:houseId',($event.target as HTMLSelectElement).value)"><option value="all">All houses</option><option v-for="h in houses" :key="h.id" :value="h.id">{{h.name}}</option></select>
</div></template>