export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return
  const { verify } = useAdmin()
  const client = useSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return navigateTo('/login')
  if (!await verify()) return navigateTo('/dashboard')
})
