<template>
  <Teleport to="body">
    <div v-if="open" class="sst-modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <section class="sst-modal-panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <header class="sst-modal-header"><h2>{{ title }}</h2><button type="button" aria-label="Close popup" @click="$emit('close')">✕</button></header>
        <p v-if="description" class="sst-modal-description">{{ description }}</p>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
defineProps<{open:boolean,title:string,description?:string}>()
defineEmits<{close:[]}>()
</script>
<style scoped>
.sst-modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(1,9,24,.78);display:flex;justify-content:center;align-items:center;padding:20px;overflow:auto}
.sst-modal-panel{background:#0d2342;color:#f4f8ff;border:1px solid #355c84;border-radius:14px;box-shadow:0 25px 80px #0009;width:min(700px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px}
.sst-modal-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}.sst-modal-header h2{margin:0;font-size:1.35rem}.sst-modal-header button{background:#173a66;color:white;border:1px solid #52769d;border-radius:8px;padding:8px 12px;cursor:pointer}.sst-modal-description{color:#c6d9ef}
:deep(input),:deep(select){color:#f4f8ff;background:#102b4c;border:1px solid #507198;border-radius:7px;padding:9px;max-width:100%}
:deep(input[type=checkbox]),:deep(input[type=range]){padding:0}
:deep(.form-grid){display:grid;gap:12px}:deep(.field){display:flex;flex-direction:column;gap:6px}:deep(.btn){margin-top:8px}
</style>
