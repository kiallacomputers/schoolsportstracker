<script setup lang="ts">
defineProps<{schoolName:string;roleLabel:string;platformAdmin:boolean;themePreference:'light'|'dark'}>()
const emit=defineEmits<{toggle:[];theme:[value:'light'|'dark']}>()
</script>
<template>
<header class="v3-topbar">
<button class="v3-menu-button" type="button" aria-label="Toggle sidebar" @click="emit('toggle')">☰</button>
<div class="v3-topbar-title"><small>School Sports Tracker</small><strong>{{platformAdmin?'Platform administration':schoolName}}</strong></div>
<div class="v3-topbar-actions"><button class="v3-theme-toggle" type="button" :aria-label="themePreference === 'light' ? 'Switch to dark mode' : 'Switch to light mode'" :title="themePreference === 'light' ? 'Switch to dark mode' : 'Switch to light mode'" @click="emit('theme', themePreference === 'light' ? 'dark' : 'light')">
<svg v-if="themePreference === 'light'" xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
<svg v-else xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z"/></svg>
</button><span class="v3-role">{{roleLabel}}</span></div>
</header>
</template>
<style scoped>
.v3-topbar{min-height:74px;display:flex;align-items:center;gap:16px;padding:12px 30px;background:var(--v3-surface);border-bottom:1px solid var(--v3-border);color:var(--v3-text)}.v3-menu-button{border:1px solid var(--v3-border);background:var(--v3-surface-alt);color:var(--v3-text);border-radius:8px;padding:8px 11px;cursor:pointer}.v3-topbar-title{display:flex;flex-direction:column;gap:4px;min-width:0}.v3-topbar-title small{font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:var(--v3-muted)}.v3-topbar-title strong{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v3-topbar-actions{display:flex;align-items:center;gap:13px;margin-left:auto}.v3-theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid var(--v3-border);border-radius:10px;background:var(--v3-surface-alt);color:var(--v3-text);cursor:pointer;transition:background .15s ease}.v3-theme-toggle:hover{background:var(--v3-border)}.v3-theme-toggle:focus-visible{outline:2px solid var(--v3-accent);outline-offset:2px}.v3-role{border:1px solid var(--v3-border);background:var(--v3-surface-alt);color:var(--v3-muted);padding:9px 12px;border-radius:99px;font-size:12px}@media(max-width:800px){.v3-topbar{padding:10px 14px}.v3-role{display:none}}@media(max-width:480px){.v3-topbar-title strong{font-size:13px}}
</style>