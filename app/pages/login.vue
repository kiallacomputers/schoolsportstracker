<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const busy = ref(false)

async function signIn() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
    if (error) throw error
    const { data: role, error: roleError } = await supabase.rpc('is_platform_admin')
    if (roleError) throw roleError
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    const { data: memberships, error: membershipsError } = user
      ? await supabase.from('school_memberships').select('role').eq('user_id', user.id)
      : { data: [], error: null }
    if (membershipsError) throw membershipsError
    const schoolUser = (memberships || []).some(m => m.role === 'school_admin' || m.role === 'teacher')
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      && !route.query.redirect.startsWith('//') && !route.query.redirect.includes('\\')
      ? route.query.redirect : ''
    await navigateTo(redirect || (role === true ? '/dashboard' : schoolUser ? '/school/dashboard' : '/student'), { replace: true })
  } catch (error: any) {
    errorMessage.value = error?.message || 'Unable to sign in. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>
<template><div class="page"><div class="shell"><NuxtLink class="brand" to="/"><img src="/logo.png" alt="Logo"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink><form class="auth" @submit.prevent="signIn"><h1>Sign In</h1><p>Invited school staff and administrators can sign in here.</p><label class="field"><span>Email</span><input v-model="email" type="email" required></label><label class="field"><span>Password</span><input v-model="password" type="password" required></label><p v-if="errorMessage" class="error">{{errorMessage}}</p><button class="btn" :disabled="busy">{{busy?'Signing in…':'Sign In'}}</button><p v-if="typeof route.query.redirect==='string' && route.query.redirect.startsWith('/invitations/accept')">New administrator? <NuxtLink :to="`/invitations/register?redirect=${encodeURIComponent(route.query.redirect)}`"><u>Create an account for your invitation</u></NuxtLink></p></form></div></div></template>
