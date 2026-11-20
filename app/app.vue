<script setup lang="ts">
const route = useRoute()
const transitioning = useState<boolean>('sst-login-transition', () => false)
// Other destinations do not wait for dashboard data.
watch(() => route.path, async (path) => {
  if (!transitioning.value) return
  if (path !== '/login' && path !== '/dashboard' && path !== '/school/dashboard') {
    await nextTick()
    transitioning.value = false
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Transition name="sst-auth-fade">
    <div v-if="transitioning" class="sst-auth-screen" role="status" aria-live="polite" aria-label="Preparing your dashboard">
      <div class="sst-auth-panel">
        <img src="/logo.png" alt="School Sports Tracker" class="sst-auth-logo" />
        <div class="sst-auth-name">SCHOOL SPORTS TRACKER</div>
        <div class="sst-auth-spinner" aria-hidden="true"></div>
        <h2>Preparing your dashboard…</h2>
        <p>Loading your workspace and permissions</p>
      </div>
    </div>
  </Transition>
</template>

<style>
.sst-auth-screen{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 20%,#173c68 0%,#0a203d 48%,#06162c 100%);color:#edf6ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.sst-auth-panel{text-align:center;width:min(100%,430px);padding:38px 24px}
.sst-auth-logo{display:block;width:116px;height:116px;object-fit:contain;margin:0 auto 20px;filter:drop-shadow(0 12px 22px #0007)}
.sst-auth-name{font-size:15px;letter-spacing:.13em;font-weight:800;color:#dcecff}
.sst-auth-spinner{width:38px;height:38px;margin:34px auto 24px;border:3px solid #35618c;border-top-color:#61adff;border-radius:50%;animation:sst-auth-spin .85s linear infinite}
.sst-auth-panel h2{font-size:21px;font-weight:750;margin:0 0 10px}
.sst-auth-panel p{font-size:13px;color:#a7c3e3;margin:0}
.sst-auth-fade-enter-active,.sst-auth-fade-leave-active{transition:opacity .22s ease}
.sst-auth-fade-enter-from,.sst-auth-fade-leave-to{opacity:0}
@keyframes sst-auth-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.sst-auth-spinner{animation:none}.sst-auth-fade-enter-active,.sst-auth-fade-leave-active{transition:none}}
</style>
