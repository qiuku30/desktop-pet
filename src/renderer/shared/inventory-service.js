function validCount(value) {
  return Number.isInteger(value) && value > 0
}

const LEGACY_FOOD_IDS = Object.freeze({
  apple: 'food:apple',
  cake: 'food:cake',
  fish: 'food:fish',
  milk: 'food:milk',
  cookie: 'food:cookie',
})

export function normalizeInventory(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, count]) => validCount(count)),
  )
}

export function getItemCount(inventory, itemId) {
  return normalizeInventory(inventory)[itemId] || 0
}

export function canRemoveItems(inventory, requirements) {
  const source = normalizeInventory(inventory)
  return Object.entries(normalizeInventory(requirements))
    .every(([id, count]) => (source[id] || 0) >= count)
}

export function addItems(inventory, additions) {
  const source = normalizeInventory(inventory)
  const validAdditions = normalizeInventory(additions)
  const totals = {}

  for (const [id, count] of Object.entries(validAdditions)) {
    const total = (source[id] || 0) + count
    if (!Number.isSafeInteger(total) || total <= 0) {
      throw new RangeError(`inventory count overflow for "${id}"`)
    }
    totals[id] = total
  }

  return { ...source, ...totals }
}

export function removeItems(inventory, requirements) {
  const source = normalizeInventory(inventory)
  const needed = normalizeInventory(requirements)
  const missing = {}

  for (const [id, count] of Object.entries(needed)) {
    if ((source[id] || 0) < count) {
      missing[id] = count - (source[id] || 0)
    }
  }

  if (Object.keys(missing).length) {
    return { ok: false, inventory, missing }
  }

  const next = { ...source }
  for (const [id, count] of Object.entries(needed)) {
    next[id] -= count
    if (next[id] === 0) delete next[id]
  }

  return { ok: true, inventory: next, missing: {} }
}

export function migrateLegacyFoodInventory(state) {
  if ((state?.inventoryMigrationVersion || 0) >= 1) {
    if (!Object.hasOwn(state || {}, 'foodInventory')) {
      return { state, migrated: false }
    }
    const { foodInventory: _legacy, ...cleanState } = state
    return { state: cleanState, migrated: true }
  }

  let inventory = normalizeInventory(state?.inventory)
  const legacyEntries = Array.isArray(state?.foodInventory)
    ? state.foodInventory
    : []

  for (const entry of legacyEntries) {
    if (!entry || !validCount(entry.count)) continue
    if (typeof entry.id !== 'string' || entry.id.trim().length === 0) continue

    let itemId = LEGACY_FOOD_IDS[entry.id]
    if (!itemId) {
      console.warn('[Inventory] Unknown legacy food id preserved:', entry.id)
      itemId = `legacy:${entry.id}`
    }
    inventory = addItems(inventory, { [itemId]: entry.count })
  }

  const { foodInventory: _legacy, ...cleanState } = state || {}
  return {
    migrated: true,
    state: {
      ...cleanState,
      inventory,
      inventoryMigrationVersion: 1,
    },
  }
}
