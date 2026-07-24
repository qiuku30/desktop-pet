export const SCHEMA_VERSION = 1

export const STANDARD_ACTIONS = Object.freeze([
  'idle',
  'walk',
  'eat',
  'happy',
  'sad',
  'interact',
  'sleep',
])

const ACTION_SET = new Set(STANDARD_ACTIONS)
const SKIN_ID_RE = /^[a-z0-9][a-z0-9-]*$/
const IMAGE_EXT_RE = /\.(png|webp)$/i

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isSafeAssetPath(path) {
  if (typeof path !== 'string' || path.length === 0) return false
  if (path.includes('\\') || path.includes('?') || path.includes('#')) return false
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return false
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) return false
  if (!IMAGE_EXT_RE.test(path)) return false
  return !path.split('/').some(
    (segment) => segment === '' || segment === '.' || segment === '..',
  )
}

function validateAnimation(errors, prefix, animation) {
  if (!isObject(animation)) {
    errors.push(`${prefix} must be an object`)
    return
  }

  if (!Number.isFinite(animation.fps) || animation.fps < 1 || animation.fps > 60) {
    errors.push(`${prefix}.fps must be between 1 and 60`)
  }
  if (typeof animation.loop !== 'boolean') {
    errors.push(`${prefix}.loop must be boolean`)
  }
  if (!Array.isArray(animation.frames) || animation.frames.length === 0) {
    errors.push(`${prefix}.frames must be a non-empty array`)
    return
  }
  animation.frames.forEach((frame, index) => {
    if (!isSafeAssetPath(frame)) {
      errors.push(`${prefix}.frames[${index}] must be a safe relative asset path`)
    }
  })
}

function findFallbackCycle(fallbacks) {
  for (const start of STANDARD_ACTIONS) {
    const seen = new Set()
    let current = start
    while (fallbacks[current]) {
      if (seen.has(current)) return current
      seen.add(current)
      current = fallbacks[current]
    }
  }
  return null
}

function validateForm(errors, formId, form) {
  const prefix = `forms.${formId}`
  if (!isObject(form)) {
    errors.push(`${prefix} must be an object`)
    return
  }

  if (!Number.isInteger(form.unlockLevel) || form.unlockLevel < 1) {
    errors.push(`${prefix}.unlockLevel must be an integer >= 1`)
  }
  if (!Number.isFinite(form.scale) || form.scale <= 0) {
    errors.push(`${prefix}.scale must be a positive number`)
  }
  if (
    !isObject(form.anchor)
    || !Number.isFinite(form.anchor.x)
    || !Number.isFinite(form.anchor.y)
    || form.anchor.x < 0
    || form.anchor.x > 1
    || form.anchor.y < 0
    || form.anchor.y > 1
  ) {
    errors.push(`${prefix}.anchor must contain x/y between 0 and 1`)
  }
  if (typeof form.flipX !== 'boolean') {
    errors.push(`${prefix}.flipX must be boolean`)
  }

  const animations = isObject(form.animations) ? form.animations : {}
  if (!isObject(form.animations)) errors.push(`${prefix}.animations must be an object`)
  if (!animations.idle) errors.push(`${prefix}.animations.idle is required`)

  for (const [action, animation] of Object.entries(animations)) {
    if (!ACTION_SET.has(action)) {
      errors.push(`${prefix}.animations.${action} is not a standard action`)
      continue
    }
    validateAnimation(errors, `${prefix}.animations.${action}`, animation)
  }

  const fallbacks = form.fallbacks
  if (fallbacks === undefined) return
  if (!isObject(fallbacks)) {
    errors.push(`${prefix}.fallbacks must be an object`)
    return
  }

  for (const [action, target] of Object.entries(fallbacks)) {
    if (!ACTION_SET.has(action)) {
      errors.push(`${prefix}.fallbacks.${action} is not a standard action`)
    } else if (!ACTION_SET.has(target)) {
      errors.push(`${prefix}.fallbacks.${action} must target a standard action`)
    }
  }

  const cycleAt = findFallbackCycle(fallbacks)
  if (cycleAt) errors.push(`${prefix}.fallbacks contains a cycle at ${cycleAt}`)
}

export function validateSkinManifest(manifest) {
  const errors = []
  if (!isObject(manifest)) {
    return { valid: false, errors: ['manifest must be an object'] }
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal ${SCHEMA_VERSION}`)
  }
  if (typeof manifest.id !== 'string' || !SKIN_ID_RE.test(manifest.id)) {
    errors.push('id must match /^[a-z0-9][a-z0-9-]*$/')
  }
  if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
    errors.push('name must be a non-empty string')
  }
  if (!isSafeAssetPath(manifest.portrait)) {
    errors.push('portrait must be a safe relative asset path')
  }

  const forms = isObject(manifest.forms) ? manifest.forms : {}
  if (!isObject(manifest.forms) || Object.keys(forms).length === 0) {
    errors.push('forms must be a non-empty object')
  }
  if (typeof manifest.defaultFormId !== 'string' || !forms[manifest.defaultFormId]) {
    errors.push('defaultFormId must reference an existing form')
  }

  for (const [formId, form] of Object.entries(forms)) {
    if (!SKIN_ID_RE.test(formId)) {
      errors.push(`form id ${formId} must match /^[a-z0-9][a-z0-9-]*$/`)
      continue
    }
    validateForm(errors, formId, form)
  }

  return { valid: errors.length === 0, errors }
}

export function selectFormId(manifest, level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
  const unlocked = Object.entries(manifest.forms)
    .filter(([, form]) => form.unlockLevel <= safeLevel)
    .sort((a, b) => b[1].unlockLevel - a[1].unlockLevel)
  return unlocked[0]?.[0] || manifest.defaultFormId
}

export function resolveAnimation(form, action) {
  if (!ACTION_SET.has(action)) return null

  const visited = new Set()
  let current = action
  while (!visited.has(current)) {
    visited.add(current)
    const config = form.animations?.[current]
    if (config) return { action: current, config }
    current = form.fallbacks?.[current]
    if (!current || !ACTION_SET.has(current)) return null
  }
  return null
}
