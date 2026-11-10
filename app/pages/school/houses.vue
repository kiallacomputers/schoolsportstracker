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
const editingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const notice = ref('')

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

function hexToHsv(hex: string) {
  const safe = validColour(hex)
  const r = parseInt(safe.slice(1, 3), 16) / 255
  const g = parseInt(safe.slice(3, 5), 16) / 255
  const b = parseInt(safe.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min
  let h = 0
  if (diff) {
    if (max === r) h = ((g - b) / diff) % 6
    else if (max === g) h = (b - r) / diff + 2
    else h = (r - g) / diff + 4
    h = (h * 60 + 360) % 360
  }
  return { h: Math.round(h), s: max ? Math.round(diff / max * 100) : 0, v: Math.round(max * 100) }
}

function editHouse(house: any) {
  if (role.value !== 'school_admin') return
  editingId.value = house.id
  name.value = house.name
  colour.value = validColour(house.colour)
  const hsv = hexToHsv(colour.value)
  hue.value = hsv.h; saturation.value = hsv.s; brightness.value = hsv.v
  notice.value = ''; error.value = ''
  document.getElementById('house-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function cancelEdit() {
  editingId.value = null
  name.value = ''
  notice.value = ''
  error.value = ''
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
  error.value = ''; notice.value = ''
  const result = editingId.value
    ? await db.from('school_houses').update({ name: name.value.trim(), colour: colour.value })
        .eq('id', editingId.value).eq('school_id', schoolId.value).select('id')
    : await db.from('school_houses').insert({
        school_id: schoolId.value, name: name.value.trim(), colour: colour.value
      }).select('id')
  saving.value = false
  if (result.error) { error.value = result.error.message; return }
  if (!result.data?.length) { error.value = 'No house was changed. Check your school permissions.'; return }
  notice.value = editingId.value ? 'House updated successfully.' : 'House added successfully.'
  editingId.value = null
  name.value = ''
  await refresh()
}

async function deleteHouse(house: any) {
  if (role.value !== 'school_admin' || deletingId.value) return
  if (!window.confirm(`Permanently delete the house "${house.name}"? This cannot be undone and may be blocked if students or results are linked to it.`)) return
  deletingId.value = house.id
  error.value = ''; notice.value = ''
  const result = await db.from('school_houses').delete()
    .eq('id', house.id).eq('school_id', schoolId.value).select('id')
  deletingId.value = null
  if (result.error) { error.value = `Could not delete ${house.name}: ${result.error.message}`; return }
  if (!result.data?.length) { error.value = 'House was not deleted. Check your school permissions.'; return }
  if (editingId.value === house.id) cancelEdit()
  notice.value = `House "${house.name}" deleted.`
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
      <p v-if="notice" role="status">{{ notice }}</p>
      <template v-if="!busy && schoolId">
        <form v-if="role === 'school_admin'" id="house-editor" class="card house-editor" @submit.prevent="add">
          <h2>{{ editingId ? 'Edit House' : 'Add House' }}</h2>
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
          <button class="btn" :disabled="saving">{{ saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add House' }}</button>
          <button v-if="editingId" type="button" class="btn cancel-btn" :disabled="saving" @click="cancelEdit">Cancel</button>
        </form>
        <div class="card">
          <h2>School Houses</h2>
          <div v-for="house in rows" :key="house.id" class="data-row house-row">
            <span>{{ house.name }}</span>
            <div class="house-actions">
              <span class="house-colour" :style="{ backgroundColor: validColour(house.colour) }" :aria-label="`${house.name} house colour`" :title="validColour(house.colour)" role="img"></span>
              <template v-if="role === 'school_admin'">
                <button type="button" class="action-btn" :disabled="saving || !!deletingId" :aria-label="`Edit ${house.name}`" @click="editHouse(house)">Edit</button>
                <button type="button" class="action-btn delete-btn" :disabled="saving || !!deletingId" :aria-label="`Delete ${house.name}`" @click="deleteHouse(house)">{{ deletingId === house.id ? 'Deleting…' : 'Delete' }}</button>
              </template>
            </div>
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

<style scoped>
.house-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.action-btn { background:transparent; color:inherit; border:1px solid rgba(255,255,255,.35); border-radius:7px; padding:7px 13px; cursor:pointer; }
.action-btn:hover { background:rgba(255,255,255,.12); }
.action-btn:disabled { opacity:.5; cursor:not-allowed; }
.delete-btn { border-color:#ef7777; color:#ffb6b6; }
.cancel-btn { background:transparent; border:1px solid rgba(255,255,255,.4); }
</style>
