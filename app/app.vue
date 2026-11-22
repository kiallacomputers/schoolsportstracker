<script setup lang="ts">
const loading = ref(true)
const workspacePending = useState('sst-workspace-pending', () => false)
const browserReady = ref(false)
const nuxtApp = useNuxtApp()
let finishTimer: ReturnType<typeof setTimeout> | undefined

function finishLoading() {
  if (import.meta.server) return
  if (!browserReady.value || workspacePending.value) return
  // Wait until the browser has painted the hydrated page before revealing it.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    loading.value = false
  }))
}

onMounted(() => {
  const reveal = () => {
    browserReady.value = true
    nextTick(() => finishLoading())
  }
  if (document.readyState === 'complete') reveal()
  else window.addEventListener('load', reveal, { once: true })
  // Safety net: a slow external resource must not leave the site blocked forever.
  finishTimer = setTimeout(reveal, 12000)
})

watch(workspacePending, (pending) => { if (!pending) nextTick(() => finishLoading()) })

nuxtApp.hook('page:start', () => {
  if (import.meta.client) loading.value = true
})
nuxtApp.hook('page:finish', () => {
  if (import.meta.client) nextTick(() => finishLoading())
})
onUnmounted(() => { if (finishTimer) clearTimeout(finishTimer) })
</script>

<template>
  <div>
    <div v-if="loading" role="status" aria-live="polite" aria-label="Loading SportsTracker" class="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-[#f8fafc] text-[#10294c]">
      <div class="flex items-center gap-2" aria-hidden="true">
        <span v-for="i in 5" :key="i" class="sports-loading-dot h-3 w-3 rounded-full bg-blue-600" :style="{ animationDelay: ((i - 1) * 0.13) + 's' }"></span>
      </div>
      <p class="text-sm font-semibold tracking-wide">Loading SportsTracker…</p>
    </div>
    <div :class="{ 'invisible': loading }"><NuxtLayout><NuxtPage /></NuxtLayout></div>
  </div>
</template>

<style>
@keyframes sports-loading-circle {
  0%, 100% { transform: translateY(0) scale(0.8); opacity: 0.35; }
  50% { transform: translateY(-12px) scale(1.15); opacity: 1; }
}
.sports-loading-dot { animation: sports-loading-circle 0.9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .sports-loading-dot { animation: none; opacity: 1; }
}
</style>
