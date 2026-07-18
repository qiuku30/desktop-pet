// 2048 游戏 UI — DOM 渲染 + 事件绑定 + PetState 集成
//
// 职责：
// - mount(container) / saveBeforeClose() 两个对外入口
// - 键盘方向键 + 鼠标拖拽双操作
// - 信息栏渲染（分数/最高分/心情倍率）
// - Game Over 结算弹窗（调 game-reward-service）
// - 重新开始确认弹窗
// - 面板内切页：内存保留（_game 模块变量）
// - 关面板：序列化到 PetState.game2048.savedGame
//
// 依赖：2048-game.js（纯逻辑）、game-reward-service.js（结算计算）、PetState（持久化）

import * as Game from './2048-game.js'
import { PetState } from '../../shared/pet-state.js'
import { calcTotalRewards } from '../../shared/game-reward-service.js'
import { getMoodMultiplier } from '../../shared/game-reward-service.js'
import { MILESTONES } from '../../shared/game-reward-service.js'

// ── CSS 文本（自包含，mount 时注入 <style>） ──
const CSS_TEXT = `
.page--game2048{display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:20px 16px;gap:16px;position:relative;height:100%}
.game2048-info-bar{display:flex;justify-content:center;gap:24px;width:100%;max-width:360px;user-select:none}
.game2048-stat{display:flex;flex-direction:column;align-items:center;gap:2px;background:#2c2c2c;border:1px solid #333;border-radius:8px;padding:8px 16px;min-width:90px}
.game2048-stat-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}
.game2048-stat-value{font-size:20px;font-weight:bold;color:#fff;font-variant-numeric:tabular-nums}
.game2048-stat-value--record{color:#ffc107}
.game2048-board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;background:#333;border-radius:8px;width:100%;max-width:340px;aspect-ratio:1;user-select:none;touch-action:none}
.game2048-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-weight:bold;transition:background .1s ease,transform .1s ease}
.game2048-cell--empty{background:#444}
.game2048-cell--2{background:#eee4da;color:#776e65}.game2048-cell--4{background:#ede0c8;color:#776e65}
.game2048-cell--8{background:#f2b179;color:#f9f6f2}.game2048-cell--16{background:#f59563;color:#f9f6f2}
.game2048-cell--32{background:#f67c5f;color:#f9f6f2}.game2048-cell--64{background:#f65e3b;color:#f9f6f2}
.game2048-cell--128{background:#edcf72;color:#f9f6f2}.game2048-cell--256{background:#edcc61;color:#f9f6f2}
.game2048-cell--512{background:#edc850;color:#f9f6f2}.game2048-cell--1024{background:#edc53f;color:#f9f6f2}
.game2048-cell--2048{background:#edc22e;color:#f9f6f2}.game2048-cell--4096{background:#3c3a32;color:#f9f6f2}
.game2048-cell--8192{background:#3c3a32;color:#f9f6f2}.game2048-cell--super{background:#1a1a1a;color:#f9f6f2}
.game2048-cell--2,.game2048-cell--4,.game2048-cell--8{font-size:28px}
.game2048-cell--16,.game2048-cell--32,.game2048-cell--64{font-size:26px}
.game2048-cell--128,.game2048-cell--256,.game2048-cell--512{font-size:22px}
.game2048-cell--1024,.game2048-cell--2048{font-size:18px}
.game2048-cell--4096,.game2048-cell--8192,.game2048-cell--super{font-size:16px}
@keyframes tile-pop{0%{transform:scale(0)}80%{transform:scale(1.1)}100%{transform:scale(1)}}
.game2048-cell--new{animation:tile-pop .2s ease-out}
.game2048-footer{display:flex;justify-content:center;gap:10px;width:100%;max-width:340px}
.game2048-btn{padding:8px 24px;border:1px solid;border-radius:6px;background:transparent;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,color .15s,border-color .15s;user-select:none}
.game2048-btn--restart{border-color:#555;color:#999}.game2048-btn--restart:hover{border-color:#e81123;color:#e81123;background:rgba(232,17,35,.08)}
.game2048-btn--primary{border-color:#2196f3;color:#2196f3;min-width:120px}.game2048-btn--primary:hover{background:#2196f3;color:#fff}
.game2048-btn--secondary{border-color:#555;color:#999;min-width:100px}.game2048-btn--secondary:hover{background:#555;color:#ddd}
.game2048-btn--settle{border-color:#4caf50;color:#4caf50}.game2048-btn--settle:hover{background:#4caf50;color:#fff}
.game2048-overlay{position:absolute;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:10}
.game2048-modal{background:#2c2c2c;border:1px solid #444;border-radius:12px;padding:24px;min-width:280px;max-width:340px;display:flex;flex-direction:column;gap:16px;user-select:none;animation:modal-in .2s ease-out}
@keyframes modal-in{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.game2048-modal-title{font-size:18px;font-weight:bold;color:#fff;text-align:center}
.game2048-modal-body{display:flex;flex-direction:column;gap:10px}
.game2048-result-scores{display:flex;justify-content:center;gap:20px;padding-bottom:10px;border-bottom:1px solid #444}
.game2048-result-score-item{display:flex;flex-direction:column;align-items:center;gap:2px}
.game2048-result-score-label{font-size:11px;color:#888}
.game2048-result-score-value{font-size:24px;font-weight:bold;color:#fff}
.game2048-result-score-value--record{color:#ffc107}
.game2048-result-record-badge{font-size:12px;color:#ffc107;margin-top:2px}
.game2048-rewards-section{display:flex;flex-direction:column;gap:4px}
.game2048-rewards-title{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.game2048-rewards-row{display:flex;justify-content:space-between;font-size:13px;color:#bbb}
.game2048-rewards-row--total{color:#fff;font-weight:bold;font-size:14px;padding-top:4px;border-top:1px solid #444}
.game2048-milestones{display:flex;flex-direction:column;gap:4px;padding:8px;background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.2);border-radius:6px}
.game2048-milestone-item{font-size:13px;color:#ffc107}
.game2048-modal-buttons{display:flex;justify-content:center;gap:12px}
.game2048-confirm-text{font-size:14px;color:#bbb;text-align:center;line-height:1.5}
.game2048-rewards-preview{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:6px 16px;width:100%;max-width:360px;padding:6px 12px;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:6px;user-select:none;font-size:13px}
.game2048-preview-label{color:#888}
.game2048-preview-item{color:#ccc;font-variant-numeric:tabular-nums}
.game2048-preview-milestone{color:#ffc107;font-size:12px}
`

// ── 模块级状态（跨面板内切页保留） ──
let _game = null          // 当前游戏状态
let _highScore = 0        // 历史最高分（来自 PetState）
let _milestones = {}      // 首达标记（来自 PetState）
let _styleEl = null       // 注入的 <style> 元素

// ── 事件清理 ──
let _onKeyDown = null
let _cleanupFns = []

// ══════════════════════════════════════════════════════
// 对外 API
// ══════════════════════════════════════════════════════

/**
 * 挂载游戏到指定容器。返回清理函数。
 * @param {HTMLElement} container
 * @returns {Function} cleanup — 切页时调用，解绑事件
 */
export function mount(container) {
  // 注入样式（仅一次）
  if (!_styleEl) {
    _styleEl = document.createElement('style')
    _styleEl.textContent = CSS_TEXT
    document.head.appendChild(_styleEl)
  }

  // 首次挂载：从 PetState 加载持久数据
  if (_highScore === 0 && Object.keys(_milestones).length === 0) {
    const g2048 = PetState.get('game2048') || {}
    _highScore = g2048.highScore || 0
    _milestones = g2048.milestones || {}
  }

  // 恢复游戏状态：优先内存，其次 PetState.savedGame
  if (!_game) {
    const g2048 = PetState.get('game2048') || {}
    const saved = g2048.savedGame
    if (saved) {
      const restored = Game.deserialize(saved)
      if (restored) {
        _game = restored
      }
      // 读取后立即清除，防止 App 重启时残留（main 进程也会清）
      PetState.set('game2048', { ...g2048, savedGame: null })
    }
  }

  if (!_game) {
    _game = Game.createGame()
  }

  _render(container)
  _bindEvents(container)

  // 如果恢复时已 Game Over，展示结算弹窗
  if (_game.gameOver) {
    _showSettlementModal(container)
  }

  // 返回清理函数（切页时调）
  return () => {
    _unbindEvents()
  }
}

/**
 * 面板关闭前调用：保存当前游戏到 PetState
 * 由 dashboard.js 在 flush() 之前调用
 */
export function saveBeforeClose() {
  if (!_game) return
  // 跳过已领奖的结束局（下次打开直接开新局）
  if (_game.gameOver && _game.rewardsClaimed) return
  const g2048 = PetState.get('game2048') || {}
  PetState.set('game2048', {
    ...g2048,
    highScore: _highScore,
    milestones: _milestones,
    savedGame: Game.serialize(_game),
  })
}

// ══════════════════════════════════════════════════════
// 渲染
// ══════════════════════════════════════════════════════

/** 构建首达奖励提示文本，如 "🎉 首次合成 256 (+10 EXP +6 🪙)" */
function _milestoneHint(triggered) {
  if (!triggered || triggered.length === 0) return ''
  return triggered.map(v => {
    const m = MILESTONES[v]
    return `🎉 首次合成 ${v} (+${m.exp} EXP +${m.coins} 🪙)`
  }).join(' ')
}

function _render(container) {
  const mood = PetState.get('mood') ?? 70
  const mult = getMoodMultiplier(mood)
  const multText = mult > 1 ? `+${Math.round((mult - 1) * 100)}%` : mult < 1 ? `-${Math.round((1 - mult) * 100)}%` : '正常'
  const highDisplay = _highScore > 0 ? _highScore : '—'
  const est = calcTotalRewards(_game.score, _game.maxTile, mood, _milestones)

  container.className = 'page page--game2048'
  container.innerHTML = `
    <div class="game2048-info-bar">
      <div class="game2048-stat">
        <span class="game2048-stat-label">本局分数</span>
        <span class="game2048-stat-value" id="g2048-score">${_game.score}</span>
      </div>
      <div class="game2048-stat">
        <span class="game2048-stat-label">最高分</span>
        <span class="game2048-stat-value" id="g2048-highscore">${highDisplay}</span>
      </div>
      <div class="game2048-stat">
        <span class="game2048-stat-label">心情加成</span>
        <span class="game2048-stat-value" id="g2048-mood">${multText}</span>
      </div>
    </div>

    <div class="game2048-rewards-preview" id="g2048-preview">
      <span class="game2048-preview-label">预计收益</span>
      <span class="game2048-preview-item">⭐ +<span id="g2048-preview-exp">${est.totalExp}</span> EXP</span>
      <span class="game2048-preview-item">🪙 +<span id="g2048-preview-coins">${est.totalCoins}</span></span>
      <span class="game2048-preview-milestone" id="g2048-preview-milestone" style="${est.triggeredMilestones.length > 0 ? '' : 'display:none'}">${_milestoneHint(est.triggeredMilestones)}</span>
    </div>

    <div class="game2048-board" id="game2048-board"></div>

    <div class="game2048-footer">
      ${_game.gameOver
        ? '<button class="game2048-btn game2048-btn--primary" id="btn-2048-newgame">再来一局</button>'
        : '<button class="game2048-btn game2048-btn--settle" id="btn-2048-settle">结算</button>' +
          '<button class="game2048-btn game2048-btn--restart" id="btn-2048-restart">重新开始</button>'
      }
    </div>
  `

  _renderBoard()
}

function _renderBoard() {
  const boardEl = document.getElementById('game2048-board')
  if (!boardEl) return

  let html = ''
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = _game.board[r][c]
      if (val === 0) {
        html += '<div class="game2048-cell game2048-cell--empty"></div>'
      } else {
        const cls = val <= 8192 ? `game2048-cell--${val}` : 'game2048-cell--super'
        html += `<div class="game2048-cell ${cls}">${val}</div>`
      }
    }
  }
  boardEl.innerHTML = html

  // 更新分数
  const scoreEl = document.getElementById('g2048-score')
  if (scoreEl) scoreEl.textContent = _game.score

  // 更新预估收益
  const mood = PetState.get('mood') ?? 70
  const est = calcTotalRewards(_game.score, _game.maxTile, mood, _milestones)
  const expEl = document.getElementById('g2048-preview-exp')
  const coinsEl = document.getElementById('g2048-preview-coins')
  const milestoneEl = document.getElementById('g2048-preview-milestone')
  if (expEl) expEl.textContent = est.totalExp
  if (coinsEl) coinsEl.textContent = est.totalCoins
  if (milestoneEl) {
    milestoneEl.textContent = _milestoneHint(est.triggeredMilestones)
    milestoneEl.style.display = est.triggeredMilestones.length > 0 ? '' : 'none'
  }
}

// ══════════════════════════════════════════════════════
// 事件
// ══════════════════════════════════════════════════════

function _bindEvents(container) {
  // 先清理旧绑定，防止重复监听（再来一局/重新开始时重新绑定）
  _unbindEvents()

  // 键盘
  _onKeyDown = (e) => {
    // 只在 2048 页面且没有弹窗时响应
    if (!document.getElementById('game2048-board')) return
    if (container.querySelector('.game2048-overlay')) return

    let dir = null
    switch (e.key) {
      case 'ArrowUp':    dir = 'up';    break
      case 'ArrowDown':  dir = 'down';  break
      case 'ArrowLeft':  dir = 'left';  break
      case 'ArrowRight': dir = 'right'; break
      default: return
    }
    e.preventDefault()
    _doMove(dir, container)
  }
  document.addEventListener('keydown', _onKeyDown)

  // 鼠标/触摸拖拽
  const boardEl = container.querySelector('#game2048-board')
  let dragStart = null

  function onPointerDown(e) {
    if (container.querySelector('.game2048-overlay')) return
    dragStart = { x: e.clientX, y: e.clientY }
    boardEl.setPointerCapture(e.pointerId)
  }

  function onPointerUp(e) {
    if (!dragStart) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    dragStart = null
    boardEl.releasePointerCapture(e.pointerId)

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const threshold = 30
    if (Math.max(absDx, absDy) < threshold) return

    let dir
    if (absDx > absDy) {
      dir = dx > 0 ? 'right' : 'left'
    } else {
      dir = dy > 0 ? 'down' : 'up'
    }
    _doMove(dir, container)
  }

  boardEl.addEventListener('pointerdown', onPointerDown)
  boardEl.addEventListener('pointerup', onPointerUp)

  // 底部按钮：Game Over 后是"再来一局"（直接开新局，无需确认），
  // 正常游戏中是"重新开始"（需二次确认）
  const newgameBtn = container.querySelector('#btn-2048-newgame')
  const restartBtn = container.querySelector('#btn-2048-restart')

  const cleanBase = [
    () => document.removeEventListener('keydown', _onKeyDown),
    () => boardEl.removeEventListener('pointerdown', onPointerDown),
    () => boardEl.removeEventListener('pointerup', onPointerUp),
  ]

  if (newgameBtn) {
    function onNewGameClick() {
      _game = Game.createGame()
      _render(container)
      _bindEvents(container)
    }
    newgameBtn.addEventListener('click', onNewGameClick)
    _cleanupFns = [...cleanBase, () => newgameBtn.removeEventListener('click', onNewGameClick)]
  } else {
    // 游戏中：结算 + 重新开始 两个按钮
    const settleBtn = container.querySelector('#btn-2048-settle')
    _cleanupFns = [...cleanBase]

    if (settleBtn) {
      function onSettleClick() {
        _showSettleConfirm(container)
      }
      settleBtn.addEventListener('click', onSettleClick)
      _cleanupFns.push(() => settleBtn.removeEventListener('click', onSettleClick))
    }

    if (restartBtn) {
      function onRestartClick() {
        _showRestartConfirm(container)
      }
      restartBtn.addEventListener('click', onRestartClick)
      _cleanupFns.push(() => restartBtn.removeEventListener('click', onRestartClick))
    }
  }
}

function _unbindEvents() {
  _cleanupFns.forEach(fn => fn())
  _cleanupFns = []
  _onKeyDown = null
}

// ══════════════════════════════════════════════════════
// 游戏操作
// ══════════════════════════════════════════════════════

function _doMove(direction, container) {
  const result = Game.move(_game, direction)
  if (!result) return

  _game = result
  _renderBoard()

  if (_game.gameOver) {
    // 延迟弹窗，让最后一帧渲染先完成
    setTimeout(() => _showSettlementModal(container), 150)
  }
}

// ══════════════════════════════════════════════════════
// 结算弹窗
// ══════════════════════════════════════════════════════

function _showSettlementModal(container) {
  const mood = PetState.get('mood') ?? 70
  const rewards = calcTotalRewards(_game.score, _game.maxTile, mood, _milestones)

  // 破纪录检查
  const isNewRecord = _game.score > _highScore
  if (isNewRecord) {
    _highScore = _game.score
  }

  // 构建收益明细 HTML
  let bodyHTML = ''

  // 分数区
  bodyHTML += '<div class="game2048-result-scores">'
  bodyHTML += `<div class="game2048-result-score-item">
    <span class="game2048-result-score-label">本局得分</span>
    <span class="game2048-result-score-value">${_game.score}</span>
  </div>`
  bodyHTML += `<div class="game2048-result-score-item">
    <span class="game2048-result-score-label">最高分</span>
    <span class="game2048-result-score-value${isNewRecord ? ' game2048-result-score-value--record' : ''}">${_highScore}</span>
    ${isNewRecord ? '<span class="game2048-result-record-badge">🏆 新纪录！</span>' : ''}
  </div>`
  bodyHTML += '</div>'

  // 经验明细
  bodyHTML += '<div class="game2048-rewards-section">'
  bodyHTML += '<span class="game2048-rewards-title">⭐ 经验收益</span>'
  bodyHTML += `<div class="game2048-rewards-row"><span>基础收益</span><span>+${rewards.baseExp}</span></div>`
  if (rewards.milestoneExp > 0) {
    bodyHTML += `<div class="game2048-rewards-row"><span>首达奖励</span><span>+${rewards.milestoneExp}</span></div>`
  }
  bodyHTML += `<div class="game2048-rewards-row"><span>小计</span><span>${rewards.subtotalExp}</span></div>`
  if (rewards.moodMultiplier !== 1) {
    bodyHTML += `<div class="game2048-rewards-row"><span>心情加成 (×${rewards.moodMultiplier})</span><span>${rewards.totalExp - rewards.subtotalExp >= 0 ? '+' : ''}${rewards.totalExp - rewards.subtotalExp}</span></div>`
  }
  bodyHTML += `<div class="game2048-rewards-row game2048-rewards-row--total"><span>合计</span><span>+${rewards.totalExp} EXP</span></div>`
  bodyHTML += '</div>'

  // 金币明细
  bodyHTML += '<div class="game2048-rewards-section">'
  bodyHTML += '<span class="game2048-rewards-title">🪙 金币收益</span>'
  bodyHTML += `<div class="game2048-rewards-row"><span>基础收益</span><span>+${rewards.baseCoins}</span></div>`
  if (rewards.milestoneCoins > 0) {
    bodyHTML += `<div class="game2048-rewards-row"><span>首达奖励</span><span>+${rewards.milestoneCoins}</span></div>`
  }
  bodyHTML += `<div class="game2048-rewards-row"><span>小计</span><span>${rewards.subtotalCoins}</span></div>`
  if (rewards.moodMultiplier !== 1) {
    const coinDiff = rewards.totalCoins - rewards.subtotalCoins
    bodyHTML += `<div class="game2048-rewards-row"><span>心情加成 (×${rewards.moodMultiplier})</span><span>${coinDiff >= 0 ? '+' : ''}${coinDiff}</span></div>`
  }
  bodyHTML += `<div class="game2048-rewards-row game2048-rewards-row--total"><span>合计</span><span>+${rewards.totalCoins} 🪙</span></div>`
  bodyHTML += '</div>'

  // 里程碑
  if (rewards.triggeredMilestones.length > 0) {
    bodyHTML += '<div class="game2048-milestones">'
    rewards.triggeredMilestones.forEach(v => {
      bodyHTML += `<div class="game2048-milestone-item">🎉 首次合成 ${v}！</div>`
    })
    bodyHTML += '</div>'
  }

  // 如果收益已发放，加提示
  if (_game.rewardsClaimed) {
    bodyHTML += '<div style="text-align:center;color:#888;font-size:12px;margin-top:4px">收益已发放，不会重复获得</div>'
  }

  const overlay = document.createElement('div')
  overlay.className = 'game2048-overlay'
  overlay.innerHTML = `
    <div class="game2048-modal">
      <div class="game2048-modal-title">游戏结束</div>
      <div class="game2048-modal-body">${bodyHTML}</div>
      <div class="game2048-modal-buttons">
        <button class="game2048-btn game2048-btn--primary" id="btn-settle-replay">再来一局</button>
        <button class="game2048-btn game2048-btn--secondary" id="btn-settle-back">返回</button>
      </div>
    </div>
  `
  container.appendChild(overlay)

  // 按钮事件
  overlay.querySelector('#btn-settle-replay').addEventListener('click', () => {
    _applyRewards(rewards)
    overlay.remove()
    _game = Game.createGame()
    _render(container)
    _bindEvents(container)
  })

  overlay.querySelector('#btn-settle-back').addEventListener('click', () => {
    _applyRewards(rewards)
    overlay.remove()
    // 留在 2048 页面，重新渲染（底部按钮变为"再来一局"）
    _render(container)
    _bindEvents(container)
  })
}

// ══════════════════════════════════════════════════════
// 收益发放
// ══════════════════════════════════════════════════════

function _applyRewards(rewards) {
  if (_game.rewardsClaimed) return

  // 经验
  const exp = PetState.get('exp') || 0
  PetState.set('exp', exp + rewards.totalExp)

  // 金币
  const coins = PetState.get('coins') || 0
  PetState.set('coins', coins + rewards.totalCoins)

  // 最高分
  const g2048 = PetState.get('game2048') || {}
  if (_highScore > (g2048.highScore || 0)) {
    g2048.highScore = _highScore
  }

  // 里程碑
  const newMilestones = { ..._milestones }
  for (const v of rewards.triggeredMilestones) {
    newMilestones[v] = true
  }
  _milestones = newMilestones
  g2048.milestones = newMilestones

  PetState.set('game2048', g2048)
  _game.rewardsClaimed = true
}

// ══════════════════════════════════════════════════════
// 主动结算确认弹窗
// ══════════════════════════════════════════════════════

function _showSettleConfirm(container) {
  const mood = PetState.get('mood') ?? 70
  const rewards = calcTotalRewards(_game.score, _game.maxTile, mood, _milestones)

  let bodyHTML = ''
  bodyHTML += `<div class="game2048-rewards-row"><span>⭐ 经验</span><span>+${rewards.totalExp} EXP</span></div>`
  bodyHTML += `<div class="game2048-rewards-row"><span>🪙 金币</span><span>+${rewards.totalCoins}</span></div>`
  if (rewards.triggeredMilestones.length > 0) {
    bodyHTML += '<div class="game2048-milestones" style="margin-top:4px">'
    rewards.triggeredMilestones.forEach(v => {
      bodyHTML += `<div class="game2048-milestone-item">🎉 首次合成 ${v}！</div>`
    })
    bodyHTML += '</div>'
  }

  const overlay = document.createElement('div')
  overlay.className = 'game2048-overlay'
  overlay.innerHTML = `
    <div class="game2048-modal">
      <div class="game2048-modal-title">确定结算？</div>
      <div class="game2048-modal-body">${bodyHTML}</div>
      <div class="game2048-modal-buttons">
        <button class="game2048-btn game2048-btn--settle" id="btn-settle-confirm">确定结算</button>
        <button class="game2048-btn game2048-btn--secondary" id="btn-settle-cancel">继续游戏</button>
      </div>
    </div>
  `
  container.appendChild(overlay)

  overlay.querySelector('#btn-settle-confirm').addEventListener('click', () => {
    overlay.remove()
    _game.gameOver = true
    _showSettlementModal(container)
  })

  overlay.querySelector('#btn-settle-cancel').addEventListener('click', () => {
    overlay.remove()
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

// ══════════════════════════════════════════════════════
// 重新开始确认弹窗
// ══════════════════════════════════════════════════════

function _showRestartConfirm(container) {
  const overlay = document.createElement('div')
  overlay.className = 'game2048-overlay'
  overlay.innerHTML = `
    <div class="game2048-modal">
      <div class="game2048-modal-title">重新开始</div>
      <div class="game2048-confirm-text">当前对局进度将丢失，确定重新开始？</div>
      <div class="game2048-modal-buttons">
        <button class="game2048-btn game2048-btn--primary" id="btn-confirm-yes">确定</button>
        <button class="game2048-btn game2048-btn--secondary" id="btn-confirm-no">取消</button>
      </div>
    </div>
  `
  container.appendChild(overlay)

  overlay.querySelector('#btn-confirm-yes').addEventListener('click', () => {
    overlay.remove()
    _game = Game.createGame()
    _render(container)
    _bindEvents(container)
  })

  overlay.querySelector('#btn-confirm-no').addEventListener('click', () => {
    overlay.remove()
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}
