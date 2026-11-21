<script setup lang="ts">
useSeoMeta({title:'School Sports Tracker | Every achievement starts here',description:'A welcoming home for school athletics, swimming, competition management, results and sporting achievements.'})
const menuOpen=ref(false)
const sports=[
{title:'Athletics',description:'From track to field, make every school athletics event count.',image:'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1000&q=85',alt:'Runners on an athletics track'},
{title:'Swimming',description:'Bring clarity and excitement to swimming carnivals and race-day results.',image:'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1000&q=85',alt:'Swimming pool lanes'},
{title:'Results & Records',description:'Recognise performances, celebrate milestones and remember achievements.',image:'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=85',alt:'Athletics competition in a stadium'}
]
const benefits=[{number:'01',title:'Plan with confidence',description:'Bring competitions, events and school sport administration together.'},{number:'02',title:'Run a smoother event',description:'Keep participation, race-day activities and results organised.'},{number:'03',title:'Celebrate every achievement',description:'Highlight student results and school sporting records.'}]
</script>
<template>
<div class="sst min-h-screen bg-white text-[#172b45]">
  <header class="relative z-20 border-b border-[#e4eaf2] bg-white">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
      <NuxtLink to="/" aria-label="School Sports Tracker homepage" class="shrink-0"><img src="/logo.png" alt="School Sports Tracker" class="h-20 w-auto max-w-[215px] object-contain sm:h-24" /></NuxtLink>
      <nav class="hidden items-center gap-7 md:flex" aria-label="Main navigation">
        <a href="#discover" class="text-sm font-semibold text-[#52677f] transition hover:text-blue-700">Discover</a>
        <a href="#features" class="text-sm font-semibold text-[#52677f] transition hover:text-blue-700">Features</a>
        <a href="#plans" class="text-sm font-semibold text-[#52677f] transition hover:text-blue-700">Plans & Pricing</a>
        <NuxtLink to="/login" class="rounded-xl border border-[#d6e2f1] px-5 py-3 text-sm font-bold text-[#172b45] transition hover:bg-blue-50">Login</NuxtLink>
        <NuxtLink to="/request-school" class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700">Register Your School</NuxtLink>
      </nav>
      <button type="button" class="rounded-xl border border-[#dbe4ee] p-3 text-[#172b45] md:hidden" :aria-expanded="menuOpen" aria-label="Toggle navigation" @click="menuOpen=!menuOpen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-if="menuOpen" d="M18 6 6 18M6 6l12 12"/><path v-else d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
    <nav v-if="menuOpen" class="flex flex-col gap-2 border-t border-[#e4eaf2] bg-white px-5 py-5 md:hidden" aria-label="Mobile navigation"><a href="#discover" class="rounded-lg px-3 py-3 font-semibold" @click="menuOpen=false">Discover</a><a href="#features" class="rounded-lg px-3 py-3 font-semibold" @click="menuOpen=false">Features</a><a href="#plans" class="rounded-lg px-3 py-3 font-semibold" @click="menuOpen=false">Plans & Pricing</a><NuxtLink to="/login" class="rounded-lg border border-[#dbe4ee] px-3 py-3 font-semibold">Login</NuxtLink><NuxtLink to="/request-school" class="rounded-lg bg-blue-600 px-3 py-3 text-center font-semibold text-white">Register Your School</NuxtLink></nav>
  </header>
  <main>
    <section class="relative isolate overflow-hidden bg-[#f5f9ff]">
      <div class="pointer-events-none absolute -right-32 -top-40 h-[560px] w-[560px] rounded-full bg-[#e0efff] blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute -bottom-48 left-[-180px] h-[400px] w-[400px] rounded-full bg-[#eaf2ff] blur-3xl" aria-hidden="true"></div>
      <div class="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:gap-16 lg:py-24">
        <div>
          <span class="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[.16em] text-blue-700 shadow-sm"><span class="h-2 w-2 rounded-full bg-blue-600"></span>Welcome to School Sports Tracker</span>
          <h1 class="mt-7 max-w-2xl text-5xl font-black leading-[1.08] tracking-tight text-[#172b45] sm:text-6xl xl:text-7xl">Every student.<br/>Every event.<br/><span class="text-blue-600">Every achievement.</span></h1>
          <p class="mt-7 max-w-xl text-lg leading-8 text-[#52677f]">Make school sport an experience worth celebrating. Bring athletics, swimming, competitions, participation and results together in one welcoming place.</p>
          <div class="mt-9 flex flex-wrap gap-3"><NuxtLink to="/request-school" class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">Register Your School <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></NuxtLink><NuxtLink to="/login" class="rounded-xl border border-[#cbd9e9] bg-white px-7 py-4 font-bold text-[#172b45] transition hover:bg-blue-50">School Login</NuxtLink></div>
          <p class="mt-6 flex items-center gap-2 text-sm font-medium text-[#61738a]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Compete · Achieve · Inspire</p>
        </div>
        <div class="relative mx-auto w-full max-w-[640px]">
          <div class="absolute -inset-[5px] rotate-1 rounded-[2.2rem] bg-[#d9e9fc]" aria-hidden="true"></div>
          <div class="relative overflow-hidden rounded-[2rem] border-[6px] border-white bg-[#dbeafe] shadow-2xl shadow-[#adc5df]/60">
            <img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1400&q=90" alt="Athletics competitors taking part in a sporting event" class="h-[340px] w-full object-cover sm:h-[490px] lg:h-[530px]" />
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102944]/95 via-[#102944]/55 to-transparent px-7 pb-[37px] pt-28 text-white sm:pb-[41px]">
              <p class="text-xs font-bold uppercase tracking-[.2em] text-blue-200">The moments that matter</p>
              <p class="mt-2 text-2xl font-extrabold sm:text-3xl">Let every achievement shine.</p>
            </div>
          </div>
          <div class="relative z-10 mx-4 -mt-8 w-fit max-w-[calc(100%-2rem)] rounded-2xl border border-[#e1eaf4] bg-white px-5 py-4 shadow-xl sm:mx-6 sm:-mt-9"><div class="flex items-center gap-3"><span class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/></svg></span><div><p class="text-sm font-extrabold text-[#172b45]">Celebrate success</p><p class="text-xs text-[#61738a]">From participation to records</p></div></div></div>
        </div>
      </div>
    </section>
    <section id="discover" class="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div class="mx-auto max-w-3xl text-center"><p class="text-sm font-extrabold uppercase tracking-[.2em] text-blue-700">Made for school sport</p><h2 class="mt-4 text-4xl font-black tracking-tight text-[#172b45] sm:text-5xl">All the excitement. Less of the admin.</h2><p class="mt-5 text-lg leading-8 text-[#61738a]">Give your school community more time to focus on participation, teamwork and those unforgettable sporting moments.</p></div>
      <div class="mt-12 grid gap-6 md:grid-cols-3"><article v-for="sport in sports" :key="sport.title" class="group overflow-hidden rounded-3xl border border-[#e0e9f3] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"><div class="overflow-hidden bg-blue-50"><img :src="sport.image" :alt="sport.alt" loading="lazy" class="h-56 w-full object-cover transition duration-500 group-hover:scale-105" /></div><div class="p-7"><h3 class="text-2xl font-extrabold text-[#172b45]">{{sport.title}}</h3><p class="mt-3 leading-7 text-[#61738a]">{{sport.description}}</p></div></article></div>
    </section>
    <section id="features" class="border-y border-[#e5edf6] bg-[#f6f9fd]"><div class="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div class="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><p class="text-sm font-extrabold uppercase tracking-[.2em] text-blue-700">A better way to manage sport</p><h2 class="mt-4 text-4xl font-black leading-tight text-[#172b45]">One platform.<br/>So many possibilities.</h2><p class="mt-5 leading-8 text-[#61738a]">Designed to support the people who make school sport happen.</p></div><div class="grid gap-5 sm:grid-cols-3"><article v-for="benefit in benefits" :key="benefit.number" class="rounded-2xl border border-[#e0e9f3] bg-white p-6 shadow-sm"><span class="text-3xl font-black text-blue-200">{{benefit.number}}</span><h3 class="mt-5 text-lg font-extrabold text-[#172b45]">{{benefit.title}}</h3><p class="mt-3 text-sm leading-7 text-[#61738a]">{{benefit.description}}</p></article></div></div></div></section>
    <section id="plans" class="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div class="flex flex-col items-start justify-between gap-7 rounded-[2rem] border border-[#dbe7f5] bg-gradient-to-r from-[#eff6ff] to-white p-8 sm:p-12 md:flex-row md:items-center"><div><span class="text-sm font-extrabold uppercase tracking-[.18em] text-blue-700">Coming soon</span><h2 class="mt-3 text-3xl font-black text-[#172b45] sm:text-4xl">School Plans & Pricing</h2><p class="mt-4 max-w-2xl leading-7 text-[#61738a]">We're preparing school subscription options and online purchasing. Plans and purchases are not available yet.</p></div><span class="shrink-0 rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-extrabold text-blue-700 shadow-sm">Coming Soon</span></div></section>
    <section class="bg-[#f5f9ff] px-5 py-20 text-center sm:px-8"><div class="mx-auto max-w-3xl"><p class="text-sm font-extrabold uppercase tracking-[.2em] text-blue-700">Your school. Your sporting story.</p><h2 class="mt-4 text-4xl font-black text-[#172b45] sm:text-5xl">Ready to get started?</h2><p class="mt-5 text-lg text-[#61738a]">Join us in making school sport easier to manage and more rewarding to celebrate.</p><div class="mt-9 flex flex-wrap justify-center gap-3"><NuxtLink to="/request-school" class="rounded-xl bg-blue-600 px-7 py-4 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700">Register Your School</NuxtLink><NuxtLink to="/login" class="rounded-xl border border-[#cbd9e9] bg-white px-7 py-4 font-bold text-[#172b45] hover:bg-blue-50">Login</NuxtLink></div></div></section>
  </main>
  <footer class="border-t border-[#e0e9f3] bg-white"><div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[#61738a] sm:px-8"><span>© {{new Date().getFullYear()}} School Sports Tracker</span><span>Compete · Achieve · Inspire</span></div></footer>
</div>
</template>