<script setup lang="ts">definePageMeta({layout:'workspace'});const db=useSupabaseClient();const {schoolId,schoolOptions}=useSchool();const route=useRoute();const user=useSupabaseUser();const {organizationLevel}=useNavigation();const view=computed(()=>String(route.query.view||'organizations'));const counts=ref({students:0,houses:0,staff:0,competitions:0});const competitions=ref<any[]>([]);const error=ref('');const loading=ref(false);async function load(){if(!schoolId.value)return;loading.value=true;try{const id=schoolId.value;const [s,h,m,c]=await Promise.all([db.from('students').select('id',{count:'exact',head:true}).eq('school_id',id),db.from('school_houses').select('id',{count:'exact',head:true}).eq('school_id',id),db.from('school_memberships').select('user_id',{count:'exact',head:true}).eq('school_id',id),db.from('competitions').select('id,name,status,school_year').eq('organiser_school_id',id).limit(10)]);const failure=[s,h,m,c].find(x=>x.error)?.error;if(failure)throw failure;counts.value={students:s.count||0,houses:h.count||0,staff:m.count||0,competitions:c.data?.length||0};competitions.value=c.data||[]}catch(e:any){error.value=e?.message||'Unable to load dashboard'}finally{loading.value=false}}watch([schoolId,organizationLevel],()=>{if(!organizationLevel.value)void load()},{immediate:true})</script><template><div v-if="organizationLevel" class="space-y-6"><template v-if="view==='organizations'"><UiPageHeader title="Your Schools" description="Manage your schools">
  <template #actions>
    <NuxtLink to="/request-school" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
      <LayoutNavIcon name="plus" /> Request a school
    </NuxtLink>
  </template>
</UiPageHeader>
<UiPanel>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-[var(--border)] text-[var(--muted)]">
        <tr><th scope="col" class="py-3">School</th><th scope="col" class="p-3">Code</th><th scope="col" class="py-3 text-right">Action</th></tr>
      </thead>
      <tbody class="divide-y divide-[var(--border)]">
        <tr v-for="school in schoolOptions" :key="school.id">
          <th scope="row" class="py-3 font-semibold">{{ school.name }}</th>
          <td class="p-3">{{ school.code || '—' }}</td>
          <td class="py-3 text-right">
            <NuxtLink :to="{path:'/school/competitions',query:{school:school.id}}" :aria-label="'Open ' + school.name" class="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-2 font-semibold text-blue-600 hover:bg-[var(--panel)]">
              <LayoutNavIcon name="open" /> Open school
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-if="!schoolOptions.length" class="py-8 text-center text-sm text-[var(--muted)]">No schools are available on your account.</p>
</UiPanel></template><template v-else-if="view==='administrators'"><UiPageHeader title="Administrators" description="Manage administrators within your schools"/><UiPanel><div v-for="school in schoolOptions" :key="school.id" class="flex items-center justify-between border-b border-[var(--border)] py-3"><span>{{school.name}}</span><NuxtLink :to="{path:'/school/staff',query:{school:school.id}}" @click="schoolId=school.id" class="text-blue-600 font-semibold">Manage staff and administrators</NuxtLink></div></UiPanel></template><template v-else-if="view==='account'"><UiPageHeader title="Account" description="Your SportsTracker account"/><UiPanel><p class="text-sm">Signed in as {{user?.email}}</p></UiPanel></template><template v-else-if="view==='news'"><UiPageHeader title="What's New" description="SportsTracker updates"/><UiPanel>Release notes will appear here.</UiPanel></template><template v-else><UiPageHeader title="Support" description="SportsTracker help and support"/><UiPanel>Support resources will appear here.</UiPanel></template></div><div v-else class="space-y-7"><UiPageHeader title="Overview" description="Your school sports workspace"/><p v-if="error" role="alert" class="text-red-600">{{error}}</p><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><UiStatCard title="Students" :value="counts.students"/><UiStatCard title="Houses" :value="counts.houses"/><UiStatCard title="Staff" :value="counts.staff"/><UiStatCard title="Competitions" :value="counts.competitions"/></div><UiPanel><h2 class="mb-4 text-lg font-bold">Recent competitions</h2><p v-if="loading">Loading…</p><div v-else class="divide-y divide-[var(--border)]"><NuxtLink v-for="c in competitions" :key="c.id" :to="{path:'/school/competitions',query:{school:schoolId,competition:c.id}}" class="flex justify-between py-4 text-sm"><span class="font-semibold">{{c.name}}</span><span class="text-[var(--muted)]">{{c.status}}</span></NuxtLink><p v-if="!competitions.length" class="py-4 text-sm text-[var(--muted)]">No competitions yet.</p></div></UiPanel></div></template>