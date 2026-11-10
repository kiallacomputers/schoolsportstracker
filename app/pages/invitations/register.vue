<script setup lang="ts">
const route = useRoute()
const db = useSupabaseClient()
const user = useSupabaseUser()
const redirect = computed(() => {
  const v = route.query.redirect
  if (typeof v !== 'string' || !v.startsWith('/invitations/accept?token=') || v.includes('\\') || v.startsWith('//')) return ''
  const parsed = new URL(v, 'https://example.invalid')
  return /^[a-f0-9]{64}$/.test(parsed.searchParams.get('token') || '') ? v : ''
})
const loginPath = computed(() => `/login?redirect=${encodeURIComponent(redirect.value || '/dashboard')}`)
const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const busy = ref(false)
const error = ref('')
const message = ref('')

async function register() {
  error.value = ''
  message.value = ''
  if (!redirect.value) { error.value = 'Invitation link is missing or invalid.'; return }
  busy.value = true
  try {
    const { data, error: signupError } = await db.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        data: { full_name: `${firstName.value.trim()} ${lastName.value.trim()}` },
        emailRedirectTo: `${window.location.origin}${redirect.value}`
      }
    })
    if (signupError) throw signupError
    if (data.session) {
      await navigateTo(redirect.value)
      return
    }
    message.value = 'Account created. Check your inbox and click the verification link. You will return to your invitation automatically. If prompted to sign in, your invitation will still be saved.'
  } catch (e: any) {
    error.value = e?.message || 'Unable to create account.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  if (!redirect.value) return
  const { data: { user: currentUser } } = await db.auth.getUser()
  if (currentUser) await navigateTo(redirect.value, { replace: true })
})
</script>

<template>
  <div class="page"><div class="shell admin-section" style="max-width:720px;margin:2rem auto">
    <NuxtLink class="brand" to="/"><img src="/logo.png" alt="School Sports Tracker logo"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink>
    <form class="auth" style="max-width:none;margin-top:1.5rem;padding:2rem" @submit.prevent="register">
      <h1>Activate your School Administrator invitation</h1>
      <p>Create your account using the email address that received the invitation. After verifying your email, we'll return you to your invitation and activate your access.</p>
      <p v-if="!redirect" class="error" role="alert">Your invitation link is missing or invalid. Please use the link in the original invitation email.</p>
      <template v-else>
        <label class="field"><span>First name</span><input v-model="firstName" required maxlength="100" autocomplete="given-name"></label>
        <label class="field"><span>Last name</span><input v-model="lastName" required maxlength="100" autocomplete="family-name"></label>
        <label class="field"><span>Invited email address</span><input v-model="email" required type="email" autocomplete="email"></label>
        <label class="field"><span>Password (minimum 8 characters)</span><input v-model="password" required type="password" minlength="8" autocomplete="new-password"></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="message" class="success" role="status">{{ message }}</p>
        <button class="btn" :disabled="busy || !!message">{{ busy ? 'Creating account…' : 'Create account & continue' }}</button>
        <p style="margin-top:1rem">Already have an account? <NuxtLink :to="loginPath"><u>Sign in instead</u></NuxtLink></p>
      </template>
    </form>
  </div></div>
</template>
