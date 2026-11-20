<script setup lang="ts">
defineProps<{ open: boolean; links: {label:string;to:string;icon:string}[]; schools: {id:string;name:string}[]; selectedSchoolId: string }>()
const emit = defineEmits<{ close: []; selectSchool: [id:string]; signOut: [] }>()
const route = useRoute()
watch(() => route.fullPath, () => emit('close'))
</script>
<template>
  <aside :class="open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'" class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:sticky lg:top-0 lg:h-screen">
    <div class="flex h-20 items-center justify-between border-b border-[var(--border)] px-5">
      <NuxtLink to="/dashboard" class="text-lg font-extrabold tracking-tight">School Sports <span class="text-blue-600">Tracker</span></NuxtLink>
      <button type="button" class="lg:hidden" aria-label="Close navigation" @click="emit('close')">✕</button>
    </div>
    <div v-if="schools.length" class="px-4 pt-5">
      <label for="active-school" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Active school</label>
      <select id="active-school" class="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-sm" :value="selectedSchoolId" @change="emit('selectSchool', ($event.target as HTMLSelectElement).value)">
        <option v-for="school in schools" :key="school.id" :value="school.id">{{ school.name }}</option>
      </select>
    </div>
    <nav class="mt-5 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main navigation">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-[var(--panel)]" :class="route.path === link.to.split('?')[0] ? 'bg-[var(--panel)] text-blue-600' : 'text-[var(--text)]'">
        <span class="h-2 w-2 rounded-full bg-current opacity-60" aria-hidden="true"/>{{ link.label }}
      </NuxtLink>
    </nav>
    <div class="border-t border-[var(--border)] p-4"><button type="button" class="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm font-medium hover:bg-[var(--panel)]" @click="emit('signOut')">Sign out</button></div>
  </aside>
</template>
