import { ITEMS } from '../../shared/item-config.js'
import { canCompleteOrder } from './farm-orders.mjs'

const SLOT_COUNT = 3

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

function formatDuration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1_000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function itemView(id) {
  return {
    id,
    name: ITEMS[id]?.name || id,
    emoji: ITEMS[id]?.emoji || '📦',
  }
}

export function buildOrdersViewModel(snapshot, now) {
  const inventory = snapshot.inventory || {}
  const source = snapshot.farm.orders.slots || []
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => {
    const slot = source[index] || { order: null, regenerateAt: null }
    if (!slot.order) {
      return {
        index,
        order: null,
        regenerateAt: slot.regenerateAt,
        remainingMs: slot.regenerateAt ? Date.parse(slot.regenerateAt) - Date.parse(now) : null,
      }
    }
    return {
      index,
      order: structuredClone(slot.order),
      requirements: Object.entries(slot.order.requirements).map(([id, required]) => ({
        ...itemView(id),
        owned: inventory[id] || 0,
        required,
      })),
      rewards: structuredClone(slot.order.rewards),
      canComplete: canCompleteOrder(slot.order, inventory),
      regenerateAt: null,
      remainingMs: null,
    }
  })
  return { slots, now }
}

const itemIcon = (entry, uiSkin) => {
  const src = uiSkin?.itemIcons?.[entry.id]?.src || uiSkin?.itemFallback?.src
  return src ? `<img class="farm-orders-item-icon" src="${escapeHtml(src)}"${uiSkin?.itemFallback?.src ? ` data-fallback-src="${escapeHtml(uiSkin.itemFallback.src)}"` : ''} alt="">` : ''
}

export function renderOrdersHtml(vm, { busy = false, uiSkin, reducedMotion = false, hidden = false, uiFeedback = null } = {}) {
  const cards = vm.slots.map(slot => {
    if (!slot.order) {
      const status = slot.regenerateAt
        ? `冷却中 ${formatDuration(slot.remainingMs)}`
        : '等待生成'
      const paper = uiSkin?.orders?.cooldownPaper?.src
      return `<article class="farm-orders-paper farm-order-card farm-order-card--cooldown" data-order-state="${slot.regenerateAt ? 'cooldown' : 'waiting'}"${paper ? ` style="--farm-orders-paper-image:url('${escapeHtml(paper)}')"` : ''}>
        <div class="farm-card-title">订单槽 ${slot.index + 1}</div>
        <div class="farm-order-cooldown" data-order-countdown="${slot.index}">${status}</div>
      </article>`
    }
    const requirements = slot.requirements.map(entry =>
      `<li class="${entry.owned >= entry.required ? '' : 'farm-material--missing'}">
        <span>${itemIcon(entry, uiSkin)} ${escapeHtml(entry.name)}</span><strong>${entry.owned} / ${entry.required}</strong>
      </li>`).join('')
    const seed = slot.rewards.seedReward
      ? `　${itemIcon({ id: slot.rewards.seedReward.itemId }, uiSkin)} ${escapeHtml(ITEMS[slot.rewards.seedReward.itemId]?.name || slot.rewards.seedReward.itemId)} ×${slot.rewards.seedReward.count}`
      : ''
    const state = slot.canComplete ? 'ready' : 'incomplete'
    const stamp = slot.canComplete && uiSkin?.orders?.readyStamp?.src
      ? `<img class="farm-orders-ready-stamp" src="${escapeHtml(uiSkin.orders.readyStamp.src)}" alt="">` : ''
    const paper = uiSkin?.orders?.paper?.src
    const pin = uiSkin?.orders?.pin?.src ? `<img class="farm-orders-visual farm-orders-pin" src="${escapeHtml(uiSkin.orders.pin.src)}" alt="">` : ''
    return `<article class="farm-orders-paper farm-order-card" data-order-state="${state}"${paper ? ` style="--farm-orders-paper-image:url('${escapeHtml(paper)}')"` : ''}>${pin}${stamp}
      <div class="farm-card-title">订单槽 ${slot.index + 1}</div>
      <ul class="farm-order-requirements">${requirements}</ul>
      <div class="farm-order-rewards">金币 ${slot.rewards.coins}　农场经验 +${slot.rewards.farmExp}${seed}</div>
      <div class="farm-card-footer">
        <button type="button" class="farm-btn farm-btn--ghost" data-action="abandon-order"
          data-slot-index="${slot.index}"${busy ? ' disabled' : ''}>放弃</button>
        <button type="button" class="farm-btn farm-btn--primary" data-action="complete-order"
          data-slot-index="${slot.index}"${busy || !slot.canComplete ? ' disabled' : ''}>完整交付</button>
      </div>
    </article>`
  }).join('')
  const style = uiSkin?.orders?.board?.src ? ` style="--farm-orders-board-image:url('${escapeHtml(uiSkin.orders.board.src)}')"` : ''
  const effect = ['order-complete', 'order-abandon'].includes(uiFeedback?.type) ? ` farm-orders-board--${uiFeedback.type}` : ''
  const overlayRecord = uiFeedback?.type === 'order-complete' ? uiSkin?.orders?.completionOverlay : uiFeedback?.type === 'order-abandon' ? uiSkin?.orders?.abandonPaper : null
  const overlay = overlayRecord?.src ? `<img class="farm-orders-visual farm-orders-${uiFeedback.type === 'order-complete' ? 'completion-overlay' : 'abandon-overlay'}" src="${escapeHtml(overlayRecord.src)}" alt="">` : ''
  return `<div class="farm-orders-board farm-orders-view${effect}" aria-label="订单板" data-motion-paused="${hidden || reducedMotion}" data-hidden="${hidden}" data-reduced-motion="${reducedMotion}"${style}>${cards}${overlay}</div>`
}

export function renderOrdersTab(container, initialViewModel, actions = {}) {
  let disposed = false
  let vm = initialViewModel
  let feedbackExpired = false
  let feedbackTimer = null
  const requestedBoundaries = actions.boundaryTracker || new Set()
  const currentBoundaries = new Set(vm.slots.map(slot => slot.regenerateAt).filter(Boolean))
  for (const boundary of requestedBoundaries) {
    if (!currentBoundaries.has(boundary)) requestedBoundaries.delete(boundary)
  }
  const now = actions.now || (() => new Date().toISOString())
  const setIntervalFn = actions.setIntervalFn || setInterval
  const clearIntervalFn = actions.clearIntervalFn || clearInterval
  const setTimeoutFn = actions.setTimeoutFn || setTimeout
  const clearTimeoutFn = actions.clearTimeoutFn || clearTimeout
  const activeFeedback = ['order-complete', 'order-abandon'].includes(actions.uiFeedback?.type)
    ? actions.uiFeedback : null
  const render = () => {
    if (!disposed) {
      container.innerHTML = renderOrdersHtml(vm, {
        busy: actions.isBusy?.(),
        ...actions,
        uiFeedback: feedbackExpired ? null : activeFeedback,
      })
    }
  }
  const onError = event => {
    const image = event.target?.closest?.('.farm-orders-item-icon, .farm-orders-visual, .farm-orders-ready-stamp')
    if (!image) return
    const fallback = image.dataset?.fallbackSrc
    if (image.classList?.contains?.('farm-orders-item-icon') && fallback && image.src !== fallback) image.src = fallback
    else image.hidden = true
  }
  const onClick = event => {
    const target = event.target.closest('[data-action]')
    if (!target || target.disabled || actions.isBusy?.()) return
    const slotIndex = Number(target.dataset.slotIndex)
    if (target.dataset.action === 'complete-order') actions.onComplete?.(slotIndex)
    if (target.dataset.action === 'abandon-order') actions.onAbandon?.(slotIndex)
  }
  const tick = () => {
    if (disposed) return
    const nowMs = Date.parse(now())
    vm = {
      ...vm,
      slots: vm.slots.map(slot => ({
        ...slot,
        remainingMs: slot.regenerateAt ? Date.parse(slot.regenerateAt) - nowMs : null,
      })),
    }
    const crossed = vm.slots.filter(slot =>
      !slot.order && slot.regenerateAt && slot.remainingMs <= 0
      && !requestedBoundaries.has(slot.regenerateAt))
    for (const slot of crossed) requestedBoundaries.add(slot.regenerateAt)
    const coolingSlots = vm.slots.filter(slot => !slot.order && slot.regenerateAt)
    if (typeof container.querySelectorAll === 'function') {
      for (const element of container.querySelectorAll('[data-order-countdown]')) {
        const slot = coolingSlots.find(entry => entry.index === Number(element.dataset.orderCountdown))
        if (slot) element.textContent = `冷却中 ${formatDuration(slot.remainingMs)}`
      }
    } else if (coolingSlots.length) {
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
