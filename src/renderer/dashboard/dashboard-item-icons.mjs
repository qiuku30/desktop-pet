const boundaries = new WeakMap()

const escapeAttribute = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

export function buildDashboardItemIcon(item, { className = '', fallbackSrc = '' } = {}) {
  const hasPrimary = typeof item?.iconSrc === 'string' && item.iconSrc.length > 0
  const stage = hasPrimary ? 'primary' : 'fallback'
  const src = hasPrimary ? item.iconSrc : fallbackSrc
  return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(src)}" data-farm-item-icon="${stage}" data-fallback-src="${escapeAttribute(fallbackSrc)}" alt="" draggable="false">`
}

export function buildDashboardItemAriaLabel(item, count) {
  const safeCount = Number.isSafeInteger(count) && count >= 0 ? count : 0
  return `${escapeAttribute(item?.name)}，数量 ${safeCount}`
}

export function handleDashboardItemIconError(root, event, fallbackSrc) {
  const image = event?.target
  if (!root?.contains?.(image) || !image?.matches?.('img[data-farm-item-icon]')) return 'ignored'
  if (image.dataset.farmItemIcon === 'primary') {
    image.dataset.farmItemIcon = 'fallback'
    image.src = fallbackSrc
    return 'fallback'
  }
  if (image.dataset.farmItemIcon !== 'hidden') {
    image.dataset.farmItemIcon = 'hidden'
    image.hidden = true
    image.removeAttribute('src')
  }
  return 'hidden'
}

export function installDashboardItemIconBoundary(root, fallbackSrc) {
  const existing = boundaries.get(root)
  if (existing) return existing

  const listener = event => handleDashboardItemIconError(root, event, fallbackSrc)
  let disposed = false
  const controller = {
    dispose() {
      if (disposed) return
      disposed = true
      root.removeEventListener('error', listener, true)
      boundaries.delete(root)
    },
  }
  root.addEventListener('error', listener, true)
  boundaries.set(root, controller)
  return controller
}
