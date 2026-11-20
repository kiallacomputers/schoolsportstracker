export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  supabase: { redirect: false },
  runtimeConfig: { schoolEnquiryServiceKey: '', public: { turnstileSiteKey: '' } },
  app: { head: { title: 'School Sports Tracker', meta: [{ name: 'description', content: 'School sports and competition management' }] } }
})
