<script setup lang="ts">
withDefaults(defineProps<{maxHeight?:string}>(),{maxHeight:'none'})
const viewport=ref<HTMLElement|null>(null),track=ref<HTMLElement|null>(top=ref(0),total=ref(1),visible=ref(1)
const scrollable=computed(()=>total.value>visible.value+1)
const thumbHeight=computed(()=>Math.min(visible.value,Math.max(28,visible.value*visible.value/total.value)))
const thumbTop=computed(()=>scrollable.value?top.value/(total.value-visible.value)*Math.max(0,visible.value-thumbHeight.value):0)
function update(){const e=viewport.value;if(!e)return;top.value=e.scrollTop;total.value=e.scrollHeight;visible.value=e.clientHeight}
let observer:ResizeObserver|undefined
onMounted(()=>{nextTick(update);observer=new ResizeObserver(update);if(viewport.value)observer.observe(viewport.value);if(viewport.value?.firstElementChild)observer.observe(viewport.value.firstElementChild)})
onBeforeUnmount(()=>observer?.disconnect())
let dragging=false,offset=0
function move(e:PointerEvent){const v=viewport.value,t=track.value;if(!v||!t||!scrollable.value)return;const r=t.getBoundingClientRect();const range=Math.max(1,r.height-thumbHeight.value);v.scrollTop=Math.max(0,Math.min(1,(e.clientY-r.top-offset)/range))*(v.scrollHeight-v.clientHeight)}
function down(e:PointerEvent){if(!scrollable.value)return;const r=track.value?.getBoundingClientRect();if(!r)return;const y=e.clientY-r.top;offset=y>=thumbTop.value&&y<=thumbTop.value+thumbHeight.value?y-thumbTop.value:thumbHeight.value/2;dragging=true;track.value?.setPointerCapture(e.pointerId);move(e);e.preventDefault()}
function up(e:PointerEvent){dragging=false;if(track.value?.hasPointerCapture(e.pointerId))track.value.releasePointerCapture(e.pointerId)}
</script>
<template><div class="sidebar-menu relative min-h-0" :style="{maxHeight}"><div ref="viewport" class="sidebar-scroll overflow-y-auto" :style="{maxHeight}" @scroll.passive="update"><div><slot/></div></div><div v-if="scrollable" ref="track" class="sidebar-scroll-track absolute inset-y-0 right-1 w-[5px] cursor-pointer touch-none" aria-hidden="true" @pointerdown="down" @pointermove="e=>{if(dragging)move(e)}" @pointerup="up" @pointercancel="up"><div class="sidebar-scroll-thumb absolute inset-x-0" :style="{top:thumbTop+'px',height:thumbHeight+'px'}"/></div></div></template>