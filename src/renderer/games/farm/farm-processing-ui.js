import { ITEMS } from '../../shared/item-config.js'

const QUEUE_CAPACITY = 3

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const itemView = (id, count = 0) => ({
  id,
  name: ITEMS[id]?.name || id,
  emoji: ITEMS[id]?.emoji || '📦',
  count,
})

function formatDuration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1_000))
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainder = seconds % 60
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function buildProcessingViewModel(snapshot, config, now) {
  const farm = snapshot.farm
  const inventory = snapshot.inventory || {}
  const queue = farm.processor.queue.map(task => ({
    ...structuredClone(task),
    recipeName: Object.keys(task.outputs || {}).map(id => ITEMS[id]?.name || id).join('、'),
    inputsView: Object.entries(task.inputs || {}).map(([id, count]) => itemView(id, count)),
    outputsView: Object.entries(task.outputs || {}).map(([id, count]) => itemView(id, count)),
    remainingMs: task.status === 'running' ? Date.parse(task.completesAt) - Date.parse(now) : null,
  }))
  const queueFull = queue.length >= (config.rewards.processorQueueCapacity || QUEUE_CAPACITY)
  const recipes = Object.entries(config.recipes).map(([id, recipe]) => {
    const unlocked = farm.level >= recipe.unlockFarmLevel
    const ingredients = Object.entries(recipe.inputs).map(([itemId, required]) => {
      const owned = inventory[itemId] || 0
      const meta = itemView(itemId)
      return {
        id: meta.id,
        name: meta.name,
        emoji: meta.emoji,
        owned,
        required,
        sufficient: owned >= required,
      }
    })
    const outputs = Object.entries(recipe.outputs).map(([itemId, count]) => itemView(itemId, count))
    return {
      id,
      unlocked,
      unlockFarmLevel: recipe.unlockFarmLevel,
      lockMessage: unlocked ? '' : `农场 Lv.${recipe.unlockFarmLevel} 解锁`,
      ingredients,
      outputs,
      durationMs: recipe.durationMs,
      canEnqueue: unlocked && !queueFull && ingredients.every(entry => entry.sufficient),
    }
  })
  const outputIds = new Set(Object.values(config.recipes).flatMap(recipe => Object.keys(recipe.outputs)))
  const outputInventory = [...outputIds]
    .filter(id => (inventory[id] || 0) > 0)
    .map(id => itemView(id, inventory[id]))
  return { farmLevel: farm.level, recipes, queue, queueFull, outputInventory, now }
}

const itemIcon = (entry, uiSkin) => {
  const src = uiSkin?.itemIcons?.[entry.id]?.src || uiSkin?.itemFallback?.src
  return src ? `<img class="farm-workshop-item-icon" src="${escapeHtml(src)}"${uiSkin?.itemFallback?.src ? ` data-fallback-src="${escapeHtml(uiSkin.itemFallback.src)}"` : ''} alt="">` : ''
}

export function renderProcessingHtml(vm, { busy = false, uiSkin, reducedMotion = false, hidden = false, uiFeedback = null } = {}) {
  const recipeCards = vm.recipes.map(recipe => {
    const ingredients = recipe.ingredients.map(entry =>
      `<span class="${entry.sufficient ? '' : 'farm-material--missing'}">${itemIcon(entry, uiSkin)} ${escapeHtml(entry.name)} ${entry.owned}/${entry.required}</span>`).join('')
    const outputs = recipe.outputs.map(entry =>
      `${itemIcon(entry, uiSkin)} ${escapeHtml(entry.name)} ×${entry.count}`).join('、')
    const disabled = busy || !recipe.canEnqueue
    const status = recipe.unlocked
      ? (recipe.ingredients.every(entry => entry.sufficient) ? `耗时 ${formatDuration(recipe.durationMs)}` : '材料不足')
      : recipe.lockMessage
    const lockedMask = !recipe.unlocked && uiSkin?.workshop?.lockedMask?.src
      ? `<img class="farm-workshop-visual farm-workshop-locked-mask" src="${escapeHtml(uiSkin.workshop.lockedMask.src)}" alt="">` : ''
    return `<article class="farm-workshop-recipe farm-recipe-card${recipe.unlocked ? '' : ' farm-recipe-card--locked'}">
      ${lockedMask}
      <div class="farm-card-title">${outputs}</div>
      <div class="farm-material-list">${ingredients}</div>
      <div class="farm-card-footer"><small>${escapeHtml(status)}</small>
        <button type="button" class="farm-btn farm-btn--primary" data-action="enqueue-processing"
          data-recipe-id="${escapeHtml(recipe.id)}"${disabled ? ' disabled' : ''}>加入队列</button>
      </div>
    </article>`
  }).join('')
  const slots = Array.from({ length: QUEUE_CAPACITY }, (_, index) => {
    const task = vm.queue[index]
    if (!task) {
      const image = uiSkin?.workshop?.slots?.empty?.src
      return `<article class="farm-workshop-slot farm-queue-slot farm-queue-slot--empty" data-slot-state="empty"${image ? ` style="--farm-workshop-slot-image:url('${escapeHtml(image)}')"` : ''}>空队列位</article>`
    }
    const details = task.inputsView.map(entry =>
      `${itemIcon(entry, uiSkin)} ${escapeHtml(entry.name)} × ${entry.count}`).join('、')
    const status = task.status === 'running'
      ? `<strong data-processing-countdown="${escapeHtml(task.id)}">${formatDuration(task.remainingMs)}</strong>`
      : '<strong>排队中</strong>'
    const cancel = task.status === 'queued'
      ? `<button type="button" class="farm-btn farm-btn--danger" data-action="cancel-processing" data-task-id="${escapeHtml(task.id)}"${busy ? ' disabled' : ''}>取消</button>`
      : ''
    const slotImage = uiSkin?.workshop?.slots?.[task.status]?.src
    return `<article class="farm-workshop-slot farm-queue-slot" data-slot-state="${task.status}"${slotImage ? ` style="--farm-workshop-slot-image:url('${escapeHtml(slotImage)}')"` : ''}><div><span>${escapeHtml(task.recipeName)}</span>${status}</div>
      <small>${details}</small>${cancel}</article>`
  }).join('')
  const owned = vm.outputInventory.length
    ? vm.outputInventory.map(entry => `${itemIcon(entry, uiSkin)} ${escapeHtml(entry.name)} ×${entry.count}`).join('　')
    : '暂无加工品'
  const machine = uiSkin?.workshop?.machine || {}
  const working = vm.queue.some(task => task.status === 'running')
  const machineImage = machine.base?.src ? `<img class="farm-workshop-visual" src="${escapeHtml(machine.base.src)}" alt="">` : '<span>加工机器</span>'
  const motionStyle = [
    machine.gearSheet?.src ? `--farm-workshop-gear-sheet:url('${escapeHtml(machine.gearSheet.src)}')` : '',
    machine.steamSheet?.src ? `--farm-workshop-steam-sheet:url('${escapeHtml(machine.steamSheet.src)}')` : '',
    machine.gearSheet?.durationMs ? `--farm-workshop-gear-duration:${machine.gearSheet.durationMs}ms` : '',
    machine.steamSheet?.durationMs ? `--farm-workshop-steam-duration:${machine.steamSheet.durationMs}ms` : '',
  ].filter(Boolean).join(';')
  const feedbackClass = ['enqueue', 'processing-complete'].includes(uiFeedback?.type) ? ` farm-workshop-view--${uiFeedback.type}` : ''
  const workGlow = working && machine.workGlow?.src ? `<img class="farm-workshop-visual farm-workshop-work-glow" src="${escapeHtml(machine.workGlow.src)}" alt="">` : ''
  const completion = uiFeedback?.type === 'processing-complete' && machine.completionFlash?.src ? `<img class="farm-workshop-visual farm-workshop-completion-flash" src="${escapeHtml(machine.completionFlash.src)}" alt="">` : ''
  const shelfStyle = uiSkin?.workshop?.recipeShelf?.src ? ` style="--farm-workshop-shelf-image:url('${escapeHtml(uiSkin.workshop.recipeShelf.src)}')"` : ''
  return `<div class="farm-workshop-view farm-processing-view${feedbackClass}" data-motion-paused="${hidden || reducedMotion}" data-hidden="${hidden}" data-reduced-motion="${reducedMotion}">
    <section class="farm-workshop-hero" aria-label="加工机器" data-machine-state="${working ? 'working' : 'idle'}"${motionStyle ? ` style="${motionStyle}"` : ''}>${machineImage}<span class="farm-workshop-machine-label">加工机器</span>${workGlow}${completion}<div class="farm-workshop-gear${working ? ' farm-workshop-gear--active' : ''}" aria-hidden="true"></div><div class="farm-workshop-steam${working ? ' farm-workshop-steam--active' : ''}" aria-hidden="true"></div></section>
    <aside class="farm-workshop-track farm-processing-queue" aria-label="加工队列"><h2>加工队列 ${vm.queue.length}/${QUEUE_CAPACITY}</h2><div class="farm-workshop-slots">${slots}</div>
      <div class="farm-output-summary">持有：${owned}</div></aside>
    <section class="farm-workshop-shelf farm-processing-recipes" aria-label="加工配方"${shelfStyle}>${recipeCards}</section>
  </div>`
}

export function renderProcessingTab(container, initialViewModel, actions = {}) {
  let disposed = false
  let vm = initialViewModel
  let feedbackExpired = false
  let feedbackTimer = null
  const requestedBoundaries = actions.boundaryTracker || new Set()
  const currentBoundaryIds = new Set(vm.queue.filter(task => task.status === 'running').map(task => task.id))
  for (const id of requestedBoundaries) {
    if (!currentBoundaryIds.has(id)) requestedBoundaries.delete(id)
  }
  const now = actions.now || (() => new Date().toISOString())
  const setIntervalFn = actions.setIntervalFn || setInterval
  const clearIntervalFn = actions.clearIntervalFn || clearInterval
  const setTimeoutFn = actions.setTimeoutFn || setTimeout
  const clearTimeoutFn = actions.clearTimeoutFn || clearTimeout
  const activeFeedback = ['enqueue', 'processing-complete'].includes(actions.uiFeedback?.type)
    ? actions.uiFeedback : null

  const render = () => {
    if (!disposed) {
      container.innerHTML = renderProcessingHtml(vm, {
        busy: actions.isBusy?.(),
        ...actions,
        uiFeedback: feedbackExpired ? null : activeFeedback,
      })
    }
  }
  const onError = event => {
    const image = event.target?.closest?.('.farm-workshop-item-icon, .farm-workshop-visual')
    if (!image) return
    const fallback = image.dataset?.fallbackSrc
    if (image.classList?.contains?.('farm-workshop-item-icon') && fallback && image.src !== fallback) image.src = fallback
    else image.hidden = true
  }
  const onClick = event => {
    const target = event.target.closest('[data-action]')
    if (!target || target.disabled || actions.isBusy?.()) return
    if (target.dataset.action === 'enqueue-processing') actions.onEnqueue?.(target.dataset.recipeId)
    if (target.dataset.action === 'cancel-processing') actions.onCancel?.(target.dataset.taskId)
  }
  const tick = () => {
    if (disposed) return
    const nowMs = Date.parse(now())
    vm = {
      ...vm,
      queue: vm.queue.map(task => ({
        ...task,
        remainingMs: task.status === 'running' ? Date.parse(task.completesAt) - nowMs : null,
      })),
    }
    const crossed = vm.queue.filter(task =>
      task.status === 'running' && task.remainingMs <= 0 && !requestedBoundaries.has(task.id))
    for (const task of crossed) requestedBoundaries.add(task.id)
    const runningTasks = vm.queue.filter(task => task.status === 'running')
    if (typeof container.querySelectorAll === 'function') {
      for (const element of container.querySelectorAll('[data-processing-countdown]')) {
        const task = runningTasks.find(entry => entry.id === element.dataset.processingCountdown)
        if (task) element.textContent = formatDuration(task.remainingMs)
      }
    } else if (runningTasks.length) {
      render()
    }
    if (crossed.length) actions.requestSettlement?.()
  }

  container.addEventListener('click', onClick)
  container.addEventListener('error', onError, true)
  const timer = setIntervalFn(tick, 1_000)
  render()
  if (activeFeedback) {
    feedbackTimer = setTimeoutFn(() => {
      if (disposed || feedbackExpired) return
      feedbackExpired = true
      actions.consumeUiFeedback?.(activeFeedback.id)
      render()
    }, 500)
  }
  return () => {
    if (disposed) return
    disposed = true
    clearIntervalFn(timer)
    if (feedbackTimer !== null) clearTimeoutFn(feedbackTimer)
    container.removeEventListener('click', onClick)
    container.removeEventListener('error', onError, true)
  }
}
