import { computed, onMounted, ref } from 'vue'
type Theme = 'light' | 'dark'
const preference = ref<Theme>('light')
export function useAppTheme() {
  onMounted(() => { preference.value = localStorage.getItem('sst-theme') === 'dark' ? 'dark' : 'light' })
  const theme = computed(() => preference.value)
  function setTheme(value: Theme) { preference.value = value; if (import.meta.client) localStorage.setItem('sst-theme', value) }
  function toggleTheme() { setTheme(preference.value === 'light' ? 'dark' : 'light') }
  return { theme, setTheme, toggleTheme }
}
