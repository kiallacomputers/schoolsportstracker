<script setup lang="ts">
const config=useRuntimeConfig()
const siteKey=String(config.public.turnstileSiteKey||'')
const form=reactive({schoolName:'',domain:'',code:'',website:'',firstName:'',lastName:'',position:'',email:'',phone:'',notes:'',websiteTrap:''})
const logo=ref<File|null>(null),preview=ref(''),busy=ref(false),error=ref(''),success=ref(false),token=ref('')
const turnstile=ref<HTMLElement|null>(null)
let widgetId:string|undefined
function onFile(e:Event){const f=(e.target as HTMLInputElement).files?.[0];if(preview.value)URL.revokeObjectURL(preview.value);logo.value=null;preview.value='';if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>2097152){error.value='Choose a PNG, JPG or WebP under 2 MB.';return}logo.value=f;preview.value=URL.createObjectURL(f)}
onMounted(()=>{if(!siteKey)return;const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>{const api=(window as any).turnstile;if(api&&turnstile.value)widgetId=api.render(turnstile.value,{sitekey:siteKey,callback:(v:string)=>token.value=v,'expired-callback':()=>token.value=''})};document.head.appendChild(script)})
onBeforeUnmount(()=>{if(preview.value)URL.revokeObjectURL(preview.value);if(widgetId)(window as any).turnstile?.remove(widgetId)})
async function submit(){error.value='';if(!token.value){error.value='Complete the verification challenge.';return}busy.value=true;try{const body=new FormData();for(const [k,v] of Object.entries(form))body.append(k,v);body.append('turnstileToken',token.value);if(logo.value)body.append('logo',logo.value);await $fetch('/api/school-enquiries',{method:'POST',body});success.value=true}catch(e:any){error.value=e?.data?.statusMessage||e?.message||'Unable to submit request';token.value='';if(widgetId)(window as any).turnstile?.reset(widgetId)}finally{busy.value=false}}
</script>
<template>
<div class="page"><div class="shell admin-section"><NuxtLink to="/">← Home</NuxtLink><h1>Request a School</h1><p>Interested in bringing School Sports Tracker to your school? Send us your details. No account is required.</p>
<p class="notice">Requests are reviewed privately by the School Sports Tracker SuperAdmin. Submitting a request does not create a school account or grant access.</p>
<div v-if="success" class="card"><h2>Request received</h2><p>Thank you. Your school enquiry is now pending review. We will contact you using the email address provided.</p></div>
<form v-else class="card" @submit.prevent="submit" style="display:grid;gap:22px">
<section><h2>School details</h2><div class="request-grid"><label>School name *<input v-model="form.schoolName" required maxlength="150"></label><label>School email domain *<input v-model="form.domain" required placeholder="school.vic.edu.au"></label><label>School code (optional)<input v-model="form.code" maxlength="30"></label><label>School website (optional)<input v-model="form.website" type="url" placeholder="https://school.edu.au"></label><label>School logo (optional, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" @change="onFile"></label><img v-if="preview" :src="preview" alt="School logo preview" style="max-height:100px;max-width:160px;object-fit:contain"></div></section>
<section><h2>School contact</h2><div class="request-grid"><label>First name *<input v-model="form.firstName" required maxlength="70"></label><label>Last name *<input v-model="form.lastName" required maxlength="70"></label><label>Position at school *<input v-model="form.position" required maxlength="120"></label><label>Contact email address *<input v-model="form.email" type="email" required autocomplete="email"></label><label>Contact phone (optional)<input v-model="form.phone" type="tel" maxlength="50"></label></div><label>Additional information<textarea v-model="form.notes" rows="3" maxlength="1800"></textarea></label></section>
<div class="request-trap" aria-hidden="true"><label>Leave blank<input v-model="form.websiteTrap" tabindex="-1" autocomplete="off"></label></div>
<div ref="turnstile"></div><p v-if="!siteKey" class="error">School enquiries are not yet configured. Contact the site administrator.</p><p v-if="error" class="error" role="alert">{{error}}</p><button class="btn" :disabled="busy||!siteKey">{{busy?'Submitting…':'Submit School Request'}}</button>
</form></div></div>
</template>
<style scoped>.request-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;margin:16px 0 22px}.request-grid label,section>label{display:flex;flex-direction:column;gap:6px;min-width:0}.request-grid input,section textarea{width:100%;box-sizing:border-box}.request-trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}</style>
