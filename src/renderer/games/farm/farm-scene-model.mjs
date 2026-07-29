function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

function unlockStateFor(tile) {
  if (tile.occupancy !== 'locked') return 'unlocked'
  if (tile.unlock?.complete === true) return 'complete'
  if (tile.unlock?.eligible === true) return 'eligible'
  return 'locked'
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function selectedObjectView(selectedObject) {
  if (selectedObject === null || typeof selectedObject !== 'object') return null
  if (!isNonEmptyString(selectedObject.type) || !isNonEmptyString(selectedObject.id)) return null
  return {
    type: selectedObject.type,
    id: selectedObject.id,
  }
}

function birdView(bird) {
  if (bird === null || typeof bird !== 'object') {
    return { birdId: null, visible: false, claimBusy: false }
  }
  return {
    birdId: isNonEmptyString(bird.birdId) ? bird.birdId : null,
    visible: bird.visible === true,
    claimBusy: bird.claimBusy === true,
  }
}

function activeTabView(activeTab) {
  return ['field', 'processing', 'orders'].includes(activeTab) ? activeTab : 'field'
}

export function cropStageFor(crop, now) {
  if (crop?.mature === true) return 4

  const plantedAt = Date.parse(crop?.plantedAt)
  const readyAt = Date.parse(crop?.readyAt)
  const currentTime = Date.parse(now)
  if (
    !Number.isFinite(plantedAt)
    || !Number.isFinite(readyAt)
    || !Number.isFinite(currentTime)
    || readyAt <= plantedAt
  ) {
    return 1
  }
  if (currentTime >= readyAt) return 4
  if (currentTime <= plantedAt) return 1

  const progress = (currentTime - plantedAt) / (readyAt - plantedAt)
  if (progress < 0.10) return 1
  if (progress < 0.40) return 2
  if (progress < 0.75) return 3
  return 4
}

function tileView(tile, now) {
  const crop = tile.crop
  const building = tile.building
  const mature = crop ? tile.cropView?.mature === true : false
  return {
    tileId: tile.id,
    row: tile.row,
    col: tile.col,
    occupancy: tile.occupancy,
    landLevel: tile.landLevel,
    unlockState: unlockStateFor(tile),
    cropId: crop?.cropId ?? null,
    cropStage: crop ? cropStageFor({ ...crop, mature }, now) : null,
    mature,
    buildingId: building?.id ?? null,
    buildingType: building?.typeId ?? null,
    buildingLevel: building?.level ?? null,
    buildingWorking: building?.working === true,
  }
}

export function buildFarmSceneSnapshot({
  viewModel,
  activeTab,
  selectedObject,
  reducedMotion,
  bird,
}) {
  const snapshot = {
    farmLevel: viewModel.summary.farmLevel,
    coins: viewModel.coins,
    activeTab: activeTabView(activeTab),
    selectedObject: selectedObjectView(selectedObject),
    motionReduced: reducedMotion === true,
    summary: {
      matureCount: viewModel.summary.matureFieldCount,
      processingCount: viewModel.summary.processing.queuedCount,
      readyOrderCount: viewModel.summary.orders.readyCount,
    },
    tiles: viewModel.tiles.map(tile => tileView(tile, viewModel.now)),
    pet: {
      visible: true,
      moodTier: null,
    },
    bird: birdView(bird),
  }
  return deepFreeze(snapshot)
}
