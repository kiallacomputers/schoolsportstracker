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
.v3-side{position:sticky;top:0;width:256px;min-width:256px;height:100vh;display:flex;flex-direction:column;background:var(--v3-sidebar);color:#d5e2f2;border-right:1px solid #263e58;z-index:30}.v3-brand{display:flex;gap:11px;align-items:center;padding:21px 17px;color:white;text-decoration:none;border-bottom:1px solid #2c435b}.v3-brand img{width:39px;height:39px;object-fit:contain}.v3-brand strong{display:block;font-size:14px;line-height:1.3}.v3-brand small{display:block;color:#91adc9;font-size:9px;letter-spacing:1.2px;margin-top:4px}.v3-school-control{padding:18px 14px 12px}.v3-school-control label{display:block;color:#91adc9;font-size:10px;letter-spacing:1px;font-weight:700;margin-bottom:8px}.v3-school-control select{width:100%;padding:11px;background:#1b3856;border:1px solid #3c5874;border-radius:8px;color:white}.v3-school-control>span{font-size:12px;color:#b5c9dd}.v3-navigation{overflow-y:auto;flex:1;padding:5px 11px 18px;scrollbar-width:thin;scrollbar-color:#45617b transparent}.v3-nav-group{margin:10px 0 20px}.v3-nav-group h2{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:#8da9c7;font-weight:750;padding:0 12px;margin:0 0 9px}.v3-nav-link{display:flex;align-items:center;gap:11px;padding:11px 12px;margin:3px 0;color:#c8d9ec;border-radius:8px;font-size:13px;font-weight:550;text-decoration:none}.v3-nav-link:hover{background:#21415f;color:white}.v3-nav-link.active{background:#2b6db4;color:white;font-weight:750}.v3-nav-icon{width:22px;text-align:center;flex-shrink:0}.v3-side-footer{padding:15px;border-top:1px solid #2c435b}.v3-side-footer>span{display:block;color:#8da9c7;font-size:11px;margin-bottom:10px}.v3-side-footer button{display:flex;justify-content:space-between;width:100%;background:#1b3856;color:#e4effa;border:1px solid #3c5874;border-radius:8px;padding:10px 12px;cursor:pointer}
@media(min-width:801px){.v3-side.collapsed{width:0;min-width:0;overflow:hidden;border:0}}@media(max-width:800px){.v3-side{position:fixed;left:0;transform:translateX(-100%);transition:transform .2s}.v3-side.open{transform:translateX(0)}}
</style>