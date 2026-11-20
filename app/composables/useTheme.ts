const currentTheme = ref<'light'|'dark'>('light')
export function useTheme() {
  onMounted(() => { currentTheme.value = localStorage.getItem('sst-theme') === 'dark' ? 'dark' : 'light' })
  function toggle() { currentTheme.value = currentTheme.value === 'light' ? 'dark' : 'light'; if (import.meta.client) localStorage.setItem('sst-theme',currentTheme.value) }
  return { theme:readonly(currentTheme), toggle }
}
