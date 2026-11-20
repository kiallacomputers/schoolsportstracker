<script setup lang="ts">
defineProps<{ schoolName: string; role: string }>()
defineEmits<{ menu: [] }>()
</script>
<template>
  <header class="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-7">
    <div class="flex min-w-0 items-center gap-3">
      <button type="button" class="rounded-lg p-2 lg:hidden" aria-label="Open navigation" @click="$emit('menu')">☰</button>
      <div class="min-w-0"><p class="text-xs font-semibold tracking-wide text-[var(--muted)]">School Sports Tracker</p><h1 class="truncate text-base font-semibold">{{ schoolName }}</h1></div>
    </div>
    <div class="flex items-center gap-3"><span class="hidden text-xs text-[var(--muted)] sm:block">{{ role }}</span><LayoutAppThemeToggle /></div>
  </header>
</template>
