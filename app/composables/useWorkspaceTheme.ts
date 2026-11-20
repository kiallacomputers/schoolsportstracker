import { computed, onMounted, ref, watch } from 'vue'

export type WorkspaceTheme = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'sst-v3-theme'
const preference = ref<WorkspaceTheme>('system')
const systemDark = ref(false)
let listenerAttached = false

export function useWorkspaceTheme() {
  const resolvedTheme = computed(() => preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value)
  onMounted(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference.value = saved
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = media.matches
    if (!listenerAttached) {
      media.addEventListener('change', event => { systemDark.value = event.matches })
      listenerAttached = true
    }
  })
  function setTheme(next: WorkspaceTheme) {
    preference.value = next
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
  }
  return { themePreference: preference, resolvedTheme, setTheme }
}
