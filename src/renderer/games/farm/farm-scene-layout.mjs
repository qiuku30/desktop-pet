const FIXED_KEYS = Object.freeze(['processing', 'orders', 'pet', 'bird'])
const TILE_VISUAL_FIELDS = Object.freeze([
  'occupancy',
  'landLevel',
  'unlockState',
  'cropId',
  'cropStage',
  'mature',
  'buildingId',
  'buildingType',
  'buildingLevel',
  'buildingWorking',
])

function fail(code) {
  throw new Error(`INVALID_FARM_SCENE_LAYOUT:${code}`)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return Number.isFinite(value)
}

function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0
}

function isVisualPrimitive(value) {
  return (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || isFiniteNumber(value)
  )
}

function validPoint(value) {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

function validateGeometry(logicalSize, sceneConfig) {
  if (
    !isRecord(logicalSize)
    || !isPositiveNumber(logicalSize.width)
    || !isPositiveNumber(logicalSize.height)
  ) {
    fail('INVALID_LOGICAL_SIZE')
  }

  const safeRect = sceneConfig?.safeRect
  if (
    !isRecord(safeRect)
    || !isFiniteNumber(safeRect.x)
    || !isFiniteNumber(safeRect.y)
    || !isPositiveNumber(safeRect.width)
    || !isPositiveNumber(safeRect.height)
    || safeRect.x < 0
    || safeRect.y < 0
    || safeRect.x + safeRect.width > logicalSize.width
    || safeRect.y + safeRect.height > logicalSize.height
  ) {
    fail('INVALID_SAFE_RECT')
  }

  const grid = sceneConfig?.tileGrid
  if (
    !isRecord(grid)
    || !validPoint(grid.origin)
    || !validPoint(grid.columnStep)
    || !validPoint(grid.rowStep)
    || (grid.columnStep.x === 0 && grid.columnStep.y === 0)
    || (grid.rowStep.x === 0 && grid.rowStep.y === 0)
    || !isRecord(grid.hitSize)
    || !isPositiveNumber(grid.hitSize.width)
    || !isPositiveNumber(grid.hitSize.height)
  ) {
    fail('INVALID_TILE_GRID')
  }

  for (const key of FIXED_KEYS) {
    if (!validPoint(sceneConfig?.[key])) fail(`INVALID_FIXED_POSITION:${key}`)
    const point = sceneConfig[key]
    if (
      point.x < 0
      || point.y < 0
      || point.x > logicalSize.width
      || point.y > logicalSize.height
    ) {
      fail(`INVALID_FIXED_POSITION:${key}`)
    }
  }

  return { safeRect, grid }
}

function validateTile(tile) {
  if (
    !isRecord(tile)
    || typeof tile.tileId !== 'string'
    || tile.tileId.length === 0
    || !Number.isInteger(tile.row)
    || !Number.isInteger(tile.col)
    || tile.row < 0
    || tile.row > 3
    || tile.col < 0
    || tile.col > 3
  ) {
    fail('INVALID_TILE')
  }
  for (const field of TILE_VISUAL_FIELDS) {
    if (!isVisualPrimitive(tile[field])) fail(`INVALID_TILE_VISUAL_FIELD:${field}`)
  }
}

function tileRecord(tile, grid, safeRect) {
  const center = {
    x: grid.origin.x + (tile.col * grid.columnStep.x) + (tile.row * grid.rowStep.x),
    y: grid.origin.y + (tile.col * grid.columnStep.y) + (tile.row * grid.rowStep.y),
  }
  const hitArea = {
    x: center.x - (grid.hitSize.width / 2),
    y: center.y - (grid.hitSize.height / 2),
    width: grid.hitSize.width,
    height: grid.hitSize.height,
  }
  if (
    hitArea.x < safeRect.x
    || hitArea.y < safeRect.y
    || hitArea.x + hitArea.width > safeRect.x + safeRect.width
    || hitArea.y + hitArea.height > safeRect.y + safeRect.height
  ) {
    fail(`TILE_OUTSIDE_SAFE_RECT:${tile.tileId}`)
  }

  const record = {
    tileId: tile.tileId,
    row: tile.row,
    col: tile.col,
  }
  for (const field of TILE_VISUAL_FIELDS) record[field] = tile[field]
  record.center = center
  record.hitArea = hitArea
  record.sortY = center.y + (grid.hitSize.height / 2)
  return record
}

function fixedRecord(key, point, visual = {}) {
  return {
    key,
    x: point.x,
    y: point.y,
    sortY: point.y,
    ...visual,
  }
}

export function layoutFarmScene(snapshot, logicalSize, sceneConfig) {
  const { safeRect, grid } = validateGeometry(logicalSize, sceneConfig)
  if (!isRecord(snapshot) || !Array.isArray(snapshot.tiles) || snapshot.tiles.length !== 16) {
    fail('INVALID_TILE_COUNT')
  }

  const tileIds = new Set()
  const coordinates = new Set()
  const hitAreas = new Set()
  const tiles = snapshot.tiles.map(tile => {
    validateTile(tile)
    if (tileIds.has(tile.tileId)) fail(`DUPLICATE_TILE_ID:${tile.tileId}`)
    tileIds.add(tile.tileId)
    const coordinate = `${tile.row}:${tile.col}`
    if (coordinates.has(coordinate)) fail(`DUPLICATE_TILE_COORDINATE:${coordinate}`)
    coordinates.add(coordinate)
    const record = tileRecord(tile, grid, safeRect)
    const hitKey = `${record.hitArea.x}:${record.hitArea.y}:${record.hitArea.width}:${record.hitArea.height}`
    if (hitAreas.has(hitKey)) fail(`DUPLICATE_HIT_AREA:${tile.tileId}`)
    hitAreas.add(hitKey)
    return record
  })
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (!coordinates.has(`${row}:${col}`)) fail(`MISSING_TILE_COORDINATE:${row}:${col}`)
    }
  }

  tiles.sort((left, right) => (
    left.row - right.row
    || left.col - right.col
    || left.tileId.localeCompare(right.tileId)
  ))

  const centers = new Set(tiles.map(tile => `${tile.center.x}:${tile.center.y}`))
  for (const key of FIXED_KEYS) {
    const point = sceneConfig[key]
    if (centers.has(`${point.x}:${point.y}`)) fail(`FIXED_POSITION_OVERLAPS_TILE:${key}`)
  }
  for (const [field, value] of Object.entries(snapshot.pet || {})) {
    if (!isVisualPrimitive(value)) fail(`INVALID_PET_VISUAL_FIELD:${field}`)
  }
  for (const [field, value] of Object.entries(snapshot.bird || {})) {
    if (!isVisualPrimitive(value)) fail(`INVALID_BIRD_VISUAL_FIELD:${field}`)
  }

  return deepFreeze({
    tiles,
    processing: fixedRecord('processing', sceneConfig.processing),
    orders: fixedRecord('orders', sceneConfig.orders),
    pet: fixedRecord('pet', sceneConfig.pet, {
      visible: snapshot.pet?.visible === true,
      moodTier: snapshot.pet?.moodTier ?? null,
    }),
    bird: fixedRecord('bird', sceneConfig.bird, {
      birdId: typeof snapshot.bird?.birdId === 'string' ? snapshot.bird.birdId : null,
      visible: snapshot.bird?.visible === true,
      claimBusy: snapshot.bird?.claimBusy === true,
    }),
  })
}
