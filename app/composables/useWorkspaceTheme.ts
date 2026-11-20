import { computed, onMounted, ref } from 'vue'

export type WorkspaceTheme = 'light' | 'dark'
const STORAGE_KEY = 'sst-v3-theme'
const preference = ref<WorkspaceTheme>('light')

export function useWorkspaceTheme() {
  const resolvedTheme = computed(() => preference.value)
  onMounted(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    // Old 'system' selections migrate to the new light default.
    preference.value = saved === 'dark' ? 'dark' : 'light'
  })
  function setTheme(next: WorkspaceTheme) {
    preference.value = next
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
  }
  return { themePreference: preference, resolvedTheme, setTheme }
}
