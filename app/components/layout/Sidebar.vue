<script setup lang="ts">
defineProps<{open:boolean}>()
const emit=defineEmits<{close:[]}>()
const {schoolOptions,schoolId}=useSchool()
const {links}=useNavigation()
const route=useRoute()
watch(()=>route.path,()=>emit('close'))
const menu=ref<HTMLElement|null>(null)
const track=ref<HTMLElement|null>(null)
const scrollTop=ref(0)
const scrollHeight=ref(1)
const clientHeight=ref(1)
const canScroll=computed(()=>scrollHeight.value>clientHeight.value+1)
const thumbHeight=computed(()=>Math.max(28,clientHeight.value*clientHeight.value/scrollHeight.value))
const thumbTop=computed(()=>canScroll.value?scrollTop.value/(scrollHeight.value-clientHeight.value)*Math.max(0,clientHeight.value-thumbHeight.value):0)
function updateScroll(){const el=menu.value;if(!el)return;scrollTop.value=el.scrollTop;scrollHeight.value=el.scrollHeight;clientHeight.value=el.clientHeight}
let observer:ResizeObserver|undefined
onMounted(()=>{updateScroll();observer=new ResizeObserver(updateScroll);if(menu.value)observer.observe(menu.value);const content=menu.value?.firstElementChild;if(content)observer.observe(content)})
onBeforeUnmount(()=>observer?.disconnect())
let dragOffset=0
let dragging=false
function scrollFromPointer(e:PointerEvent){const el=menu.value;const rail=track.value;if(!el||!rail||!canScroll.value)return;const rect=rail.getBoundingClientRect();const range=Math.max(1,rect.height-thumbHeight.value);el.scrollTop=Math.max(0,Math.min(1,(e.clientY-rect.top-dragOffset)/range))*(el.scrollHeight-el.clientHeight)}
function pointerDown(e:PointerEvent){if(!canScroll.value)return;const rect=track.value?.getBoundingClientRect();if(!rect)return;const y=e.clientY-rect.top;dragOffset=y>=thumbTop.value&&y<=thumbTop.value+thumbHeight.value?y-thumbTop.value:thumbHeight.value/2;dragging=true;track.value?.setPointerCapture(e.pointerId);scrollFromPointer(e);e.preventDefault()}
function pointerMove(e:PointerEvent){if(dragging)scrollFromPointer(e)}
function pointerUp(e:PointerEvent){dragging=false;if(track.value?.hasPointerCapture(e.pointerId))track.value.releasePointerCapture(e.pointerId)}
</script>
<template>
<aside :class="open?'translate-x-0':'-translate-x-full lg:translate-x-0'" class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:sticky lg:top-0 lg:h-screen">
  <div class="flex h-20 items-center justify-between px-5"><NuxtLink to="/dashboard" aria-label="School Sports Tracker home" class="flex min-w-0 flex-1 items-center justify-center"><img src="/logo-sidebar.png" alt="School Sports Tracker" class="h-16 w-full max-w-[216px] object-contain object-center" /></NuxtLink><button class="lg:hidden" aria-label="Close menu" @click="emit('close')">✕</button></div>
  <div v-if="schoolOptions.length" class="px-4 pt-5"><label for="school-select" class="mb-2 block text-xs font-semibold text-[var(--muted)]">ACTIVE SCHOOL</label><select id="school-select" v-model="schoolId" class="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"><option v-for="s in schoolOptions" :key="s.id" :value="s.id">{{s.name}}</option></select></div>
  <div class="sidebar-menu relative mt-5 min-h-0 flex-1">
    <nav ref="menu" class="sidebar-scroll h-full space-y-1 overflow-y-auto px-3" aria-label="Workspace navigation" @scroll.passive="updateScroll"><div><NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[var(--panel)]" :class="route.path===link.to.split('?')[0]?'bg-[var(--panel)] text-blue-600':''">{{link.label}}</NuxtLink></div></nav>
    <div v-if="canScroll" ref="track" class="sidebar-scroll-track absolute inset-y-0 right-1 w-[5px] cursor-pointer touch-none" aria-hidden="true" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp"><div class="sidebar-scroll-thumb absolute inset-x-0" :style="{top:thumbTop+'px',height:thumbHeight+'px'}" /></div>
  </div>
  <button class="m-4 rounded-xl border border-[var(--border)] p-3 text-left text-sm" @click="useSupabaseClient().auth.signOut().then(()=>navigateTo('/login'))">Sign out</button>
</aside>
</template>
