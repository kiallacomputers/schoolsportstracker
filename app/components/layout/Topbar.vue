<script setup lang="ts">
defineEmits<{ menu: [] }>()
const user = useSupabaseUser()
const { schoolOptions, schoolId, platformAdmin } = useSchool()
const title = computed(() => schoolOptions.value.find(s => s.id === schoolId.value)?.name || 'School Sports Tracker')
</script>

<template>
  <header class="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 bg-[var(--surface)] px-4 md:px-8">
    <div class="flex min-w-0 items-center gap-3">
      <button class="lg:hidden" aria-label="Open menu" @click="$emit('menu')">☰</button>
      <div class="min-w-0">
        <p class="text-xs text-[var(--muted)]">{{ platformAdmin ? 'Platform administration' : 'School workspace' }}</p>
        <h1 class="truncate font-bold">{{ title }}</h1>
      </div>
    </div>
    <div class="flex min-w-0 shrink-0 items-center gap-3">
      <span v-if="user?.email" class="hidden max-w-[240px] truncate text-sm font-medium text-[var(--muted)] sm:block" :title="user.email">{{ user.email }}</span>
      <LayoutThemeButton />
    </div>
  </header>
</template>
