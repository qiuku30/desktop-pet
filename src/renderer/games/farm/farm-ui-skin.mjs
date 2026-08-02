const ITEM_IDS = Object.freeze([
  'seed:wheat', 'seed:carrot', 'seed:corn', 'seed:strawberry', 'seed:pumpkin', 'seed:star-dew-fruit',
  'crop:wheat', 'crop:carrot', 'crop:corn', 'crop:strawberry', 'crop:pumpkin', 'crop:star-dew-fruit',
  'food:cookie', 'food:popcorn', 'food:carrot-juice', 'food:strawberry-milkshake', 'food:pumpkin-pie', 'food:milk',
])

const deepFreeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function emptyCatalog() {
  return {
    itemIcons: {},
    itemFallback: null,
    workshop: { machine: {}, slots: {} },
    orders: {},
  }
}

function safeBase(manifestUrl) {
  const manifest = new URL(manifestUrl)
  if (!['file:', 'http:', 'https:'].includes(manifest.protocol)) throw new TypeError('unsafe base')
  return new URL('.', manifest)
}

function resolveRecord(record, path, base, errors) {
  if (!record || typeof record !== 'object' || typeof record.src !== 'string' || !record.src) {
    errors.push(`MISSING_UI_RECORD:${path}`)
    return null
  }
  try {
    const raw = record.src
    const decoded = decodeURIComponent(raw)
    if (decoded !== decoded.trim() || /[\u0000-\u001f\u007f]/u.test(decoded)
        || /\\/u.test(decoded) || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(decoded)
        || decoded.startsWith('/') || decoded.startsWith('//')
        || /%2f|%5c/iu.test(raw) || raw.includes('?') || raw.includes('#')
        || !/^[A-Za-z0-9._~!$&+,;=@%/-]+$/.test(raw)) throw new TypeError('unsafe relative path')
    const resolved = new URL(raw, base)
    if (resolved.protocol !== base.protocol || resolved.hostname !== base.hostname
        || resolved.port !== base.port || resolved.username !== base.username
        || resolved.password !== base.password || !resolved.pathname.startsWith(base.pathname)
        || resolved.pathname === base.pathname || resolved.search || resolved.hash) throw new TypeError('outside skin')
    if (base.protocol === 'file:' && (base.hostname || resolved.hostname)) throw new TypeError('file authority')
    return { src: resolved.href }
  } catch {
    errors.push(`INVALID_UI_URL:${path}`)
    return null
  }
}

function resolveSheet(record, path, base, errors) {
  const resolved = resolveRecord(record, path, base, errors)
  if (!resolved) return null
  const fields = ['frameWidth', 'frameHeight', 'frameCount', 'durationMs']
  if (!fields.every(key => Number.isSafeInteger(record[key]) && record[key] > 0)
      || !Number.isSafeInteger(record.frameWidth * record.frameCount)) {
    errors.push(`INVALID_UI_SHEET:${path}`)
    return null
  }
  return { ...resolved, ...Object.fromEntries(fields.map(key => [key, record[key]])) }
}

export function buildFarmUiSkin(manifest, manifestUrl) {
  const errors = []
  const catalog = emptyCatalog()
  let base
  try {
    base = safeBase(manifestUrl)
  } catch {
    errors.push('INVALID_UI_BASE')
    return deepFreeze({ catalog, errors: errors.sort() })
  }
  const ui = manifest?.ui || {}
  for (const id of ITEM_IDS) {
    const record = resolveRecord(ui.itemIcons?.[id], `ui.itemIcons.${id}`, base, errors)
    if (record) catalog.itemIcons[id] = record
  }
  catalog.itemFallback = resolveRecord(ui.itemFallback, 'ui.itemFallback', base, errors)

  const machine = ui.workshop?.machine || {}
  for (const key of ['base', 'workGlow', 'completionFlash']) {
    const record = resolveRecord(machine[key], `ui.workshop.machine.${key}`, base, errors)
    if (record) catalog.workshop.machine[key] = record
  }
  for (const key of ['gearSheet', 'steamSheet']) {
    const record = resolveSheet(machine[key], `ui.workshop.machine.${key}`, base, errors)
    if (record) catalog.workshop.machine[key] = record
  }
  for (const key of ['recipeShelf', 'lockedMask']) {
    const record = resolveRecord(ui.workshop?.[key], `ui.workshop.${key}`, base, errors)
    if (record) catalog.workshop[key] = record
  }
  for (const key of ['running', 'queued', 'empty']) {
    const record = resolveRecord(ui.workshop?.slots?.[key], `ui.workshop.slots.${key}`, base, errors)
    if (record) catalog.workshop.slots[key] = record
  }
  for (const key of ['board', 'paper', 'readyStamp', 'cooldownPaper', 'pin', 'completionOverlay', 'abandonPaper']) {
    const record = resolveRecord(ui.orders?.[key], `ui.orders.${key}`, base, errors)
    if (record) catalog.orders[key] = record
  }
  return deepFreeze({ catalog, errors: errors.sort() })
}
