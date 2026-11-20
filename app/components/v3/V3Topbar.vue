<script setup lang="ts">
defineProps<{schoolName:string;roleLabel:string;platformAdmin:boolean;themePreference:'light'|'dark'}>()
const emit=defineEmits<{toggle:[];theme:[value:'light'|'dark']}>()
</script>
<template>
<header class="v3-topbar">
<button class="v3-menu-button" type="button" aria-label="Toggle sidebar" @click="emit('toggle')">☰</button>
<div class="v3-topbar-title"><small>School Sports Tracker</small><strong>{{platformAdmin?'Platform administration':schoolName}}</strong></div>
<div class="v3-topbar-actions"><label class="v3-appearance"><span>Theme</span><select :value="themePreference" aria-label="Appearance theme" @change="emit('theme',($event.target as HTMLSelectElement).value as 'light'|'dark')"><option value="light">Light</option><option value="dark">Dark</option></select></label><span class="v3-role">{{roleLabel}}</span></div>
</header>
</template>
<style scoped>
.v3-topbar{min-height:74px;display:flex;align-items:center;gap:16px;padding:12px 30px;background:var(--v3-surface);border-bottom:1px solid var(--v3-border);color:var(--v3-text)}.v3-menu-button{border:1px solid var(--v3-border);background:var(--v3-surface-alt);color:var(--v3-text);border-radius:8px;padding:8px 11px;cursor:pointer}.v3-topbar-title{display:flex;flex-direction:column;gap:4px;min-width:0}.v3-topbar-title small{font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:var(--v3-muted)}.v3-topbar-title strong{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v3-topbar-actions{display:flex;align-items:center;gap:13px;margin-left:auto}.v3-appearance{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--v3-muted)}.v3-appearance select{border:1px solid var(--v3-border);background:var(--v3-surface-alt);color:var(--v3-text);padding:9px;border-radius:8px}.v3-role{border:1px solid var(--v3-border);background:var(--v3-surface-alt);color:var(--v3-muted);padding:9px 12px;border-radius:99px;font-size:12px}@media(max-width:800px){.v3-topbar{padding:10px 14px}.v3-role{display:none}}@media(max-width:480px){.v3-appearance>span{display:none}.v3-topbar-title strong{font-size:13px}}
</style>