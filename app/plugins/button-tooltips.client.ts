/**
 * Fast, accessible hover labels for buttons across Sports Tracker.
 * Native browser title tooltips have a built-in delay, so render our own.
 */
export default defineNuxtPlugin(() => {
  const style = document.createElement('style')
  style.textContent = `
    .sst-button-tooltip {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      max-width: min(320px, calc(100vw - 16px));
      padding: 6px 9px;
      border-radius: 7px;
      background: #ffffff;
      color: #17233b;\n      border: 1px solid #334155;
      font: 500 12px/1.35 system-ui, sans-serif;
      box-shadow: 0 3px 10px rgba(0,0,0,.12);
      white-space: normal;
      overflow-wrap: anywhere;
      opacity: 0;
      visibility: hidden;
      transition: opacity 70ms ease-out;
    }
    .sst-button-tooltip[data-theme="dark"] {
      background: var(--sst-tooltip-bg, #0b1628);
      color: var(--sst-tooltip-ink, #eef5fd);
      border-color: var(--sst-tooltip-border, #344b67);
      box-shadow: 0 3px 12px rgba(0,0,0,.35);
    }
    .sst-button-tooltip[data-visible="true"] { opacity: 1; visibility: visible; }
  `
  document.head.appendChild(style)
  const tip = document.createElement('div')
  tip.className = 'sst-button-tooltip'
  tip.setAttribute('role', 'tooltip')
  document.body.appendChild(tip)

  let active: HTMLButtonElement | null = null
  const labelFor = (button: HTMLButtonElement) => {
    const explicit = button.getAttribute('title')
    if (explicit) {
      button.dataset.sstTooltip = explicit
      button.removeAttribute('title')
    }
    return button.dataset.sstTooltip
      || button.getAttribute('aria-label')
      || button.innerText?.replace(/\\s+/g, ' ').trim()
      || button.getAttribute('name')
      || ''
  }
  const hide = () => {
    tip.dataset.visible = 'false'
    active = null
  }
  const position = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect()
    const bounds = tip.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - bounds.width / 2, window.innerWidth - bounds.width - 8))
    const top = rect.bottom + 8 + bounds.height > window.innerHeight ? rect.top - bounds.height - 8 : rect.bottom + 8
    tip.style.left = left + 'px'
    tip.style.top = Math.max(8, top) + 'px'
  }
  const show = (button: HTMLButtonElement) => {
    const label = labelFor(button)
    if (!label) return hide()
    active = button
    tip.textContent = label
    tip.dataset.visible = 'true'
    position(button)
  }

  // Strip native title attributes, including on buttons rendered later.
  const prepare = (root: ParentNode) => {
    root.querySelectorAll<HTMLButtonElement>('button').forEach(labelFor)
  }
  prepare(document)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLButtonElement) {
        if (record.attributeName === 'title') labelFor(record.target)
      } else {
        record.addedNodes.forEach(node => {
          if (node instanceof HTMLButtonElement) labelFor(node)
          else if (node instanceof Element) prepare(node)
        })
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] })

  document.addEventListener('pointerover', event => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (button instanceof HTMLButtonElement && button !== active) show(button)
  }, true)
  document.addEventListener('pointerout', event => {
    if (active && event.target instanceof Node && active.contains(event.target)) {
      const next = event.relatedTarget
      if (!(next instanceof Node) || !active.contains(next)) hide()
    }
  }, true)
  document.addEventListener('focusin', event => {
    if (event.target instanceof HTMLButtonElement) show(event.target)
  }, true)
  document.addEventListener('focusout', hide, true)
  document.addEventListener('pointerdown', hide, true)
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide() }, true)
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
})
