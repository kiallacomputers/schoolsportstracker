<script setup lang="ts">
definePageMeta({middleware:'admin'})
const db=useSupabaseClient();const rows=ref<any[]>([]),name=ref(''),code=ref(''),busy=ref(false),error=ref(''),message=ref('')
async function load(){const r=await db.from('schools').select('id,name,code').order('name');rows.value=r.data||[];error.value=r.error?.message||''}
onMounted(load)
async function add(){busy.value=true;error.value='';message.value='';const r=await db.from('schools').insert({name:name.value.trim(),code:code.value.trim()||null});busy.value=false;if(r.error){error.value=r.error.message;return}name.value='';code.value='';message.value='School created';await load()}
async function remove(s:any){if(!confirm(`Delete ${s.name}? This can remove related records.`))return;const r=await db.from('schools').delete().eq('id',s.id);if(r.error)error.value=r.error.message;else await load()}
</script>
<template><div class="page"><div class="shell admin-section"><NuxtLink to="/dashboard">← Dashboard</NuxtLink><h1>Schools</h1><p>Create schools for intra-school and inter-school competitions.</p><form class="card editor" @submit.prevent="add"><label>School name<input v-model="name" required maxlength="150" placeholder="School name"></label><label>Code (optional)<input v-model="code" maxlength="30" placeholder="SJE"></label><button class="btn" :disabled="busy">Add School</button></form><p v-if="error" class="error">{{error}}</p><p v-if="message" class="success">{{message}}</p><div class="card"><h2>Registered Schools</h2><div v-for="s in rows" :key="s.id" class="data-row"><span>{{s.name}} <small>{{s.code}}</small></span><button class="secondary" @click="remove(s)">Delete</button></div><p v-if="!rows.length">No schools yet.</p></div></div></div></template>
