/**
 * Give every actionable button a native hover tooltip.
 * Existing explicit titles take precedence; icon-only buttons use their
 * accessible labels, while text buttons use their visible text.
 */
export default defineNuxtPlugin(() => {
  const tooltip = (button: HTMLButtonElement) => {
    if (button.hasAttribute('title')) return
    const label = button.getAttribute('aria-label')
      || button.getAttribute('data-tooltip')
      || button.innerText?.replace(/\s+/g, ' ').trim()
      || button.getAttribute('name')
    if (label) button.title = label
  }

  const update = (root: ParentNode = document) => {
    root.querySelectorAll<HTMLButtonElement>('button').forEach(tooltip)
  }

  // Called as the pointer enters a button so dynamic labels stay current.
  document.addEventListener('pointerover', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!button) return
    // Refresh only automatically generated titles when the label changes.
    if (button.dataset.autoTooltip === 'true') {
      button.removeAttribute('title')
    }
    if (!button.hasAttribute('title')) {
      tooltip(button)
      if (button.hasAttribute('title')) button.dataset.autoTooltip = 'true'
    }
  }, true)

  update()
  const observer = new MutationObserver(() => update())
  observer.observe(document.body, { childList: true, subtree: true })
})
