export const useAdmin = () => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const admin = useState<boolean>('sst-admin', () => false)
  const checked = useState<boolean>('sst-admin-checked', () => false)
  async function verify() {
    const { data: { user: verifiedUser }, error } = await client.auth.getUser()
    if (error || !verifiedUser) { admin.value = false; checked.value = true; return false }
    // platform_admins has no SELECT policy in Phase 1; use the RLS-safe RPC instead.
    const { data: isAdmin, error: rpcError } = await client.rpc('is_platform_admin')
    admin.value = !rpcError && isAdmin === true
    checked.value = true
    return admin.value
  }
  return { user, admin, checked, verify }
}
