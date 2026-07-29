const APPROVED_INTENTS = new Set([
  'select-tile',
  'open-processing',
  'open-orders',
  'claim-bird',
  'click-pet',
])

function approvedIntent(intent) {
  if (!intent || !APPROVED_INTENTS.has(intent.type)) return null
  if (intent.type === 'select-tile') {
    return typeof intent.tileId === 'string' && intent.tileId.length > 0
      ? { type: intent.type, tileId: intent.tileId }
      : null
  }
  if (intent.type === 'claim-bird') {
    return typeof intent.birdId === 'string' && intent.birdId.length > 0
      ? { type: intent.type, birdId: intent.birdId }
      : null
  }
  return { type: intent.type }
}

export function createFarmSceneStatic({
  container,
  backgroundSrc,
  hitTargets = [],
  onIntent,
}) {
  if (!container || typeof backgroundSrc !== 'string' || typeof onIntent !== 'function') {
    throw new TypeError('container, trusted backgroundSrc and onIntent are required')
  }

  let root = null
  let destroyed = false
  const listeners = []

  function mount() {
    if (destroyed || root) return
    const documentRef = container.ownerDocument || globalThis.document
    if (!documentRef?.createElement) throw new Error('DOM_UNAVAILABLE')

    root = documentRef.createElement('div')
    root.className = 'farm-scene-static'
    const background = documentRef.createElement('img')
    background.className = 'farm-scene-static__background'
    background.src = backgroundSrc
    background.alt = ''
    root.appendChild(background)

    for (const targetRecord of hitTargets) {
      const intent = approvedIntent(targetRecord?.intent)
      if (!intent) continue
      const button = documentRef.createElement('button')
      button.type = 'button'
      button.className = 'farm-scene-static__hit-target'
      button.textContent = targetRecord.label || intent.type
      const listener = () => {
        if (!destroyed) onIntent(Object.freeze({ ...intent }))
      }
      button.addEventListener('click', listener)
      listeners.push([button, listener])
      root.appendChild(button)
    }
    container.appendChild(root)
  }

  function update() {
    // Static visuals are intentionally independent from business state.
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    for (const [button, listener] of listeners) {
      button.removeEventListener('click', listener)
    }
    listeners.length = 0
    root?.remove()
    root = null
  }

  return Object.freeze({ mount, update, destroy })
}
