export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  supabase: { redirect: false },
  app: { head: { title: 'School Sports Tracker', meta: [{ name: 'description', content: 'Compete · Achieve · Inspire — school and inter-school sports management' }], link: [{ rel: 'icon', href: '/logo.png' }] } }
})
