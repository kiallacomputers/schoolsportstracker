<script setup lang="ts">
defineProps<{title:string;description?:string;eyebrow?:string}>()
</script>
<template>
  <header class="v3-page-header">
    <div class="v3-page-header__copy">
      <p v-if="eyebrow" class="v3-page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="v3-page-header__description">{{ description }}</p>
    </div>
    <div class="v3-page-header__actions"><slot name="actions" /></div>
  </header>
</template>
<style scoped>
.v3-page-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px 32px;background:var(--v3-surface);border:1px solid var(--v3-border);border-radius:18px;min-height:150px;box-shadow:var(--v3-shadow)}
.v3-page-header__eyebrow{font-size:11px;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:var(--v3-accent);margin:0 0 9px}
h1{font-size:clamp(26px,3vw,38px);letter-spacing:-.035em;line-height:1.16;color:var(--v3-text);margin:0}
.v3-page-header__description{font-size:14px;line-height:1.6;color:var(--v3-muted);margin:10px 0 0;max-width:720px}
.v3-page-header__actions{flex-shrink:0}
@media(max-width:640px){.v3-page-header{padding:22px;min-height:125px;align-items:flex-start;flex-direction:column}}
</style>
