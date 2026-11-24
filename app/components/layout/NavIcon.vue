<script setup lang="ts">
const icons: Record<string, string> = {
  school: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M12 5V2',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-4a4 4 0 0 1 0 8',
  account: 'M20 21a8 8 0 0 0-16 0m12-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  news: 'M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3-13a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  calendar: 'M4 5h16v15H4zM8 3v4m8-4v4M4 10h16',
  results: 'M4 20h16M6 16v-4m6 4V8m6 8V4',
  award: 'M8 4h8v7a4 4 0 0 1-8 0V4Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 3v5m-4 0h8',
  back: 'M19 12H5m7-7-7 7 7 7',
  open: 'M5 12h14m-7-7 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  logout: 'M10 4H4v16h6m4-13 5 5-5 5m5-5H9'
}
const props = defineProps<{name: string}>()
</script>

<template>
  <svg class="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="icons[props.name] || icons.news" />
  </svg>
</template>
