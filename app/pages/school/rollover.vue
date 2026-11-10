<script setup lang="ts">
const db = useSupabaseClient()
const route = useRoute()
const schoolId = computed(() => typeof route.query.school === 'string' ? route.query.school : '')
const sourceYear = ref(new Date().getFullYear())
const busy = ref(true)
const running = ref(false)
const error = ref('')
const success = ref('')
const schoolName = ref('School')
const permitted = ref(false)
const preview = ref({promoted:0,graduated:0,skipped:0,missing:0,existing:0,active:0})
const confirmed = ref(false)
const typedYear = ref('')
const destinationYear = computed(() => sourceYear.value + 1)
const canRun = computed(() => permitted.value && !busy.value && !running.value && preview.value.existing === 0 && preview.value.active > 0 && confirmed.value && typedYear.value.trim() === String(destinationYear.value))
async function load() {
  busy.value = true; error.value = ''; success.value = ''; confirmed.value = false; typedYear.value = ''; permitted.value = false
  try {
    const {data:{user},error:authError} = await db.auth.getUser()
    if (authError) throw authError
    if (!user) { await navigateTo('/login'); return }
    if (!schoolId.value) throw new Error('Choose a school from the dashboard before opening Year Rollover.')
    const [platform,member,school] = await Promise.all([
      db.rpc('is_platform_admin'),
      db.from('school_memberships').select('role').eq('school_id',schoolId.value).eq('user_id',user.id).maybeSingle(),
      db.from('schools').select('name').eq('id',schoolId.value).maybeSingle()
    ])
    if (platform.error) throw platform.error
    if (member.error) throw member.error
    permitted.value = platform.data === true || member.data?.role === 'school_admin'
    if (!permitted.value) throw new Error('Only School Administrators and SuperAdmins can run a year rollover.')
    if (school.error) throw school.error
    schoolName.value = school.data?.name || 'School'
    const [studentResult,sourceResult,destResult] = await Promise.all([
      db.from('students').select('id,is_active').eq('school_id',schoolId.value).limit(10000),
      db.from('student_enrolments').select('student_id,year_level').eq('school_id',schoolId.value).eq('school_year',sourceYear.value).limit(10000),
      db.from('student_enrolments').select('id').eq('school_id',schoolId.value).eq('school_year',destinationYear.value).limit(1)
    ])
    for (const result of [studentResult,sourceResult,destResult]) if (result.error) throw result.error
    const activeIds = new Set((studentResult.data || []).filter(s=>s.is_active !== false).map(s=>s.id))
    const activeRows = (sourceResult.data || []).filter(e=>activeIds.has(e.student_id))
    const levels = activeRows.map(e=>String(e.year_level || '').trim())
    preview.value = {
      promoted: levels.filter(l=>/^(7|8|9|10|11)$/.test(l)).length,
      graduated: levels.filter(l=>l==='12').length,
      skipped: levels.filter(l=>!/^(7|8|9|10|11|12)$/.test(l)).length,
      missing: [...activeIds].filter(id=>!activeRows.some(e=>e.student_id===id)).length,
      existing: (destResult.data || []).length,
      active: activeRows.length
    }
  } catch (e:any) { error.value = e.message || 'Unable to prepare rollover.' }
  finally { busy.value = false }
}
onMounted(load)
watch([schoolId,sourceYear], load)
async function execute() {
  if (!canRun.value) return
  running.value = true; error.value = ''; success.value = ''
  try {
    const {data,error:rpcError} = await db.rpc('school_rollover_students', {p_school:schoolId.value,p_from_year:sourceYear.value})
    if (rpcError) throw rpcError
    const result:any = Array.isArray(data) ? data[0] : data
    const completedYear = destinationYear.value
    await load()
    success.value = `Rollover to ${completedYear} completed: ${result?.promoted_count ?? 0} promoted, ${result?.graduated_count ?? 0} Year 12 students disabled, ${result?.skipped_count ?? 0} skipped.`
  } catch (e:any) { error.value = e.message || 'Rollover failed. No changes should have been committed.' }
  finally { running.value = false }
}
</script>
<template>
  <div class="mx-auto max-w-5xl space-y-6 text-slate-100">
    <header class="space-y-2">
      <h1 class="text-3xl font-bold">Student Year Rollover</h1>
      <p class="text-slate-300">{{ schoolName }} · Promote students into the next school year while preserving historical records.</p>
    </header>
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/60 bg-red-950/70 p-4 text-red-100">{{ error }}</p>
    <p v-if="success" role="status" class="rounded-xl border border-emerald-500/60 bg-emerald-950/70 p-4 text-emerald-100">{{ success }}</p>
    <section class="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4">
      <h2 class="text-xl font-semibold">1. Select the school year</h2>
      <label class="block max-w-xs space-y-2"><span class="text-sm text-slate-300">Current school year</span><input v-model.number="sourceYear" type="number" min="2000" max="2199" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" /></label>
      <p class="text-lg font-semibold">{{ sourceYear }} → {{ destinationYear }}</p>
    </section>
    <section class="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4">
      <h2 class="text-xl font-semibold">2. What will happen?</h2>
      <ul class="list-disc space-y-2 pl-6 text-slate-200">
        <li>Active students in Years 7–11 advance one year (Year 7 → 8, through Year 11 → 12).</li>
        <li>Active Year 12 students are disabled and will not be available for new event registrations.</li>
        <li>House assignments are carried forward for promoted students.</li>
        <li>Existing student details, previous-year enrolments, event entries and sporting results remain intact.</li>
        <li>Students with missing or unsupported year levels are not promoted. Inactive students are not promoted.</li>
        <li>New Year 7 students are not created automatically; import them separately.</li>
      </ul>
    </section>
    <section class="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4">
      <h2 class="text-xl font-semibold">3. Review the preview</h2>
      <p v-if="busy" class="text-slate-300">Checking student records…</p>
      <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="rounded-xl bg-slate-800 p-4"><div class="text-sm text-slate-300">To promote</div><div class="text-2xl font-bold">{{preview.promoted}}</div></div>
        <div class="rounded-xl bg-slate-800 p-4"><div class="text-sm text-slate-300">Year 12 to disable</div><div class="text-2xl font-bold">{{preview.graduated}}</div></div>
        <div class="rounded-xl bg-slate-800 p-4"><div class="text-sm text-slate-300">Unsupported levels</div><div class="text-2xl font-bold">{{preview.skipped}}</div></div>
        <div class="rounded-xl bg-slate-800 p-4"><div class="text-sm text-slate-300">Active without enrolment</div><div class="text-2xl font-bold">{{preview.missing}}</div></div>
      </div>
      <p class="text-sm text-slate-400">Preview counts are informational. The database validates the current records again when you confirm.</p>
      <p v-if="preview.existing" class="rounded-xl border border-amber-500 bg-amber-950/50 p-4 text-amber-100" role="alert">Rollover blocked: student enrolments already exist for {{ destinationYear }}. This prevents overwriting or running the rollover twice. Resolve the existing records before proceeding.</p>
      <p v-else-if="!busy && preview.active===0" class="rounded-xl border border-amber-500 bg-amber-950/50 p-4 text-amber-100">No active student enrolments were found for {{sourceYear}}. Rollover cannot proceed.</p>
    </section>
    <section class="rounded-2xl border border-amber-600/70 bg-slate-900 p-6 space-y-4">
      <h2 class="text-xl font-semibold">4. Safeguards and confirmation</h2>
      <ul class="list-disc space-y-2 pl-6 text-slate-200">
        <li>Only a School Administrator for this school or a SuperAdmin can run the operation.</li>
        <li>The database performs the rollover as one transaction: an error rolls back the entire operation.</li>
        <li>Existing next-year enrolments block the operation instead of being overwritten.</li>
        <li>A school-level database lock prevents concurrent rollover requests.</li>
        <li>Confirmation requires acknowledging the impact and typing the destination year.</li>
      </ul>
      <label class="flex items-start gap-3"><input v-model="confirmed" type="checkbox" class="mt-1" :disabled="busy || running || !!preview.existing" /><span>I have reviewed the preview, confirmed the source year, and understand that Year 12 students will be disabled.</span></label>
      <label class="block max-w-xs space-y-2"><span class="text-sm text-slate-300">Type <strong>{{destinationYear}}</strong> to confirm</span><input v-model="typedYear" :disabled="busy || running || !!preview.existing" type="text" inputmode="numeric" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" placeholder="Destination year" /></label>
      <div class="flex flex-wrap gap-3"><button type="button" class="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" :disabled="!canRun" @click="execute">{{running ? 'Rolling over…' : 'Confirm and Roll Over Students'}}</button><NuxtLink :to="`/school/students?school=${encodeURIComponent(schoolId)}`" class="rounded-lg border border-slate-600 px-5 py-3 text-white">Back to Students</NuxtLink></div>
    </section>
  </div>
</template>
