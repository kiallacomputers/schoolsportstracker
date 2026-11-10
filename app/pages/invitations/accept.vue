<script setup lang="ts">
const route = useRoute()
const db = useSupabaseClient()
const user = useSupabaseUser()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const returnPath = computed(() => `/invitations/accept?token=${encodeURIComponent(token.value)}`)
const registerPath = computed(() => `/invitations/register?redirect=${encodeURIComponent(returnPath.value)}`)
const loginPath = computed(() => `/login?redirect=${encodeURIComponent(returnPath.value)}`)
const busy = ref(false)
const error = ref('')
const success = ref('')
const checking = ref(true)
const attempted = ref(false)

async function accept() {
  if (busy.value || success.value || !token.value || !user.value) return
  busy.value = true
  error.value = ''
  try {
    const { error: rpcError } = await db.rpc('accept_school_admin_invitation', { p_token: token.value })
    if (rpcError) throw rpcError
    success.value = 'Invitation accepted! Your School Administrator access is now active.'
  } catch (e: any) {
    error.value = e?.message || 'Unable to accept invitation.'
  } finally {
    busy.value = false
  }
}

// A first-time visitor goes directly to registration. Returning verified users
// have their invitation accepted automatically, without reopening the email.
onMounted(async () => {
  if (!token.value || !/^[a-f0-9]{64}$/.test(token.value)) {
    error.value = 'This invitation link is invalid. Please request a new invitation.'
    checking.value = false
    return
  }
  // getUser waits for Supabase to process the current session/confirmation URL.
  const { data: { user: currentUser }, error: authError } = await db.auth.getUser()
  checking.value = false
  if (!currentUser && !authError) {
    await navigateTo(registerPath.value, { replace: true })
  } else if (!currentUser) {
    await navigateTo(registerPath.value, { replace: true })
  } else if (!attempted.value) {
    attempted.value = true
    await accept()
  }
})

watch(user, async (currentUser) => {
  if (!checking.value && currentUser && !attempted.value && token.value) {
    attempted.value = true
    await accept()
  }
})
</script>

<template>
  <div class="page"><div class="shell admin-section" style="max-width:760px;margin:2rem auto">
    <NuxtLink class="brand" to="/"><img src="/logo.png" alt="School Sports Tracker logo"><div><strong>SCHOOL SPORTS TRACKER</strong><small>COMPETE · ACHIEVE · INSPIRE</small></div></NuxtLink>
    <section class="auth" style="max-width:none;margin-top:2rem;padding:2rem">
      <h1>School Administrator Invitation</h1>
      <p v-if="checking">Checking your invitation and account…</p>
      <template v-else>
        <p v-if="success" class="success" role="status">{{ success }} <NuxtLink to="/school/dashboard"><u>Go to dashboard</u></NuxtLink></p>
        <p v-else-if="busy">Activating your School Administrator access…</p>
        <template v-else-if="error">
          <p class="error" role="alert">{{ error }}</p>
          <p v-if="user">If you are signed in with a different email address, sign in with the address that received the invitation.</p>
          <NuxtLink v-if="user" class="btn" :to="loginPath">Use another account</NuxtLink>
          <button v-if="user" class="btn" style="margin-left:.5rem" @click="attempted=false;accept()">Try again</button>
        </template>
        <p v-else>Taking you to account registration…</p>
      </template>
    </section>
  </div></div>
</template>
