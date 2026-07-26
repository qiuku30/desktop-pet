export function createPageNavigationCoordinator({
  initialPageId,
  resolvePage,
  beforeNavigate = async () => {},
  onDeactivate = () => {},
  onActivate = () => {},
  onError = () => {},
}) {
  let currentPageId = initialPageId
  let pendingPageId = null
  let navigationToken = 0
  let pageCleanup = null

  const renderedCleanup = rendered => {
    const cleanup = typeof rendered === 'function' ? rendered : rendered?.cleanup
    if (typeof cleanup !== 'function') return null
    let called = false
    return () => {
      if (called) return
      called = true
      cleanup()
    }
  }

  return {
    get currentPageId() {
      return currentPageId
    },

    get pendingPageId() {
      return pendingPageId
    },

    async navigate(pageId) {
      const page = resolvePage(pageId)
      if (!page || typeof page.render !== 'function') return false
      if (currentPageId === pageId && pendingPageId === null) return true

      const token = ++navigationToken
      pendingPageId = pageId

      try {
        await beforeNavigate(pageId)
        if (token !== navigationToken) return false

        currentPageId = null
        onDeactivate()
        if (pageCleanup) {
          const cleanup = pageCleanup
          pageCleanup = null
          cleanup()
        }

        const rendered = await page.render()
        const cleanup = renderedCleanup(rendered)
        if (token !== navigationToken) {
          cleanup?.()
          return false
        }

        try {
          if (typeof rendered?.activate === 'function') rendered.activate()
          onActivate(pageId)
        } catch (error) {
          cleanup?.()
          throw error
        }
        pageCleanup = cleanup
        currentPageId = pageId
        pendingPageId = null
        return true
      } catch (error) {
        if (token !== navigationToken) return false
        pendingPageId = null
        onError(pageId, error)
        return false
      }
    },

    dispose() {
      navigationToken += 1
      pendingPageId = null
      if (!pageCleanup) return
      const cleanup = pageCleanup
      pageCleanup = null
      cleanup()
    },
  }
}
