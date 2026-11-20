<script setup lang="ts">
const sections = [
  {icon:'🏫',title:'School competitions',description:'House carnivals, athletics and swimming',to:'/school/competitions'},
  {icon:'🌐',title:'Inter-school competitions',description:'Multi-school events and representative teams',to:null},
  {icon:'🏁',title:'Event day',description:'Heats, marshalling and results entry',to:'/school/race-day'},
  {icon:'🥇',title:'Results & records',description:'Placings, scoring, champions and records',to:'/school/results'}
]
const route = useRoute()
const schoolQuery = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
function destination(path:string|null){return path && schoolQuery.value ? {path,query:{school:schoolQuery.value}} : path || ''}
</script>
<template>
  <div class="v3-preview">
    <V3PageHeader title="Competition workspace" eyebrow="SCHOOL SPORTS TRACKER V3" description="One home for school carnivals and inter-school competition management.">
      <template #actions><span class="preview-label">Phase 1 preview</span></template>
    </V3PageHeader>
    <div class="preview-grid">
      <V3Panel title="Your workspace" description="Choose an area to continue with the existing V2 functionality.">
        <div class="area-grid">
          <component :is="item.to ? 'NuxtLink' : 'div'" v-for="item in sections" :key="item.title" :to="item.to ? destination(item.to) : undefined" class="area" :class="{'area--future':!item.to}">
            <span class="area-icon">{{item.icon}}</span><strong>{{item.title}}</strong><small>{{item.description}}</small><em v-if="!item.to">Planned for V3</em>
          </component>
        </div>
      </V3Panel>
      <V3Panel title="Rebuild roadmap" description="Developing safely without changing production data.">
        <ol class="roadmap">
          <li><span class="step">01</span><div><strong>Foundation</strong><small>New navigation, theme preferences and reusable components</small></div><span class="state">In progress</span></li>
          <li><span class="step">02</span><div><strong>Administration & schools</strong><small>Rebuild core management pages</small></div></li>
          <li><span class="step">03</span><div><strong>Unified competitions</strong><small>School and inter-school meet architecture</small></div></li>
          <li><span class="step">04</span><div><strong>Event day & results</strong><small>Registration, marshalling, scoring and reporting</small></div></li>
        </ol>
      </V3Panel>
    </div>
  </div>
</template>
<style scoped>
.v3-preview{display:grid;gap:22px;color:var(--v3-text)}.preview-label{display:inline-flex;align-items:center;border:1px solid var(--v3-border);background:var(--v3-surface-alt);color:var(--v3-accent);font-size:12px;font-weight:750;padding:9px 13px;border-radius:999px}.preview-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,1fr);gap:20px}.area-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.area{display:flex;flex-direction:column;gap:9px;padding:20px;border:1px solid var(--v3-border);background:var(--v3-surface-alt);border-radius:13px;text-decoration:none;color:var(--v3-text);transition:transform .15s,border-color .15s}.area:not(.area--future):hover{transform:translateY(-2px);border-color:var(--v3-accent)}.area-icon{font-size:24px}.area strong{font-size:15px}.area small{font-size:12px;line-height:1.5;color:var(--v3-muted)}.area em{font-size:11px;font-style:normal;color:var(--v3-accent);font-weight:750}.area--future{opacity:.75}.roadmap{list-style:none;padding:0;margin:0;display:grid;gap:18px}.roadmap li{display:flex;align-items:flex-start;gap:12px}.step{font-size:11px;color:var(--v3-accent);font-weight:800;padding-top:2px}.roadmap li div{flex:1;display:grid;gap:5px}.roadmap strong{font-size:13px}.roadmap small{font-size:12px;color:var(--v3-muted);line-height:1.5}.state{font-size:10px;color:var(--v3-accent);white-space:nowrap;font-weight:800}
@media(max-width:1000px){.preview-grid{grid-template-columns:1fr}}@media(max-width:580px){.area-grid{grid-template-columns:1fr}}
</style>
