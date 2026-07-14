// 宠物渲染进程：原生拖拽 + 随机走动
// 拖拽：-webkit-app-region: drag（OS 原生，零偏移）
// 走动：moveWindow IPC（isAutoMoving，不触发 user:drag）

import {
  centerToTopLeft,
  topLeftToCenter,
  wanderTarget,
} from './pet-motion.mjs'
import { PetState } from '../shared/pet-state.js'
import { FOODS, consumeFood, applyFeed, emitFed } from '../shared/feed-service.js'
import { checkDailyInteraction, addExp, getFoodExp, EXP_CONFIG } from '../shared/exp-service.js'
import { SATIETY_CONFIG, calcMaxSatiety, calcDecay, reduceSatiety } from '../shared/satiety-service.js'
import { MOOD_CONFIG, getMoodTier, calcMoodDecay, reduceMood, boostMood, getExpMultiplier, getClickBoost, migrateMood, clampMood } from '../shared/mood-service.js'

// 动态窗口尺寸（配合 scaleFactor 自适应 + 用户缩放）
function getWinSize() {
  return { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }
}
const WANDER_MIN_MS = 5000
const WANDER_MAX_MS = 12000
const WANDER_RADIUS = 200
const WANDER_MS = 1200

const body = document.getElementById('pet-body')
let winPos = { x: 0, y: 0 }
let autoPaused = false
let resumeTimer = null
let glideToken = 0
let wanderTimer = null
let wanderEnabled = true
let satietyTickTimer = null

// ── overlay 状态 ──
let overlayActive = false
let _unsubMenuFeed = null
let _unsubMenuStatus = null
let _unsubWanderToggle = null
let _unsubUserDrag = null

// ── 工具 ──
function rand(min, max) { return min + Math.random() * (max - min) }

// ── 自动移窗（fire-and-forget）──
function commitMove(pos) {
  winPos = pos
  window.electronAPI.moveWindow(pos.x, pos.y)
}

// ── 缓动滑行 ──
function glideTo(target, durationMs, { moving, onDone } = {}) {
  const token = ++glideToken
  const start = { ...winPos }
  const t0 = performance.now()
  if (moving) body.classList.add('moving')

  function frame(now) {
    if (token !== glideToken) return
    const t = Math.min(1, (now - t0) / durationMs)
    const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
    commitMove({
      x: Math.round(start.x + (target.x - start.x) * e),
      y: Math.round(start.y + (target.y - start.y) * e),
    })
    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      if (moving) body.classList.remove('moving')
      if (onDone) onDone()
    }
  }
  requestAnimationFrame(frame)
}

// ── 随机走动 ──
function scheduleWander() {
  if (wanderTimer) clearTimeout(wanderTimer)
  wanderTimer = setTimeout(doWander, rand(WANDER_MIN_MS, WANDER_MAX_MS))
}

async function doWander() {
  wanderTimer = null
  if (!wanderEnabled) return
  if (autoPaused) { scheduleWander(); return }
  if (overlayActive) { scheduleWander(); return }

  try {
    const mode = await window.electronAPI.getWindowMode()
    if (mode === 'dashboard') { scheduleWander(); return }
  } catch (_) {}

  const sz = getWinSize()
  const center = topLeftToCenter(winPos, sz)
  const target = wanderTarget(center, WANDER_RADIUS, Math.random)

  glideTo(centerToTopLeft(target, sz), WANDER_MS, {
    moving: true,
    onDone: scheduleWander,
  })
}

// ── 走动开关 ──
function onWanderToggle(enabled) {
  wanderEnabled = enabled
  if (!enabled) {
    // 关闭：取消当前走动
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
    glideToken++
    body.classList.remove('moving')
  } else {
    // 开启：恢复走动
    scheduleWander()
  }
}

// ── 用户拖拽：暂停走动，松手 300ms 后恢复 ──
function onUserDrag() {
  if (!autoPaused) {
    autoPaused = true
    glideToken++ // 取消当前滑行
    body.classList.remove('moving')
  }
  if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = setTimeout(async () => {
    autoPaused = false
    resumeTimer = null
    try {
      const pos = await window.electronAPI.getWindowPosition()
      winPos = pos
    } catch (_) {}
    scheduleWander()
  }, 300)
}

// ── 对话气泡 ──

const DIALOGS = {
  happy: {
    low:  ['今天心情真好~', '嘿嘿，开心！', '主人真好！', '阳光真好呀 ☀️'],
    mid:  ['快乐摸鱼中...', '今天效率为零！', '上班好开心（假的）', '嘿嘿，今天运气不错！'],
    high: ['带薪聊天真爽', '已经摸到出神入化了', '跟着主人有肉吃！', '我是摸鱼达人 🏆'],
  },
  good: {
    low:  ['还不错~', '日子过得去 🍃', '挺好挺好', '一切正常运转中'],
    mid:  ['摸鱼进行时...', '悠然自得~', '今天天气不错', '等待投喂中'],
    high: ['心情不错！', '状态良好 😎', '今天效率不错哦', '快乐搬砖 🧱'],
  },
  neutral: {
    low:  ['嗯？有什么事吗？', '好无聊啊...', '主人在干嘛呢？', '有点想睡觉...'],
    mid:  ['发呆中...', '今天会议真多 😵', '等待投喂', '思考猫生中...'],
    high: ['忙碌的一天...', '还好还好，不算太糟', '努力摸鱼中 🐟', '时间过得真慢...'],
  },
  low: {
    low:  ['好饿啊...有没有吃的？', '肚子在叫了 🥺', '主人，该喂食了吧？', '零食时间到了吗？', '今天不太开心...', '陪陪我好不好？😢', '好想出去玩...', '有点孤单...'],
    mid:  ['好想出去走走...', '主人在忙吗？', '心情有点低落 😔', '饿着肚子真难受...'],
    high: ['今天真的不太好...', '感觉被忽略了 😿', '能不能陪我一会儿？', '又饿又孤单...'],
  },
}

function pickDialog(moodValue, level) {
  // moodValue 现在是 0-100 数值，用 getMoodTier 获取档位 key
  const tierInfo = getMoodTier(moodValue)
  const m = tierInfo && DIALOGS[tierInfo.tier] ? tierInfo.tier : 'neutral'
  const tier = level >= 7 ? 'high' : level >= 4 ? 'mid' : 'low'

  // 从对应层级取，没有则向上 fallback，再没有则向下
  let pool = DIALOGS[m][tier]
  if (!pool) pool = DIALOGS[m]['mid'] || DIALOGS[m]['low']
  if (!pool) pool = DIALOGS.neutral.low

  return pool[Math.floor(Math.random() * pool.length)]
}

function showBubble(customText) {
  const mood = PetState.get('mood')
  const level = PetState.get('level')
  const text = customText || pickDialog(mood, level)
  const bubble = document.createElement('div')
  bubble.className = 'speech-bubble'
  bubble.textContent = text
  document.getElementById('speech-bubbles').appendChild(bubble)

  let removed = false
  const remove = () => { if (!removed) { removed = true; bubble.remove() } }
  bubble.addEventListener('animationend', remove)
  setTimeout(remove, 2500) // 兜底：防止 animationend 不触发导致气泡残留
}

// ── 互动经验 ──

let _dailyCapHintShown = false

function grantInteractionExp() {
  const oldCount = PetState.get('dailyInteractionCount') || 0
  const lastDate = PetState.get('lastInteractionDate') || null

  const { canGain, newCount, newDate } = checkDailyInteraction(oldCount, lastDate)

  // 跨天重置提示标记
  if (lastDate !== newDate) {
    _dailyCapHintShown = false
  }

  PetState.set('dailyInteractionCount', newCount)
  PetState.set('lastInteractionDate', newDate)

  if (canGain) {
    const mood = PetState.get('mood') ?? MOOD_CONFIG.initialMood
    const exp = PetState.get('exp') || 0
    const level = PetState.get('level') || 1
    const adjustedExp = Math.round(EXP_CONFIG.interactionExp * getExpMultiplier(mood))
    const result = addExp(exp, level, adjustedExp)
    PetState.set('exp', result.newExp)
    if (result.leveledUp) {
      PetState.set('level', result.newLevel)
      showBubble(`🎉 升级了！Lv.${result.newLevel}！`)
    }
  } else if (!_dailyCapHintShown) {
    _dailyCapHintShown = true
    showBubble('今天的互动经验已经领完啦～（每日20次）')
  }
}

// ── 点击心情加成 ──
// 每日上限由 MOOD_CONFIG.clickDailyCap 控制（默认 20 次）
function grantClickMoodBoost() {
  const today = new Date().toISOString().slice(0, 10)
  const lastClickDate = PetState.get('lastMoodClickDate')
  let dailyClicks = PetState.get('dailyMoodClicks') || 0

  if (lastClickDate !== today) {
    dailyClicks = 0
  }

  if (dailyClicks >= MOOD_CONFIG.clickDailyCap) return

  const mood = PetState.get('mood') ?? MOOD_CONFIG.initialMood
  const boost = getClickBoost(mood)
  const newMood = boostMood(mood, boost)
  PetState.set('mood', newMood)
  PetState.set('dailyMoodClicks', dailyClicks + 1)
  PetState.set('lastMoodClickDate', today)
}

// 点击 / 拖拽 区分
let clickTimer = null
let clickDownPos = null

body.addEventListener('pointerdown', (e) => {
  clickDownPos = { x: e.clientX, y: e.clientY }
})

body.addEventListener('click', async (e) => {
  // 拖拽检测：移动超过 3px 视为拖拽，不出气泡
  if (clickDownPos) {
    const dx = e.clientX - clickDownPos.x
    const dy = e.clientY - clickDownPos.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) return
  }

  // 300ms 延迟：为未来双击预留，期间第二次点击取消气泡
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    await PetState.flush()
    window.electronAPI.toggleWindow()  // 双击 → 切换面板
    return
  }
  clickTimer = setTimeout(() => {
    clickTimer = null
    showBubble()
    grantInteractionExp()
    grantClickMoodBoost()
  }, 300)
})

// ── 饱腹值衰减结算 ──

// 执行一次饱腹衰减结算：计算时间差 → 扣饱腹
// 用于离线恢复和在线定时结算
// 心情不再由饱腹单独决定，已拆分为独立的 settleMoodDecay()
function settleSatietyDecay() {
  const now = new Date().toISOString()
  const lastUpdate = PetState.get('lastSatietyUpdate')
  const satiety = PetState.get('satiety') ?? 0
  const decay = calcDecay(lastUpdate, now)

  if (decay > 0) {
    const newSatiety = reduceSatiety(satiety, decay)
    PetState.set('satiety', newSatiety)
    PetState.set('lastSatietyUpdate', now)
  } else if (!lastUpdate) {
    // 首次启动，初始化时间戳
    PetState.set('lastSatietyUpdate', now)
  }
}

// ── 心情衰减结算 ──
// 独立的心情衰减：按自然日分段 + 单日 50 点上限 + 饱腹 < 30 翻倍速率
// 首次启动（lastMoodUpdate=null）仅初始化时间戳，不扣心情
function settleMoodDecay() {
  const now = new Date().toISOString()
  const lastUpdate = PetState.get('lastMoodUpdate')
  const mood = PetState.get('mood') ?? MOOD_CONFIG.initialMood
  const satiety = PetState.get('satiety') ?? 100
  const isHungry = satiety < MOOD_CONFIG.hungerAccelThreshold

  const today = new Date().toISOString().slice(0, 10)
  const lastDecayDate = PetState.get('lastMoodDecayDate')
  // 不在此处重置 todayAccumulated：它代表 lastMoodUpdate 所在日的已累计衰减，
  // 直接传给 calcMoodDecay 作为 segment 1 的当日额度消耗量。
  // 若 lastMoodUpdate 是昨天，todayAccumulated 记录的是昨天的值，不应清零，
  // 否则 segment 1（昨天）会获得全新 50 点配额，造成衰减过量。
  const todayAccumulated = PetState.get('todayMoodDecay') || 0

  const decay = calcMoodDecay(lastUpdate, now, isHungry, todayAccumulated)

  if (decay > 0) {
    const newMood = reduceMood(mood, decay)
    PetState.set('mood', newMood)
    PetState.set('lastMoodUpdate', now)
    PetState.set('lastMoodDecayDate', today)

    // 跨天：单独计算今天部分的衰减量，保证 todayMoodDecay 准确
    if (lastDecayDate && lastDecayDate !== today) {
      const todayMidnight = new Date()
      todayMidnight.setHours(0, 0, 0, 0)
      const todayOnlyDecay = calcMoodDecay(todayMidnight.toISOString(), now, isHungry, 0)
      PetState.set('todayMoodDecay', todayOnlyDecay)
    } else {
      PetState.set('todayMoodDecay', todayAccumulated + decay)
    }
  } else if (!lastUpdate) {
    // 首次启动，初始化时间戳
    PetState.set('lastMoodUpdate', now)
    PetState.set('lastMoodDecayDate', today)
  }
}

// 启动在线定时结算（每 60s 一次，饱腹 + 心情）
function startSatietyTick() {
  if (satietyTickTimer) clearInterval(satietyTickTimer)
  satietyTickTimer = setInterval(() => {
    settleSatietyDecay()
    settleMoodDecay()
  }, SATIETY_CONFIG.onlineTickMs)
}

// ── 初始化 ──
async function init() {
  await PetState.init()

  // 迁移旧心情存档（string → number）
  const oldMood = PetState.get('mood')
  const newMood = migrateMood(oldMood)
  if (newMood !== oldMood) {
    PetState.set('mood', newMood)
  }

  // 结算离线衰减 + 启动在线定时器
  settleSatietyDecay()
  settleMoodDecay()
  startSatietyTick()

  const pos = await window.electronAPI.getWindowPosition()
  winPos = pos

  // 清理旧监听器（防止 loadFile 切换页面后累积）
  if (_unsubUserDrag) _unsubUserDrag()
  if (_unsubWanderToggle) _unsubWanderToggle()
  if (_unsubMenuFeed) _unsubMenuFeed()
  if (_unsubMenuStatus) _unsubMenuStatus()

  _unsubUserDrag = window.electronAPI.onUserDrag(onUserDrag)
  _unsubWanderToggle = window.electronAPI.onWanderToggle(onWanderToggle)

  // 右键菜单 — 喂食
  _unsubMenuFeed = window.electronAPI.onMenuFeed(async () => {
    const foodInventory = PetState.get('foodInventory') || []
    const invMap = {}
    foodInventory.forEach(item => { invMap[item.id] = item.count })

    const items = Object.values(FOODS)
      .map(food => ({ ...food, count: invMap[food.id] || 0 }))
      .sort((a, b) => b.count - a.count)

    const hasFood = items.some(item => item.count > 0)
    if (!hasFood) {
      showBubble('没有食物了... 🥺')
      // 仍然弹 overlay，食物全灰色 ×0，用户可进仓库
    }

    // 防止 overlay 重复打开（showOverlay 单实例，二次调用返回 null）
    if (overlayActive) return

    // 构建 overlay HTML（暗色主题，对齐 infra-03 overlay 风格）
    let html = `<style>
.food-row { display:flex; align-items:center; padding:8px 12px; cursor:pointer; border-radius:6px; margin:2px 0; transition:background 0.15s; }
.food-row:hover { background:rgba(255,255,255,0.08); }
.food-row--empty { opacity:0.30; }
.food-emoji { font-size:18px; margin-right:10px; }
.food-name { flex:1; font-size:14px; }
.food-count { font-size:13px; color:#aaa; }
.food-satiety { font-size:12px; color:#7eb; margin-left:4px; }
.food-divider { margin:8px 0; border-top:1px solid rgba(255,255,255,0.12); }
.food-bottom { display:flex; align-items:center; justify-content:space-between; padding:4px 0; }
.food-warehouse { color:#aaa; font-size:13px; cursor:pointer; padding:6px 4px; }
.food-warehouse:hover { color:#ddd; }
</style>`

    items.forEach(item => {
      const satietyLabel = `+${item.satiety}`
      if (item.count > 0) {
        html += `<div class="food-row" data-overlay-result="${item.id}">
          <span class="food-emoji">${item.emoji}</span>
          <span class="food-name">${item.name}</span>
          <span class="food-count">×${item.count}</span>
          <span class="food-satiety">${satietyLabel}</span>
        </div>`
      } else {
        html += `<div class="food-row food-row--empty">
          <span class="food-emoji">${item.emoji}</span>
          <span class="food-name">${item.name}</span>
          <span class="food-count">×0</span>
          <span class="food-satiety">${satietyLabel}</span>
        </div>`
      }
    })

    html += `<div class="food-divider"></div>
<div class="food-bottom">
  <button data-overlay-result="null">取消</button>
  <span class="food-warehouse" data-overlay-result="__warehouse__">📦 打开仓库 →</span>
</div>`

    // 暂停走动
    overlayActive = true
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
    glideToken++
    body.classList.remove('moving')

    const result = await window.electronAPI.showOverlay({
      html,
      width: 180,
      height: 200,
      x: 160,
      y: 0,
    })

    // 恢复走动
    overlayActive = false
    scheduleWander()

    if (result === null || result === undefined) return

    if (result === '__warehouse__') {
      await PetState.flush()
      window.electronAPI.toggleWindow()
      return
    }

    const food = FOODS[result]
    if (!food) return

    const level = PetState.get('level') || 1
    const satiety = PetState.get('satiety') || 0
    const maxSatiety = calcMaxSatiety(level)
    if (satiety >= maxSatiety) {
      showBubble('已经吃饱了 🍽')
      return
    }

    // 消耗食物
    const { newInventory } = consumeFood(result, foodInventory)
    PetState.set('foodInventory', newInventory)

    // 更新饱腹 + 亲密度（上限由等级决定）
    const intimacy = PetState.get('intimacy') || 0
    const { newSatiety, newIntimacy } = applyFeed(satiety, intimacy, food, level)
    PetState.set('satiety', newSatiety)
    PetState.set('intimacy', newIntimacy)

    // 喂食加心情
    const currentMood = PetState.get('mood') ?? MOOD_CONFIG.initialMood
    const newMoodVal = boostMood(currentMood, MOOD_CONFIG.feedBoost)
    PetState.set('mood', newMoodVal)

    // 发投喂事件
    emitFed(result)

    // 喂食经验结算（心情加成 + 复用外层 level，避免重复取值）
    const foodExp = getFoodExp(food)
    if (foodExp > 0) {
      const exp = PetState.get('exp') || 0
      const adjustedExp = Math.round(foodExp * getExpMultiplier(newMoodVal))
      const addResult = addExp(exp, level, adjustedExp)
      PetState.set('exp', addResult.newExp)
      if (addResult.leveledUp) {
        PetState.set('level', addResult.newLevel)
        showBubble(`🎉 升级了！Lv.${addResult.newLevel}！`)
      }
    }

    showBubble(`投喂了${food.name}！`)
  })

  // 右键菜单 — 状态
  _unsubMenuStatus = window.electronAPI.onMenuStatus(async () => {
    await PetState.flush()
    window.electronAPI.toggleWindow()
  })

  scheduleWander()
}

init()
