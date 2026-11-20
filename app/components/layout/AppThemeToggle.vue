<script setup lang="ts">
const { theme, toggleTheme } = useAppTheme()
</script>
<template>
  <button type="button" class="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] transition hover:opacity-75" :aria-label="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'" @click="toggleTheme">
    <svg v-if="theme === 'light'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z"/></svg>
  </button>
</template>
