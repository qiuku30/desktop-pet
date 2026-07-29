const REQUIRED_ASSET_RECORDS = Object.freeze([
  ['background'],
  ['land', 'level1'],
  ['pet', 'idle'],
  ['effects', 'plant'],
  ['effects', 'harvest'],
  ['ui', 'recipeCookie'],
  ['ui', 'orderPaper'],
])
const SKIN_ROOT_URL = 'file:///__farm_skin__/'
const SKIN_ROOT_PATH = '/__farm_skin__/'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function valueAt(source, segments) {
  let value = source
  for (const segment of segments) {
    if (!isRecord(value)) return undefined
    value = value[segment]
  }
  return value
}

function isSafeAssetPath(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false
  let decoded
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return false
  }
  if (decoded.length === 0 || decoded.trim() !== decoded) return false
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return false
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(decoded)) return false
  if (decoded.startsWith('/') || decoded.includes('\\')) return false
  if (decoded.includes('?') || decoded.includes('#')) return false
  let normalized
  try {
    normalized = new URL(decoded, SKIN_ROOT_URL)
  } catch {
    return false
  }
  return (
    normalized.protocol === 'file:'
    && normalized.hostname === ''
    && normalized.search === ''
    && normalized.hash === ''
    && normalized.pathname.startsWith(SKIN_ROOT_PATH)
    && normalized.pathname !== SKIN_ROOT_PATH
  )
}

function validateAssetRecord(errors, record, dotPath) {
  if (typeof record.src !== 'string' || record.src.length === 0) {
    errors.push(`MISSING_ASSET_PATH:${dotPath}`)
  } else if (!isSafeAssetPath(record.src)) {
    errors.push(`UNSAFE_ASSET_PATH:${dotPath}`)
  }

  if (record.anchor !== undefined) {
    const anchor = record.anchor
    if (
      !isRecord(anchor)
      || !Number.isFinite(anchor.x)
      || !Number.isFinite(anchor.y)
      || anchor.x < 0
      || anchor.x > 1
      || anchor.y < 0
      || anchor.y > 1
    ) {
      errors.push(`INVALID_ANCHOR:${dotPath}`)
    }
  }

  if (
    record.durationMs !== undefined
    && (!Number.isFinite(record.durationMs) || record.durationMs <= 0)
  ) {
    errors.push(`INVALID_FRAME_DURATION:${dotPath}`)
  }
}

function validateRequiredRecord(errors, manifest, segments, visited) {
  const dotPath = segments.join('.')
  const record = valueAt(manifest, segments)
  if (!isRecord(record)) {
    errors.push(`MISSING_REQUIRED_RECORD:${dotPath}`)
    return
  }
  visited.add(record)
  validateAssetRecord(errors, record, dotPath)
}

function validateRequiredArray(errors, manifest, segments, requiredLength, countError, visited) {
  const records = valueAt(manifest, segments)
  const parentPath = segments.slice(0, -1).join('.')
  if (!Array.isArray(records) || records.length !== requiredLength) {
    errors.push(`${countError}:${parentPath}`)
    return
  }

  records.forEach((record, index) => {
    const dotPath = `${segments.join('.')}.${index}`
    if (!isRecord(record)) {
      errors.push(`MISSING_REQUIRED_RECORD:${dotPath}`)
      return
    }
    visited.add(record)
    validateAssetRecord(errors, record, dotPath)
  })
}

function validateAdditionalAssets(errors, value, dotPath, visited) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateAdditionalAssets(errors, entry, `${dotPath}.${index}`, visited)
    })
    return
  }
  if (!isRecord(value)) return

  if (
    !visited.has(value)
    && (
      Object.hasOwn(value, 'src')
      || Object.hasOwn(value, 'anchor')
      || Object.hasOwn(value, 'durationMs')
    )
  ) {
    visited.add(value)
    validateAssetRecord(errors, value, dotPath)
  }
  for (const key of Object.keys(value).sort()) {
    const nested = value[key]
    validateAdditionalAssets(errors, nested, dotPath ? `${dotPath}.${key}` : key, visited)
  }
}

export function validateFarmSceneManifest(manifest) {
  const source = isRecord(manifest) ? manifest : {}
  const errors = []
  const visited = new WeakSet()

  if (source.schemaVersion !== 1) errors.push('INVALID_SCHEMA_VERSION')
  if (typeof source.skinId !== 'string' || source.skinId.trim().length === 0) {
    errors.push('INVALID_SKIN_ID')
  }
  if (
    !isRecord(source.logicalSize)
    || !Number.isFinite(source.logicalSize.width)
    || !Number.isFinite(source.logicalSize.height)
    || source.logicalSize.width <= 0
    || source.logicalSize.height <= 0
  ) {
    errors.push('INVALID_LOGICAL_SIZE')
  }

  validateRequiredRecord(errors, source, REQUIRED_ASSET_RECORDS[0], visited)
  validateRequiredRecord(errors, source, REQUIRED_ASSET_RECORDS[1], visited)
  validateRequiredArray(
    errors,
    source,
    ['crops', 'wheat', 'stages'],
    4,
    'INVALID_STAGE_COUNT',
    visited,
  )
  validateRequiredArray(
    errors,
    source,
    ['buildings', 'sprinkler', 'levels'],
    3,
    'INVALID_LEVEL_COUNT',
    visited,
  )
  for (const segments of REQUIRED_ASSET_RECORDS.slice(2)) {
    validateRequiredRecord(errors, source, segments, visited)
  }
  validateAdditionalAssets(errors, source, '', visited)

  return errors
}
