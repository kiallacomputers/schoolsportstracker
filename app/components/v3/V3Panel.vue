<script setup lang="ts">
defineProps<{title?:string;description?:string}>()
</script>
<template>
  <section class="v3-panel">
    <header v-if="title || description || $slots.actions" class="v3-panel__head">
      <div><h2 v-if="title">{{ title }}</h2><p v-if="description">{{ description }}</p></div>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
<style scoped>
.v3-panel{padding:24px;background:var(--v3-surface);border:1px solid var(--v3-border);border-radius:16px;box-shadow:var(--v3-shadow);color:var(--v3-text)}
.v3-panel__head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}
h2{font-size:18px;margin:0;color:var(--v3-text)}p{font-size:13px;margin:5px 0 0;color:var(--v3-muted)}
@media(max-width:640px){.v3-panel{padding:17px}}
</style>
