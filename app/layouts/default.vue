<script setup lang="ts">
const route = useRoute()
const workspace = computed(() => route.path === '/dashboard' || route.path.startsWith('/school/') || route.path.startsWith('/admin/'))
</script>
<template>
  <NuxtLayout v-if="workspace" name="workspace"><slot /></NuxtLayout>
  <div v-else><slot /></div>
</template>
