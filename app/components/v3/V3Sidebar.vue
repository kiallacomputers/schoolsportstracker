<script setup lang="ts">
const props=defineProps<{open:boolean;collapsed:boolean;platformAdmin:boolean;activeSchool:string;schoolOptions:{id:string;name:string}[];schoolName:string;roleLabel:string;links:{label:string;to:string;icon:string}[]}>()
const emit=defineEmits<{close:[];'update:school':[id:string];signOut:[]}>()
const route=useRoute()
const sections=computed(()=>[
 {label:'Overview',items:[{label:'Dashboard',to:props.platformAdmin?'/dashboard':'/dashboard?school='+encodeURIComponent(props.activeSchool),icon:'▦'}]},
 {label:'Management',items:props.links.filter(x=>!['Competitions','Event Registrations','Results & House Points','Event Day'].includes(x.label))},
 {label:'Competitions & Results',items:props.links.filter(x=>['Competitions','Event Registrations','Results & House Points','Event Day'].includes(x.label))}
].filter(x=>x.items.length))
</script>
<template>
<aside class="v3-side" :class="{open,collapsed}">
  <NuxtLink class="v3-brand" to="/dashboard" @click="emit('close')"><img src="/logo.png" alt="" /><span><strong>School Sports Tracker</strong><small>SPORTS MANAGEMENT</small></span></NuxtLink>
  <div class="v3-school-control">
    <label v-if="schoolOptions.length && (platformAdmin || schoolOptions.length>1)" for="v3-school-select">CURRENT SCHOOL</label>
    <select v-if="schoolOptions.length && (platformAdmin || schoolOptions.length>1)" id="v3-school-select" :value="activeSchool" @change="emit('update:school',($event.target as HTMLSelectElement).value)"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{s.name}}</option></select>
    <span v-else>{{schoolName}}</span>
  </div>
  <nav class="v3-navigation" aria-label="Workspace navigation">
    <section v-for="section in sections" :key="section.label" class="v3-nav-group">
      <h2>{{section.label}}</h2>
      <NuxtLink v-for="item in section.items" :key="item.to" :to="item.to" class="v3-nav-link" :class="{active:route.path===item.to.split('?')[0]}" @click="emit('close')"><span class="v3-nav-icon" aria-hidden="true">{{item.icon}}</span><span>{{item.label}}</span></NuxtLink>
    </section>
  </nav>
  <footer class="v3-side-footer"><span>{{roleLabel}}</span><button type="button" @click="emit('signOut')">Sign out <span aria-hidden="true">↗</span></button></footer>
</aside>
</template>
<style scoped>
.v3-side{--nav-bg:#ffffff;--nav-text:#263e5a;--nav-muted:#63758d;--nav-border:#dbe4ef;--nav-control:#f3f6fb;--nav-hover:#eaf0f8;--nav-active:#2369bd;--nav-active-text:#fff;position:sticky;top:0;width:256px;min-width:256px;height:100vh;display:flex;flex-direction:column;background:var(--nav-bg);color:var(--nav-text);border-right:1px solid var(--nav-border);z-index:30;transition:background .15s,color .15s}
:global(.v3-workspace[data-theme="dark"]) .v3-side{--nav-bg:#09182c;--nav-text:#c7d8ed;--nav-muted:#91adc9;--nav-border:#2c435b;--nav-control:#1b3856;--nav-hover:#21415f;--nav-active:#2b6db4;--nav-active-text:#fff}
.v3-brand{display:flex;gap:11px;align-items:center;padding:21px 17px;color:var(--nav-text);text-decoration:none;border-bottom:1px solid var(--nav-border)}.v3-brand img{width:39px;height:39px;object-fit:contain}.v3-brand strong{display:block;font-size:14px;line-height:1.3}.v3-brand small{display:block;color:var(--nav-muted);font-size:9px;letter-spacing:1.2px;margin-top:4px}.v3-school-control{padding:18px 14px 12px}.v3-school-control label{display:block;color:var(--nav-muted);font-size:10px;letter-spacing:1px;font-weight:700;margin-bottom:8px}.v3-school-control select{width:100%;padding:11px;background:var(--nav-control);border:1px solid var(--nav-border);border-radius:8px;color:var(--nav-text)}.v3-school-control>span{font-size:12px;color:var(--nav-muted)}.v3-navigation{overflow-y:auto;flex:1;padding:5px 11px 18px;scrollbar-width:thin;scrollbar-color:var(--nav-border) transparent}.v3-nav-group{margin:10px 0 20px}.v3-nav-group h2{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:var(--nav-muted);font-weight:750;padding:0 12px;margin:0 0 9px}.v3-nav-link{display:flex;align-items:center;gap:11px;padding:11px 12px;margin:3px 0;color:var(--nav-text);border-radius:8px;font-size:13px;font-weight:550;text-decoration:none}.v3-nav-link:hover{background:var(--nav-hover)}.v3-nav-link.active{background:var(--nav-active);color:var(--nav-active-text);font-weight:750}.v3-nav-icon{width:22px;text-align:center;flex-shrink:0}.v3-side-footer{padding:15px;border-top:1px solid var(--nav-border)}.v3-side-footer>span{display:block;color:var(--nav-muted);font-size:11px;margin-bottom:10px}.v3-side-footer button{display:flex;justify-content:space-between;width:100%;background:var(--nav-control);color:var(--nav-text);border:1px solid var(--nav-border);border-radius:8px;padding:10px 12px;cursor:pointer}
@media(min-width:801px){.v3-side.collapsed{width:0;min-width:0;overflow:hidden;border:0}}@media(max-width:800px){.v3-side{position:fixed;left:0;transform:translateX(-100%);transition:transform .2s}.v3-side.open{transform:translateX(0)}}
</style>