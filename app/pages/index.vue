<script setup lang="ts">
useSeoMeta({title:'School Sports Tracker | School sport, made simple',description:'Manage school athletics, swimming, competitions, race-day results and school records in one place.'})
const features=[
{title:'Competition management',description:'Organise school athletics, swimming and sporting competitions with a clear, central workspace.',icon:'trophy'},
{title:'Student participation',description:'Keep students, houses and event participation organised across your school.',icon:'users'},
{title:'Race day & results',description:'Support event-day administration, scoring and results in one place.',icon:'flag'},
{title:'Records & achievements',description:'Celebrate student achievements and keep track of school sporting records.',icon:'medal'}
]
</script>
<template>
<div class="sst min-h-screen">
  <header class="border-b border-[var(--border)] bg-[var(--surface)]">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <NuxtLink to="/" aria-label="School Sports Tracker home" class="flex items-center"><img src="/logo.png" alt="School Sports Tracker" class="h-20 w-auto max-w-[230px] object-contain sm:h-24" /></NuxtLink>
      <nav aria-label="Public navigation" class="flex flex-wrap items-center gap-3">
        <a href="#features" class="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Features</a>
        <a href="#plans" class="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Plans & Pricing</a>
        <NuxtLink to="/login" class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Login</NuxtLink>
      </nav>
    </div>
  </header>
  <main>
    <section class="bg-gradient-to-br from-blue-50 via-white to-slate-100">
      <div class="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
        <div>
          <p class="mb-5 text-sm font-bold uppercase tracking-[.2em] text-blue-700">Compete · Achieve · Inspire</p>
          <h1 class="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-[#172b45] sm:text-5xl lg:text-6xl">School sport, made simple.</h1>
          <p class="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">Bring school athletics, swimming, competitions, student participation, results and records together in one easy-to-manage platform.</p>
          <div class="mt-9 flex flex-wrap gap-3">
            <NuxtLink to="/request-school" class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700">School Registration <span aria-hidden="true" class="ml-2">→</span></NuxtLink>
            <NuxtLink to="/login" class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-[#172b45] hover:bg-slate-50">School Login</NuxtLink>
          </div>
          <p class="mt-4 text-sm text-slate-500">For schools, staff and authorised users.</p>
        </div>
        <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
          <div class="mb-6 flex items-center justify-between"><span class="text-lg font-extrabold text-[#172b45]">One place for school sport</span><span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">School Sports Tracker</span></div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div v-for="(feature,index) in features" :key="feature.title" class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <svg v-if="index===0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg>
                <svg v-else-if="index===1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>
                <svg v-else-if="index===2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V3M5 4h14l-4 5 4 5H5"/></svg>
                <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/></svg>
              </div>
              <h2 class="font-bold text-[#172b45]">{{feature.title}}</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">{{feature.description}}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section id="features" class="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <p class="text-sm font-bold uppercase tracking-widest text-blue-700">Built for schools</p>
      <h2 class="mt-3 text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">Less administration. More sport.</h2>
      <p class="mt-4 max-w-3xl text-lg text-[var(--muted)]">From preparing a competition to celebrating the results, School Sports Tracker helps your school stay organised.</p>
      <div class="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <article v-for="feature in features" :key="feature.title" class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 class="text-lg font-bold text-[var(--ink)]">{{feature.title}}</h3>
          <p class="mt-3 text-sm leading-relaxed text-[var(--muted)]">{{feature.description}}</p>
        </article>
      </div>
    </section>
    <section id="plans" class="border-y border-[var(--border)] bg-[var(--panel)]">
      <div class="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center">
        <div><p class="text-sm font-bold uppercase tracking-widest text-blue-700">Coming soon</p><h2 class="mt-3 text-3xl font-extrabold text-[var(--ink)]">School Plans & Pricing</h2><p class="mt-3 max-w-2xl text-[var(--muted)]">We're preparing school subscription plans and online purchasing. Pricing and purchasing aren't available yet.</p></div>
        <span class="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700">Coming Soon</span>
      </div>
    </section>
    <section class="mx-auto max-w-7xl px-5 py-20 text-center sm:px-8">
      <h2 class="text-3xl font-extrabold text-[var(--ink)]">Ready to get your school involved?</h2>
      <p class="mx-auto mt-4 max-w-2xl text-[var(--muted)]">Start with school registration or sign in to your existing workspace.</p>
      <div class="mt-8 flex flex-wrap justify-center gap-3"><NuxtLink to="/request-school" class="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">School Registration</NuxtLink><NuxtLink to="/login" class="rounded-xl border border-[var(--border)] px-6 py-3 font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Login</NuxtLink></div>
    </section>
  </main>
  <footer class="border-t border-[var(--border)] bg-[var(--surface)]"><div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:px-8"><span>© {{new Date().getFullYear()}} School Sports Tracker</span><span>Compete · Achieve · Inspire</span></div></footer>
</div>
</template>