<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const busy = ref(true)
const error = ref('')
const rows = ref<any[]>([])
const schoolId = ref('')
const schoolName = ref('')
const role = ref('')
const name = ref('')
const colour = ref('#2563eb')
const saving = ref(false)

// Always-visible HSV palette: no browser colour-picker popup required.
const palette = ref<HTMLElement | null>(null)
const hue = ref(217)
const saturation = ref(84)
const brightness = ref(92)

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return '#' + [r, g, b].map(n => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('')
}

function updateColour() {
  colour.value = hsvToHex(hue.value, saturation.value, brightness.value)
}

function selectPalette(event: PointerEvent) {
  if (!palette.value) return
  const bounds = palette.value.getBoundingClientRect()
  saturation.value = Math.max(0, Math.min(100, Math.round(((event.clientX - bounds.left) / bounds.width) * 100)))
  brightness.value = Math.max(0, Math.min(100, Math.round((1 - (event.clientY - bounds.top) / bounds.height) * 100)))
  updateColour()
}

function startPalette(event: PointerEvent) {
  if (event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  selectPalette(event)
}

function movePalette(event: PointerEvent) {
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) selectPalette(event)
}

function paletteKeyboard(event: KeyboardEvent) {
  const delta = event.shiftKey ? 10 : 2
  if (event.key === 'ArrowLeft') saturation.value = Math.max(0, saturation.value - delta)
  else if (event.key === 'ArrowRight') saturation.value = Math.min(100, saturation.value + delta)
  else if (event.key === 'ArrowUp') brightness.value = Math.min(100, brightness.value + delta)
  else if (event.key === 'ArrowDown') brightness.value = Math.max(0, brightness.value - delta)
  else return
  event.preventDefault()
  updateColour()
}

function validColour(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#64748b'
}

async function load() {
  const { data: { user } } = await db.auth.getUser()
  if (!user) { await navigateTo('/login'); return }
  const { data: memberships, error: membershipError } = await db.from('school_memberships')
    .select('school_id,role,schools(name)').eq('user_id', user.id)
  if (membershipError) { error.value = membershipError.message; busy.value = false; return }
  const eligible = (memberships || []).filter(x => ['school_admin', 'teacher'].includes(x.role))
  const requested = typeof route.query.school === 'string' ? route.query.school : ''
  const membership = eligible.find(x => x.school_id === requested) || (!requested ? eligible[0] : null)
  if (!membership) { error.value = 'You do not have access to this school.'; busy.value = false; return }
  schoolId.value = membership.school_id
  role.value = membership.role
  schoolName.value = (membership.schools as any)?.name || 'School'
  await refresh()
  busy.value = false
}

async function refresh() {
  const result = await db.from('school_houses').select('id,name,colour')
    .eq('school_id', schoolId.value).order('name')
  rows.value = result.data || []
  error.value = result.error?.message || ''
}

async function add() {
  if (role.value !== 'school_admin' || !name.value.trim()) return
  saving.value = true
  error.value = ''
  const result = await db.from('school_houses').insert({
    school_id: schoolId.value,
    name: name.value.trim(),
    colour: colour.value
  })
  saving.value = false
  if (result.error) { error.value = result.error.message; return }
  name.value = ''
  await refresh()
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="shell admin-section">
      <NuxtLink to="/school/dashboard">← School Dashboard</NuxtLink>
      <h1>{{ schoolName }} — Houses</h1>
      <p v-if="busy">Loading…</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <template v-if="!busy && schoolId">
        <form v-if="role === 'school_admin'" class="card house-editor" @submit.prevent="add">
          <h2>Add House</h2>
          <label class="house-name">House name
            <input v-model="name" required maxlength="120" placeholder="e.g. Patrick" />
          </label>
          <div class="colour-picker-label">
            <span>House colour</span>
            <div class="palette-layout">
              <div
                ref="palette"
                class="colour-palette"
                :style="{ backgroundColor: `hsl(${hue}, 100%, 50%)` }"
                role="slider"
                tabindex="0"
                aria-label="House colour saturation and brightness"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="saturation"
                :aria-valuetext="`Saturation ${saturation}%, brightness ${brightness}%`"
                @pointerdown="startPalette"
                @pointermove="movePalette"
                @keydown="paletteKeyboard"
              >
                <div class="palette-white"></div>
                <div class="palette-black"></div>
                <span class="palette-cursor" :style="{ left: `${saturation}%`, top: `${100 - brightness}%` }"></span>
              </div>
              <div class="palette-controls">
                <label for="house-hue">Colour spectrum</label>
                <input id="house-hue" v-model.number="hue" type="range" min="0" max="359" class="hue-slider" aria-label="House colour hue" @input="updateColour" />
                <div class="selected-colour"><span class="colour-preview" :style="{ backgroundColor: colour }"></span><span>Selected colour</span></div>
              </div>
            </div>
          </div>
          <button class="btn" :disabled="saving">{{ saving ? 'Saving…' : 'Add House' }}</button>
        </form>
        <div class="card">
          <h2>School Houses</h2>
          <div v-for="house in rows" :key="house.id" class="data-row house-row">
            <span>{{ house.name }}</span>
            <span class="house-colour" :style="{ backgroundColor: validColour(house.colour) }" :aria-label="`${house.name} house colour`" :title="validColour(house.colour)" role="img"></span>
          </div>
          <p v-if="!rows.length">No houses recorded.</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.house-editor { display: flex; align-items: end; gap: 14px; flex-wrap: wrap; }
.house-editor h2 { margin: 0 12px 4px 0; }
.house-editor label { display: flex; flex-direction: column; gap: 8px; }
.house-name { flex: 1 1 240px; }
.house-name input { width: 100%; }
.colour-picker-label { display: flex; flex-direction: column; gap: 8px; flex: 1 1 300px; }
.palette-layout { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.colour-palette { position: relative; width: 230px; height: 135px; max-width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,.4); cursor: crosshair; touch-action: none; overflow: hidden; }
.palette-white, .palette-black { position: absolute; inset: 0; pointer-events: none; }
.palette-white { background: linear-gradient(to right, white, transparent); }
.palette-black { background: linear-gradient(to top, black, transparent); }
.palette-cursor { position: absolute; width: 15px; height: 15px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 1px #111, 0 1px 5px #111; transform: translate(-50%, -50%); pointer-events: none; }
.palette-controls { display: flex; flex-direction: column; gap: 9px; min-width: 145px; }
.palette-controls label { font-size: .9rem; }
.hue-slider { width: 155px; max-width: 100%; height: 17px; cursor: pointer; appearance: none; border-radius: 8px; background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red); border: 1px solid rgba(255,255,255,.35); }
.hue-slider::-webkit-slider-thumb { appearance: none; width: 13px; height: 24px; border-radius: 4px; border: 2px solid white; background: transparent; box-shadow: 0 0 2px #111; }
.hue-slider::-moz-range-thumb { width: 11px; height: 22px; border-radius: 4px; border: 2px solid white; background: transparent; }
.selected-colour { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.colour-preview { width: 36px; height: 28px; border-radius: 6px; border: 1px solid rgba(255,255,255,.5); }
.house-editor .btn { min-height: 46px; }
.house-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
.house-colour { display: inline-block; width: 44px; height: 28px; border-radius: 7px; border: 1px solid rgba(255,255,255,.35); flex-shrink: 0; }
@media (max-width: 620px) { .house-editor .btn { width: 100%; } }
</style>
