<script setup lang="ts">
definePageMeta({layout:'workspace'})

const db = useSupabaseClient()
const {schoolId, schoolOptions} = useSchool()
const {isAdmin} = useSchoolPermissions()
const school = computed(() => schoolOptions.value.find(option => option.id === schoolId.value))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const loadedSchool = ref('')
const fieldClass = 'mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm'
const initial = () => ({
  month: 12,
  day: 31,
  lanes: 8,
  capacity: '' as number | '',
  points: '10, 8, 6, 5, 4, 3, 2, 1',
  multiplier: 1 as number | '',
  ties: true
})
const form = reactive(initial())
const months = Array.from({length:12}, (_, index) =>
  new Intl.DateTimeFormat('en-AU', {month:'long', timeZone:'UTC'}).format(Date.UTC(2000, index, 1)))
const dayCount = computed(() => new Date(Date.UTC(2000, form.month, 0)).getUTCDate())
watch(dayCount, count => { form.day = Math.min(form.day, count) })

watch([schoolId, isAdmin], async ([id, admin], _, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  loadedSchool.value = ''
  loading.value = false
  notice.value = ''
  error.value = ''
  if (!id || !admin) return
  loading.value = true
  const result = await db.from('school_meet_defaults')
    .select('age_reference_date,race_lanes,event_capacity,placing_points,team_multiplier,allow_ties')
    .eq('school_id', id).maybeSingle()
  if (!current) return
  loading.value = false
  if (result.error) {
    error.value = result.error.message
    return
  }
  const row = result.data
  if (row) {
    const [, month, day] = row.age_reference_date.split('-').map(Number)
    Object.assign(form, {
      month, day, lanes: row.race_lanes, capacity: row.event_capacity ?? '',
      points: row.placing_points.join(', '), multiplier: Number(row.team_multiplier), ties: row.allow_ties
    })
  } else Object.assign(form, initial())
  loadedSchool.value = id
}, {immediate:true})

async function save() {
  const id = schoolId.value
  if (!id || loadedSchool.value !== id || !isAdmin.value || saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const points = parseMeetPoints(form.points)
    if (!Number.isInteger(form.lanes) || form.lanes < 1 || form.lanes > 12) throw new Error('Enter 1 to 12 race lanes.')
    if (form.capacity !== '' && (!Number.isInteger(form.capacity) || form.capacity < 1 || form.capacity > 10000)) throw new Error('Enter a capacity from 1 to 10,000 or leave it blank.')
    const multiplier = form.multiplier
    if (multiplier === '' || multiplier < 0 || multiplier > 20 || Math.abs(multiplier * 100 - Math.round(multiplier * 100)) > 1e-8) throw new Error('Enter a team multiplier from 0 to 20 with up to two decimal places.')
    const date = ['2000', String(form.month).padStart(2, '0'), String(form.day).padStart(2, '0')].join('-')
    const {error:saveError} = await db.from('school_meet_defaults').upsert({
      school_id: id, age_reference_date: date, race_lanes: form.lanes, event_capacity: form.capacity === '' ? null : form.capacity,
      placing_points: points, team_multiplier: multiplier, allow_ties: form.ties
    })
    if (saveError) throw saveError
    if (schoolId.value === id) notice.value = 'Meet defaults saved.'
  } catch (cause: any) {
    if (schoolId.value === id) error.value = cause.message || 'Unable to save meet defaults.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader title="School settings" :description="school?.name" />
    <p v-if="error" role="alert" class="rounded-xl border border-red-500 p-4 text-sm">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm">{{ notice }}</p>
    <UiPanel v-if="!isAdmin">School administrators manage meet defaults.</UiPanel>
    <UiPanel v-else-if="loading">Loading school settings…</UiPanel>
    <form v-else-if="loadedSchool" class="max-w-4xl space-y-5" @submit.prevent="save">
      <UiPanel>
        <div class="mb-5">
          <h2 class="text-lg font-bold">Meet defaults</h2>
          <p class="mt-1 text-sm text-[var(--muted)]">New school meets use these defaults. Adjust age and scoring within the meet, or set lane count and capacity when adding an event.</p>
        </div>
        <fieldset :disabled="saving" class="grid gap-5 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <p id="age-reference" class="text-sm font-semibold">Reference date for age groups</p>
            <div class="grid max-w-xs grid-cols-[5rem_1fr] gap-2" role="group" aria-labelledby="age-reference">
              <select v-model.number="form.day" :class="fieldClass" aria-label="Day">
                <option v-for="day in dayCount" :key="day" :value="day">{{ day }}</option>
              </select>
              <select v-model.number="form.month" :class="fieldClass" aria-label="Month">
                <option v-for="(month, index) in months" :key="month" :value="index+1">{{ month }}</option>
              </select>
            </div>
          </div>
          <label class="text-sm font-semibold">Race lanes per event
            <input v-model.number="form.lanes" :class="fieldClass" type="number" min="1" max="12" required />
          </label>
          <label class="text-sm font-semibold">Maximum entries per event
            <input v-model.number="form.capacity" :class="fieldClass" type="number" min="1" max="10000" placeholder="No limit" />
            <span class="mt-1 block font-normal text-[var(--muted)]">Applies to individuals or teams, depending on the event.</span>
          </label>
        </fieldset>
      </UiPanel>
      <UiPanel>
        <h2 class="mb-4 text-lg font-bold">Scoring by place</h2>
        <fieldset :disabled="saving" class="grid gap-5 sm:grid-cols-2">
          <label class="text-sm font-semibold sm:col-span-2">Points from first place onwards
            <input v-model="form.points" :class="fieldClass" required />
            <span class="mt-1 block font-normal text-[var(--muted)]">Separate each placing’s points with a comma.</span>
          </label>
          <label class="text-sm font-semibold">Team points multiplier
            <input v-model.number="form.multiplier" :class="fieldClass" type="number" min="0" max="20" step="0.01" required />
          </label>
          <label class="flex items-center gap-2 text-sm font-semibold">
            <input v-model="form.ties" type="checkbox" /> Allow tied placings
          </label>
        </fieldset>
      </UiPanel>
      <div class="flex justify-end">
        <button type="submit" :disabled="saving" class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {{ saving ? 'Saving…' : 'Save settings' }}
        </button>
      </div>
    </form>
  </div>
</template>
