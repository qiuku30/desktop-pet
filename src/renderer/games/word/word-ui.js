// 英语单词模块 UI — 首页 + 学习 + 复习 + 设置
//
// 职责：
// - mountWordPage(container) → 返回 unmount 清理函数
// - 首页：进度统计 + 入口按钮 + 搜索 + 齿轮设置入口
// - 新词学习：翻卡 + 自评 + FSRS 调度 + 分组弹窗
// - 复习：两阶段展示 + 4 选 1 选择题 + FSRS 调度 + 分组弹窗
// - 设置（独立页面）：词库多选 + 每日上限 + 组大小，即时保存
//
// 依赖：PetState / EventBus / word-service.js / IPC (word:lookup / word:batch-lookup / word:choices)

import { PetState } from '../../shared/pet-state.js'
import { EventBus } from '../../shared/event-bus.js'
import { EVENTS } from '../../shared/events.js'
import {
  getStats, getDueWords, getNextNewWords,
  scheduleReview, initLearnedWord,
} from '../../shared/word-service.js'
import { mountWordBook } from './word-book-ui.js'

// ══════════════════════════════════════════════════════
// CSS（自包含，mount 时注入 <style>）
// ══════════════════════════════════════════════════════

const CSS_TEXT = `
.page--word{display:flex;flex-direction:column;height:100%;overflow-y:auto;color:#ccc;font-family:'Microsoft YaHei','PingFang SC',sans-serif;position:relative}
.page--word::-webkit-scrollbar{width:6px}
.page--word::-webkit-scrollbar-thumb{background:#555;border-radius:3px}

/* ── 首页 ── */
.word-home{display:flex;flex-direction:column;gap:20px;padding:20px 16px}
.word-home-topbar{display:flex;justify-content:flex-end;margin-bottom:-12px}
.word-gear-btn{background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;color:#888;transition:color .15s,transform .15s;line-height:1}
.word-gear-btn:hover{color:#ccc;transform:rotate(30deg)}

.word-home-search{display:flex;gap:8px;align-items:center}
.word-home-search-input{flex:1;padding:10px 14px;border:1px solid #444;border-radius:8px;background:#2c2c2c;color:#ccc;font-size:14px;font-family:inherit;transition:border-color .15s;box-sizing:border-box}
.word-home-search-input:focus{outline:none;border-color:#2196f3}
.word-home-search-input::placeholder{color:#666}
.word-home-search-btn{background:#2c2c2c;border:1px solid #444;border-radius:8px;color:#888;font-size:16px;cursor:pointer;padding:10px 14px;transition:border-color .15s,color .15s;line-height:1}
.word-home-search-btn:hover{border-color:#2196f3;color:#ccc}
.word-home-search-input:disabled,.word-home-search-btn:disabled{opacity:.5;pointer-events:none}

.word-stats{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
.word-stat-card{display:flex;flex-direction:column;align-items:center;gap:4px;background:#2c2c2c;border:1px solid #333;border-radius:10px;padding:14px 20px;min-width:100px;user-select:none}
.word-stat-icon{font-size:24px}
.word-stat-value{font-size:22px;font-weight:bold;color:#fff}
.word-stat-label{font-size:11px;color:#888}
.word-stat-value--due{color:#ff6b6b}
.word-stat-value--streak{color:#ffc107}

.word-entry-buttons{display:flex;flex-direction:column;gap:10px;align-items:center}
.word-entry-btn{width:100%;max-width:320px;padding:14px 24px;border:1px solid #444;border-radius:10px;background:#2c2c2c;color:#ccc;font-size:15px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s;user-select:none;text-align:center}
.word-entry-btn:hover{background:#3a3a3a;border-color:#2196f3;color:#fff}
.word-entry-btn--primary{border-color:#2196f3;color:#2196f3}
.word-entry-btn--primary:hover{background:#2196f3;color:#fff}
.word-entry-btn--disabled{opacity:.4;pointer-events:none;border-color:#444;color:#666}
.word-entry-btn--disabled:hover{background:#2c2c2c;border-color:#444;color:#666}

/* ── 设置页 ── */
.word-settings-page{display:flex;flex-direction:column;gap:20px;padding:20px 16px}
.word-settings-page-header{display:flex;align-items:center;gap:12px;user-select:none}
.word-settings-page-back{background:none;border:1px solid #444;border-radius:6px;color:#999;font-size:13px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.word-settings-page-back:hover{border-color:#888;color:#ccc}
.word-settings-page-title{font-size:18px;font-weight:bold;color:#fff}
.word-settings-section{margin-top:4px}
.word-settings-section-title{font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;user-select:none}

/* 设置项（复用首页原来的样式） */
.word-settings-row{display:flex;flex-direction:column;gap:6px}
.word-settings-label{font-size:13px;color:#999;user-select:none}
.word-settings-banks{display:flex;flex-wrap:wrap;gap:8px}
.word-settings-bank{display:flex;align-items:center;gap:6px;background:#2c2c2c;border:1px solid #333;border-radius:8px;padding:8px 12px;cursor:pointer;user-select:none;transition:border-color .15s,background .15s}
.word-settings-bank:hover{border-color:#555}
.word-settings-bank--selected{border-color:#2196f3;background:rgba(33,150,243,.1)}
.word-settings-bank input{display:none}
.word-settings-bank-icon{font-size:16px}
.word-settings-bank-name{font-size:13px;color:#ccc}
.word-settings-bank-count{font-size:11px;color:#666}

.word-settings-input-row{display:flex;align-items:center;gap:8px}
.word-settings-stepper{width:28px;height:28px;border:1px solid #444;border-radius:6px;background:#2c2c2c;color:#ccc;font-size:16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s;user-select:none;padding:0;line-height:1}
.word-settings-stepper:hover{background:#3a3a3a;border-color:#888;color:#fff}
.word-settings-value{min-width:36px;text-align:center;font-size:15px;font-weight:bold;color:#fff;user-select:none}
.word-settings-hint{font-size:11px;color:#666}

.word-settings-input{width:80px;padding:6px 10px;border:1px solid #444;border-radius:6px;background:#1e1e1e;color:#ccc;font-size:13px;font-family:inherit;text-align:center}
.word-settings-input:focus{outline:none;border-color:#2196f3}

/* ── 学习页 / 复习页 公共 ── */
.word-session{display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 16px}
.word-session-header{display:flex;justify-content:space-between;align-items:center;width:100%;max-width:400px;user-select:none}
.word-session-back{background:none;border:1px solid #444;border-radius:6px;color:#999;font-size:13px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.word-session-back:hover{border-color:#888;color:#ccc}
.word-session-progress{font-size:13px;color:#888}

/* ── 卡片 ── */
.word-card-wrap{width:100%;max-width:400px;perspective:800px}
.word-card{position:relative;width:100%;min-height:240px;cursor:pointer;user-select:none}
.word-card-inner{position:relative;width:100%;min-height:240px;transition:transform .5s ease;transform-style:preserve-3d}
.word-card-inner--flipped{transform:rotateY(180deg)}
.word-card-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px 24px;background:#2c2c2c;border:1px solid #333;border-radius:12px;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.word-card-back{transform:rotateY(180deg)}
.word-card-front-hint{font-size:13px;color:#666;margin-top:8px}

.word-card-word{font-size:32px;font-weight:bold;color:#fff;letter-spacing:1px}
.word-card-phonetic{font-size:15px;color:#888}
.word-card-definition{font-size:17px;color:#e0e0e0;text-align:center;line-height:1.5}
.word-card-example{font-size:13px;color:#999;text-align:center;line-height:1.4;font-style:italic}
.word-card-pos{font-size:12px;color:#666}

.word-card-actions{display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;justify-content:center}
.word-card-fav{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;transition:transform .15s;line-height:1}
.word-card-fav:hover{transform:scale(1.2)}
.word-card-fav--active{filter:none}
.word-card-fav:not(.word-card-fav--active){opacity:.3}
.word-card-rate-btn{padding:10px 24px;border:1px solid #444;border-radius:8px;background:transparent;color:#ccc;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.word-card-rate-btn:hover{border-color:#888;color:#fff}
.word-card-rate-btn--good{border-color:#4caf50;color:#4caf50}
.word-card-rate-btn--good:hover{background:#4caf50;color:#fff}
.word-card-rate-btn--again{border-color:#ff9800;color:#ff9800}
.word-card-rate-btn--again:hover{background:#ff9800;color:#fff}

/* ── 复习选择题 ── */
.word-review-stage{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;max-width:400px}
.word-review-word{font-size:32px;font-weight:bold;color:#fff;letter-spacing:1px;user-select:none;cursor:pointer;padding:20px;text-align:center}
.word-review-hint{font-size:13px;color:#666;user-select:none}
.word-choices{display:flex;flex-direction:column;gap:8px;width:100%}
.word-choice-btn{width:100%;padding:12px 16px;border:1px solid #444;border-radius:8px;background:#2c2c2c;color:#ccc;font-size:14px;font-family:inherit;cursor:pointer;text-align:center;transition:background .15s,border-color .15s,color .15s;user-select:none}
.word-choice-btn:hover{border-color:#888;color:#fff;background:#3a3a3a}
.word-choice-btn--correct{border-color:#4caf50!important;background:rgba(76,175,80,.2)!important;color:#4caf50!important}
.word-choice-btn--wrong{border-color:#e81123!important;background:rgba(232,17,35,.2)!important;color:#e81123!important}
.word-choice-btn--disabled{pointer-events:none;opacity:.7}
.word-forgot-btn{background:none;border:none;color:#888;font-size:13px;cursor:pointer;padding:8px;font-family:inherit;transition:color .15s}
.word-forgot-btn:hover{color:#ccc}

/* ── 复习反馈卡片（选错/忘时展示完整信息）── */
.word-review-result{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;background:#2c2c2c;border:1px solid #333;border-radius:12px;width:100%;max-width:400px;text-align:center}
.word-review-result-icon{font-size:40px}
.word-review-result-word{font-size:28px;font-weight:bold;color:#fff}
.word-review-result-info{font-size:15px;color:#ccc;line-height:1.6}
.word-review-result-confirm{padding:10px 32px;border:1px solid #2196f3;border-radius:8px;background:transparent;color:#2196f3;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;margin-top:8px}
.word-review-result-confirm:hover{background:#2196f3;color:#fff}

/* ── 弹窗（分组完成）── */
.word-overlay{position:absolute;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:10}
.word-modal{background:#2c2c2c;border:1px solid #444;border-radius:12px;padding:24px;min-width:260px;max-width:320px;display:flex;flex-direction:column;gap:16px;user-select:none;animation:word-modal-in .2s ease-out}
@keyframes word-modal-in{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.word-modal-title{font-size:17px;font-weight:bold;color:#fff;text-align:center}
.word-modal-body{font-size:13px;color:#999;text-align:center;line-height:1.5}
.word-modal-buttons{display:flex;flex-direction:column;gap:8px}
.word-modal-btn{width:100%;padding:10px 16px;border:1px solid #444;border-radius:8px;background:transparent;color:#ccc;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s;text-align:center}
.word-modal-btn:hover{border-color:#888;color:#fff}
.word-modal-btn--primary{border-color:#2196f3;color:#2196f3}
.word-modal-btn--primary:hover{background:#2196f3;color:#fff}
.word-modal-btn--secondary{color:#888}
.word-modal-btn--secondary:hover{color:#ccc}

/* ── 状态提示 ── */
.word-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 20px;text-align:center}
.word-empty-icon{font-size:40px}
.word-empty-text{font-size:15px;color:#888;line-height:1.5}

/* ── 查词结果卡片 ── */
.word-lookup-overlay{position:absolute;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:flex-start;justify-content:center;padding-top:30px;z-index:10;overflow-y:auto}
.word-lookup-card{width:90%;max-width:420px;background:#2c2c2c;border:1px solid #444;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:14px;animation:word-modal-in .2s ease-out;margin-bottom:30px}
.word-lookup-close{align-self:flex-end;background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:0 4px;line-height:1}
.word-lookup-close:hover{color:#ccc}
.word-lookup-word{font-size:30px;font-weight:bold;color:#fff;letter-spacing:1px}
.word-lookup-phonetic{font-size:15px;color:#888}
.word-lookup-defs{width:100%;text-align:center}
.word-lookup-def-item{font-size:16px;color:#e0e0e0;line-height:1.6}
.word-lookup-example{width:100%;text-align:center;margin-top:4px;padding:12px;background:rgba(255,255,255,.03);border-radius:8px}
.word-lookup-example-en{font-size:13px;color:#bbb;font-style:italic;line-height:1.5}
.word-lookup-example-cn{font-size:12px;color:#777;margin-top:4px}
.word-lookup-meta{width:100%;display:flex;justify-content:center;gap:16px;padding-top:4px;border-top:1px solid #333;margin-top:6px}
.word-lookup-source{font-size:12px;color:#666}
.word-lookup-status{font-size:12px;color:#4caf50}
.word-lookup-actions{display:flex;gap:10px;margin-top:8px}
.word-lookup-btn{padding:10px 20px;border:1px solid #444;border-radius:8px;background:transparent;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s;user-select:none;display:flex;align-items:center;gap:6px}
.word-lookup-btn:hover{border-color:#888;color:#fff}
.word-lookup-btn--fav{border-color:#ffc107;color:#ffc107}
.word-lookup-btn--fav:hover{background:rgba(255,193,7,.15)}
.word-lookup-btn--fav-active{background:rgba(255,193,7,.2);border-color:#ffc107;color:#ffc107}
.word-lookup-notfound{padding:40px;text-align:center;color:#888;font-size:15px}
`

// ══════════════════════════════════════════════════════
// 词库加载（动态 import JSON，懒加载 + 缓存）
// ══════════════════════════════════════════════════════

const BANK_LOADERS = {
  cet4:  () => import('../../assets/word-banks/cet4.json',     { with: { type: 'json' } }),
  cet6:  () => import('../../assets/word-banks/cet6.json',     { with: { type: 'json' } }),
  postgrad: () => import('../../assets/word-banks/postgrad.json', { with: { type: 'json' } }),
  ielts: () => import('../../assets/word-banks/ielts.json',    { with: { type: 'json' } }),
  toefl: () => import('../../assets/word-banks/toefl.json',    { with: { type: 'json' } }),
}

/** @type {Map<string, {id:string,name:string,icon:string,count:number,words:string[]}>} */
const _bankCache = new Map()

/** 词库 id → 显示名称（同步可用） */
const BANK_INFO = {
  cet4:     { name: 'CET-4 四级' },
  cet6:     { name: 'CET-6 六级' },
  postgrad: { name: '考研' },
  ielts:    { name: '雅思' },
  toefl:    { name: 'TOEFL' },
}

/**
 * 加载词库数据（含完整词表）。结果缓存，重复调用不重新加载。
 * @param {string} bankId
 * @returns {Promise<Object|null>}
 */
async function loadBank(bankId) {
  if (_bankCache.has(bankId)) return _bankCache.get(bankId)

  const loader = BANK_LOADERS[bankId]
  if (!loader) return null

  try {
    const mod = await loader()
    _bankCache.set(bankId, mod.default)
    return mod.default
  } catch (err) {
    console.error(`[word-ui] 加载词库 ${bankId} 失败:`, err)
    return null
  }
}

// ══════════════════════════════════════════════════════
// 辅助
// ══════════════════════════════════════════════════════

/**
 * 获取 wordProgress（深拷贝）。
 */
function getWordProgress() {
  return PetState.get('wordProgress') || {
    settings: { dailyGoal: 10, learnGroupSize: 10, reviewGroupSize: 15, selectedBanks: ['cet4'] },
    streak: { current: 0, lastStudyDate: null },
    words: {},
  }
}

/**
 * 保存 wordProgress 并 flush。
 */
function saveWordProgress(wp) {
  PetState.set('wordProgress', wp)
}

/**
 * 更新连续打卡天数。
 */
function updateStreak(wp) {
  const today = new Date().toISOString().slice(0, 10)
  const streak = wp.streak || { current: 0, lastStudyDate: null }

  if (streak.lastStudyDate === today) return // 今天已打过卡

  // 必须达到每日目标才能打卡
  const remaining = wordsToGoal(wp)
  if (remaining > 0) return // 还没达标，不打 spark

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  let newStreak
  if (streak.lastStudyDate === yesterday) {
    newStreak = streak.current + 1
  } else {
    newStreak = 1 // 断了，重新开始
  }

  wp.streak = { current: newStreak, lastStudyDate: today }

  // 检查里程碑
  const totalWords = Object.values(wp.words || {}).filter(s => s.state && s.state !== 'new').length
  const milestones = [100, 200, 500, 1000, 2000, 5000]
  for (const m of milestones) {
    if (totalWords >= m && totalWords - 1 < m) {
      EventBus.emit(EVENTS.WORD_MILESTONE, { total: totalWords, milestone: m })
    }
  }

  EventBus.emit(EVENTS.WORD_STREAK_CHANGED, { current: newStreak })
}

/**
 * 距离每日目标还差多少个。负数表示已超额完成。
 */
function wordsToGoal(wp) {
  const goal = wp.settings?.dailyGoal ?? 10
  const today = new Date().toISOString().slice(0, 10)
  const learnedToday = Object.values(wp.words || {}).filter(s => {
    if (!s.lastReview) return false
    return s.lastReview.slice(0, 10) === today && s.state !== 'new'
  }).length
  return goal - learnedToday // ≥0: 未达标, <0: 已超额
}

// ══════════════════════════════════════════════════════
// 模块级状态（跨子页面保留）
// ══════════════════════════════════════════════════════

let _styleEl = null
let _currentPage = 'home'       // 'home' | 'learn' | 'review' | 'settings' | 'wordbook'
let _cleanupCurrent = null      // 当前子页面的清理函数
let _container = null

// ══════════════════════════════════════════════════════
// 导航
// ══════════════════════════════════════════════════════

function navigateTo(page) {
  if (_cleanupCurrent) {
    _cleanupCurrent()
    _cleanupCurrent = null
  }
  _currentPage = page
  switch (page) {
    case 'home':     _cleanupCurrent = renderHome(_container); break
    case 'learn':    _cleanupCurrent = renderLearn(_container); break
    case 'review':   _cleanupCurrent = renderReview(_container); break
    case 'settings': _cleanupCurrent = renderSettings(_container); break
    case 'wordbook':
      _cleanupCurrent = mountWordBook(_container, {
        onBack: () => navigateTo('home'),
      })
      break
  }
}

// ══════════════════════════════════════════════════════
// 首页
// ══════════════════════════════════════════════════════

function renderHome(container) {
  container.className = 'page page--word'
  const wp = getWordProgress()
  const stats = getStats(wp)
  let pageActive = true

  // ── 渲染 ──
  container.innerHTML = `
    <div class="word-home">
      <div class="word-home-topbar">
        <button class="word-gear-btn" id="word-gear-btn" title="设置">⚙️</button>
      </div>

      <div class="word-home-search">
        <input class="word-home-search-input" id="word-home-search-input"
               type="text" placeholder="🔍 查单词...">
        <button class="word-home-search-btn" id="word-home-search-btn">🔍</button>
      </div>

      <div class="word-stats">
        <div class="word-stat-card">
          <span class="word-stat-icon">📚</span>
          <span class="word-stat-value" id="word-stat-total">${stats.totalWords}</span>
          <span class="word-stat-label">已学词汇</span>
        </div>
        <div class="word-stat-card">
          <span class="word-stat-icon">🔴</span>
          <span class="word-stat-value word-stat-value--due" id="word-stat-due">${stats.dueCount}</span>
          <span class="word-stat-label">待复习</span>
        </div>
        <div class="word-stat-card">
          <span class="word-stat-icon">🔥</span>
          <span class="word-stat-value word-stat-value--streak" id="word-stat-streak">${stats.streak}</span>
          <span class="word-stat-label">连续打卡</span>
        </div>
      </div>

      <div class="word-curr-bank" id="word-curr-bank"></div>

      <div class="word-entry-buttons">
        <button class="word-entry-btn word-entry-btn--primary" id="word-btn-review">
          📋 复习${stats.dueCount > 0 ? ` (${stats.dueCount})` : ''}
        </button>
        <button class="word-entry-btn word-entry-btn--primary" id="word-btn-learn">
          📖 学新词
        </button>
        <button class="word-entry-btn" id="word-btn-book">
          📖 单词本
        </button>
      </div>
    </div>
  `

  // ── 显示当前词库 ──
  const currBankEl = container.querySelector('#word-curr-bank')
  if (currBankEl) {
    const banks = wp.settings?.selectedBanks || ['cet4']
    const names = banks.map(id => {
      const meta = BANK_INFO[id]
      return (meta && meta.name) ? meta.name : id.toUpperCase()
    }).join(' / ')
    currBankEl.textContent = '📚 当前：' + names
  }

  // ── 齿轮按钮 → 设置页 ──
  container.querySelector('#word-gear-btn').addEventListener('click', () => {
    if (!pageActive) return
    navigateTo('settings')
  })

  // ── 查词搜索 ──
  const searchInput = container.querySelector('#word-home-search-input')
  const searchBtn = container.querySelector('#word-home-search-btn')
  let searchLoading = false
  let searchTimeout = null
  // 存储上一次搜索的 overlay，用于清除
  let _searchOverlay = null

  function clearSearchOverlay() {
    if (_searchOverlay && _searchOverlay.parentNode) {
      _searchOverlay.remove()
      _searchOverlay = null
    }
  }

  async function doSearch() {
    if (searchLoading || !pageActive) return
    const query = searchInput.value.trim()
    if (!query) return

    clearSearchOverlay()
    searchLoading = true
    searchInput.disabled = true
    if (searchBtn) searchBtn.disabled = true

    try {
      const results = await window.electronAPI.word.search(query, 20)
      if (!pageActive) return
      if (results.length === 0) {
        showLookupNotFound(container, query)
      } else if (results.length === 1) {
        showLookupResult(container, results[0])
      } else {
        showSearchResults(container, query, results)
      }
    } catch (err) {
      console.error('[word-ui] 查词失败:', err)
      if (pageActive) showLookupNotFound(container, query)
    } finally {
      searchLoading = false
      searchInput.disabled = false
      if (searchBtn) searchBtn.disabled = false
    }
  }

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch()
  })
  // 输入时自动联想
  searchInput.addEventListener('input', () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    const query = searchInput.value.trim()
    if (!query || query.length < 1) { clearSearchOverlay(); return }
    searchTimeout = setTimeout(async () => {
      if (!pageActive) return
      try {
        const results = await window.electronAPI.word.search(query, 8)
        if (!pageActive || document.activeElement !== searchInput) return
        if (results.length > 0) {
          _searchOverlay = showSearchDropdown(container, searchInput, results, entry => {
            clearSearchOverlay()
            showLookupResult(container, entry)
          })
        } else {
          clearSearchOverlay()
        }
      } catch (_) { /* 联想失败静默忽略 */ }
    }, 200)
  })
  if (searchBtn) {
    searchBtn.addEventListener('click', () => doSearch())
  }

  // 点击搜索框外关闭联想下拉
  container.addEventListener('click', (e) => {
    if (e.target !== searchInput) clearSearchOverlay()
  })

  // ── 按钮事件 ──
  const btnReview = container.querySelector('#word-btn-review')
  const btnLearn = container.querySelector('#word-btn-learn')

  btnReview.addEventListener('click', () => {
    if (!pageActive) return
    const wp2 = getWordProgress()
    const due = getDueWords(wp2.words || {})
    if (due.length === 0) {
      showToast('没有需要复习的单词 🎉')
      return
    }
    navigateTo('review')
  })

  btnLearn.addEventListener('click', async () => {
    if (!pageActive) return
    const wp2 = getWordProgress()
    const banks2 = wp2.settings?.selectedBanks || ['cet4']
    // 粗略检查是否有未学词
    const learnedSet = new Set(Object.keys(wp2.words || {}))
    let hasWords = false
    for (const bid of banks2) {
      const bank = await loadBank(bid)
      if (!bank) continue
      if (bank.words.some(w => !learnedSet.has(w))) { hasWords = true; break }
    }
    if (!hasWords) {
      showToast('所选词库中所有单词都已学过 🎉')
      return
    }
    navigateTo('learn')
  })

  // 单词本按钮
  const btnBook = container.querySelector('#word-btn-book')
  btnBook.addEventListener('click', () => {
    if (!pageActive) return
    navigateTo('wordbook')
  })

  return () => {
    pageActive = false
    const overlay = container.querySelector('.word-lookup-overlay')
    if (overlay) overlay.remove()
  }
}

// ══════════════════════════════════════════════════════
// 设置页（独立页面）
// ══════════════════════════════════════════════════════

function renderSettings(container) {
  container.className = 'page page--word'
  let pageActive = true

  const wp = getWordProgress()
  const banks = wp.settings?.selectedBanks || ['cet4']
  const settings = wp.settings || { dailyGoal: 10, learnGroupSize: 10, reviewGroupSize: 15, selectedBanks: ['cet4'] }

  // ── 渲染 ──
  container.innerHTML = `
    <div class="word-settings-page">
      <div class="word-settings-page-header">
        <button class="word-settings-page-back" id="word-settings-back">← 返回</button>
        <span class="word-settings-page-title">⚙️ 单词设置</span>
      </div>

      <div class="word-settings-section">
        <div class="word-settings-section-title">词库选择</div>
        <div class="word-settings-banks" id="word-settings-banks">
          ${['cet4','cet6','postgrad','ielts','toefl'].map(id =>
            `<label class="word-settings-bank word-settings-bank--placeholder" data-bank-id="${id}">
              <input type="checkbox" ${banks.includes(id) ? 'checked' : ''}>
              <span class="word-settings-bank-icon">📗</span>
              <span class="word-settings-bank-name">加载中...</span>
            </label>`
          ).join('')}
        </div>
      </div>

      <div class="word-settings-section">
        <div class="word-settings-section-title">学习参数</div>

        <div class="word-settings-row">
          <span class="word-settings-label">每日目标</span>
          <div class="word-settings-input-row">
            <button class="word-settings-stepper" id="word-setting-daily-down">−</button>
            <span class="word-settings-value" id="word-setting-daily-value">${settings.dailyGoal}</span>
            <button class="word-settings-stepper" id="word-setting-daily-up">+</button>
            <span class="word-settings-hint">1-50，达成目标可点亮今日打卡 🔥</span>
          </div>
        </div>

        <div class="word-settings-row">
          <span class="word-settings-label">每组学习数量</span>
          <div class="word-settings-input-row">
            <button class="word-settings-stepper" id="word-setting-learn-down">−</button>
            <span class="word-settings-value" id="word-setting-learn-value">${settings.learnGroupSize}</span>
            <button class="word-settings-stepper" id="word-setting-learn-up">+</button>
            <span class="word-settings-hint">5-30</span>
          </div>
        </div>

        <div class="word-settings-row">
          <span class="word-settings-label">每组复习数量</span>
          <div class="word-settings-input-row">
            <button class="word-settings-stepper" id="word-setting-review-down">−</button>
            <span class="word-settings-value" id="word-setting-review-value">${settings.reviewGroupSize}</span>
            <button class="word-settings-stepper" id="word-setting-review-up">+</button>
            <span class="word-settings-hint">5-50</span>
          </div>
        </div>
      </div>
    </div>
  `

  // ── 更新今日配额 ──
  const quotaEl = container.querySelector('#word-quota')
  if (quotaEl) quotaEl.textContent = wordsToGoal(wp)

  // ── 异步加载词库元数据并更新 UI ──
  const banksContainer = container.querySelector('#word-settings-banks')
  for (const bankId of ['cet4', 'cet6', 'postgrad', 'ielts', 'toefl']) {
    loadBank(bankId).then(bank => {
      if (!pageActive || !bank) return
      const label = container.querySelector(`.word-settings-bank[data-bank-id="${bankId}"]`)
      if (!label) return
      label.classList.remove('word-settings-bank--placeholder')
      if (banks.includes(bankId)) label.classList.add('word-settings-bank--selected')
      const icon = label.querySelector('.word-settings-bank-icon')
      const name = label.querySelector('.word-settings-bank-name')
      if (icon) icon.textContent = bank.icon || '📗'
      if (name) name.textContent = `${bank.name} (${bank.count})`
    })
  }

  // ── 返回按钮 ──
  container.querySelector('#word-settings-back').addEventListener('click', () => {
    if (!pageActive) return
    navigateTo('home')
  })

  // ── 词库选择变更 ──
  banksContainer.addEventListener('change', () => {
    if (!pageActive) return
    const checked = []
    banksContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      checked.push(cb.closest('.word-settings-bank').dataset.bankId)
    })
    if (checked.length === 0) {
      const firstCb = banksContainer.querySelector('input[type="checkbox"]')
      if (firstCb) firstCb.checked = true
      checked.push(firstCb.closest('.word-settings-bank').dataset.bankId)
    }
    const wp3 = getWordProgress()
    wp3.settings = { ...wp3.settings, selectedBanks: checked }
    saveWordProgress(wp3)
    banksContainer.querySelectorAll('.word-settings-bank').forEach(l => {
      l.classList.toggle('word-settings-bank--selected', checked.includes(l.dataset.bankId))
    })
    const qEl = container.querySelector('#word-quota')
    if (qEl) qEl.textContent = wordsToGoal(wp3)
  })

  // ── 数值调节（+ / − 按钮）──
  setupStepper(container, '#word-setting-daily-down', '#word-setting-daily-up', '#word-setting-daily-value', 'dailyGoal', 1, 50)
  setupStepper(container, '#word-setting-learn-down', '#word-setting-learn-up', '#word-setting-learn-value', 'learnGroupSize', 5, 30)
  setupStepper(container, '#word-setting-review-down', '#word-setting-review-up', '#word-setting-review-value', 'reviewGroupSize', 5, 50)

  return () => { pageActive = false }
}

/**
 * 设置页的 +/− 数值调节器。即时保存到 wordProgress.settings[key]。
 */
function setupStepper(container, downSelector, upSelector, valueSelector, key, min, max) {
  const downBtn = container.querySelector(downSelector)
  const upBtn = container.querySelector(upSelector)
  const valueEl = container.querySelector(valueSelector)
  if (!downBtn || !upBtn || !valueEl) return

  function update(delta) {
    const wp2 = getWordProgress()
    const current = wp2.settings?.[key] ?? ((key === 'reviewGroupSize') ? 15 : 10)
    let val = current + delta
    if (val < min) val = min
    if (val > max) val = max
    if (val === current) return
    wp2.settings = { ...wp2.settings, [key]: val }
    saveWordProgress(wp2)
    valueEl.textContent = val
    if (key === 'dailyGoal') {
      const qEl = container.querySelector('#word-quota')
      if (qEl) qEl.textContent = wordsToGoal(wp2)
    }
  }

  downBtn.addEventListener('click', () => update(-1))
  upBtn.addEventListener('click', () => update(1))
}

// ══════════════════════════════════════════════════════
// 查词结果展示
// ══════════════════════════════════════════════════════

/**
 * 展示查词结果卡片（overlay）。
 */
function showLookupResult(container, entry) {
  // 移除已有查词 overlay（如有），防止重复叠加
  const existing = container.querySelector('.word-lookup-overlay')
  if (existing) existing.remove()

  const wp = getWordProgress()
  const wordsMap = wp.words || {}
  const wordState = wordsMap[entry.word] || null
  const isLearned = !!(wordState && wordState.state && wordState.state !== 'new')
  const isFav = !!(wordState && wordState.isFavorited)
  const sourceBank = wordState?.sourceBank || null

  const word = entry.word || ''
  const phonetic = entry.phonetic || ''
  const defText = entry.translation || entry.definition || ''
  const example = entry.detail || ''

  let exampleEn = ''
  let exampleCn = ''
  if (example) {
    const parts = example.split('\n')
    exampleEn = parts[0] || ''
    exampleCn = parts.slice(1).join('\n') || ''
  }

  const bankName = (sourceBank && BANK_INFO[sourceBank]) ? BANK_INFO[sourceBank].name : ''

  const overlay = document.createElement('div')
  overlay.className = 'word-lookup-overlay'
  overlay.innerHTML = `
    <div class="word-lookup-card">
      <button class="word-lookup-close" id="word-lookup-close">✕</button>
      <div class="word-lookup-word">${escapeHTML(word)}</div>
      ${phonetic ? `<div class="word-lookup-phonetic">${escapeHTML(phonetic)}</div>` : ''}
      <div class="word-lookup-defs">
        <div class="word-lookup-def-item">${escapeHTML(defText) || '(无释义)'}</div>
      </div>
      ${exampleEn ? `
        <div class="word-lookup-example">
          <div class="word-lookup-example-en">📝 "${escapeHTML(exampleEn)}"</div>
          ${exampleCn ? `<div class="word-lookup-example-cn">${escapeHTML(exampleCn)}</div>` : ''}
        </div>` : ''}
      <div class="word-lookup-meta">
        ${bankName ? `<span class="word-lookup-source">📚 ${escapeHTML(bankName)}</span>` : ''}
        <span class="word-lookup-status">${isLearned ? '✅ 已学习' : '📖 未学习'}</span>
      </div>
      <div class="word-lookup-actions">
        <button class="word-lookup-btn word-lookup-btn--fav ${isFav ? 'word-lookup-btn--fav-active' : ''}" id="word-lookup-fav">
          ${isFav ? '⭐ 取消收藏' : '☆ 收藏'}
        </button>
      </div>
    </div>
  `

  container.appendChild(overlay)

  overlay.querySelector('#word-lookup-close').addEventListener('click', () => {
    overlay.remove()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  const favBtn = overlay.querySelector('#word-lookup-fav')
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      toggleFavoriteLookup(entry.word, sourceBank, favBtn)
    })
  }
}

/**
 * 查词结果中切换收藏（兼容未学词）。
 */
function toggleFavoriteLookup(word, sourceBank, favBtn) {
  const wp = getWordProgress()
  if (!wp.words) wp.words = {}
  if (!wp.words[word]) {
    // 未学词收藏：创建最小记录
    wp.words[word] = {
      stability: 0.5,
      difficulty: 0.3,
      state: 'new',
      due: null,
      reps: 0,
      lapses: 0,
      lastReview: null,
      isFavorited: true,
      sourceBank: sourceBank || 'cet4',
    }
  } else {
    wp.words[word] = {
      ...wp.words[word],
      isFavorited: !wp.words[word].isFavorited,
    }
  }
  saveWordProgress(wp)

  // 刷新按钮状态
  const nowFav = !!(wp.words[word] && wp.words[word].isFavorited)
  favBtn.classList.toggle('word-lookup-btn--fav-active', nowFav)
  favBtn.innerHTML = nowFav ? '⭐ 取消收藏' : '☆ 收藏'
}

/**
 * 查词未找到。
 */
function showLookupNotFound(container, query) {
  // 移除已有查词 overlay（如有），防止重复叠加
  const existing = container.querySelector('.word-lookup-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'word-lookup-overlay'
  overlay.innerHTML = `
    <div class="word-lookup-card">
      <button class="word-lookup-close" id="word-lookup-close">✕</button>
      <div class="word-lookup-notfound">未找到该单词：<b style="color:#fff">${escapeHTML(query)}</b></div>
    </div>
  `
  container.appendChild(overlay)

  overlay.querySelector('#word-lookup-close').addEventListener('click', () => {
    overlay.remove()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

/**
 * 搜索匹配多条时显示列表。
 */
function showSearchResults(container, query, results) {
  const existing = container.querySelector('.word-lookup-overlay')
  if (existing) existing.remove()

  const wp = getWordProgress()
  const words = wp.words || {}
  const items = results.map(r => {
    const def = r.translation || r.definition || ''
    const state = words[r.word]
    const isLearned = state && state.state && state.state !== 'new'
    const isFav = state && state.isFavorited
    return { ...r, def, isLearned, isFav }
  })

  const overlay = document.createElement('div')
  overlay.className = 'word-lookup-overlay'
  overlay.innerHTML = `
    <div class="word-lookup-card word-lookup-card--list">
      <button class="word-lookup-close" id="word-lookup-close">✕</button>
      <div style="color:#888;font-size:12px;margin-bottom:12px">搜索 "<b style="color:#fff">${escapeHTML(query)}</b>" — ${items.length} 条结果</div>
      <div class="word-search-results" id="word-search-results">
        ${items.map(e => `
          <div class="word-search-item" data-word="${escapeHTML(e.word)}">
            <span class="word-search-item-word">${escapeHTML(e.word)}${e.isFav ? ' ⭐' : ''}${e.isLearned ? ' ✅' : ''}</span>
            <span class="word-search-item-def">${escapeHTML(e.def).substring(0, 40)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
  container.appendChild(overlay)

  overlay.querySelector('#word-lookup-close').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })

  overlay.querySelectorAll('.word-search-item').forEach(el => {
    el.addEventListener('click', () => {
      const word = el.dataset.word
      const entry = results.find(r => r.word === word)
      if (entry) showLookupResult(container, entry)
    })
  })
}

/**
 * 输入联想下拉菜单。
 */
function showSearchDropdown(container, inputEl, results, onSelect) {
  // 移除旧下拉
  const existing = document.querySelector('.word-search-dropdown')
  if (existing) existing.remove()

  const wp = getWordProgress()
  const words = wp.words || {}
  const rect = inputEl.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  const dropdown = document.createElement('div')
  dropdown.className = 'word-search-dropdown'
  dropdown.style.cssText = `
    position:fixed;left:${rect.left}px;top:${(rect.bottom + 2)}px;
    width:${rect.width}px;max-height:240px;overflow-y:auto;
    background:#2c2c2c;border:1px solid #444;border-radius:8px;
    z-index:1000;box-shadow:0 4px 16px rgba(0,0,0,0.5);
  `
  dropdown.innerHTML = results.map(r => {
    const def = r.translation || r.definition || ''
    const state = words[r.word]
    const isLearned = state && state.state && state.state !== 'new'
    const marker = isLearned ? ' ✅' : ''
    return `<div class="word-search-dropdown-item" style="padding:8px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px" data-word="${escapeHTML(r.word)}">
      <span style="color:#e0e0e0;font-weight:500">${escapeHTML(r.word)}${marker}</span>
      <span style="color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${escapeHTML(def).substring(0, 30)}</span>
    </div>`
  }).join('')

  dropdown.querySelectorAll('.word-search-dropdown-item').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.background = '#3c3c3c' })
    el.addEventListener('mouseleave', () => { el.style.background = '' })
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const word = el.dataset.word
      const entry = results.find(r => r.word === word)
      if (entry) onSelect(entry)
    })
  })

  // 全局监听：点击空白处关闭
  const closeHandler = (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputEl) {
      dropdown.remove()
      document.removeEventListener('click', closeHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', closeHandler), 0)

  document.body.appendChild(dropdown)
  return dropdown
}

// ══════════════════════════════════════════════════════
// 新词学习
// ══════════════════════════════════════════════════════

function renderLearn(container) {
  container.className = 'page page--word'
  let pageActive = true

  const wp = getWordProgress()
  const settings = wp.settings || {}
  const groupSize = settings.learnGroupSize || 10
  const selectedBanks = settings.selectedBanks || ['cet4']

  // 学习会话状态
  let batch = []          // [{ word, entry, sourceBank }]
  let currentIdx = 0
  let isFlipped = false
  let completed = 0
  let sessionFavorites = new Set()  // 本组学习中标记收藏的词（尚未写入 PetState）

  // ── 初始渲染（加载中）──
  container.innerHTML = `
    <div class="word-session">
      <div class="word-session-header">
        <button class="word-session-back" id="word-learn-back">← 返回</button>
        <span class="word-session-progress" id="word-learn-progress">加载中...</span>
      </div>
      <div class="word-card-wrap" id="word-learn-card-area">
        <div style="text-align:center;padding:60px 20px;color:#888">⏳ 正在准备新词...</div>
      </div>
    </div>
  `

  const progressEl = container.querySelector('#word-learn-progress')
  const cardArea = container.querySelector('#word-learn-card-area')
  const backBtn = container.querySelector('#word-learn-back')

  backBtn.addEventListener('click', () => {
    if (!pageActive) return
    navigateTo('home')
  })

  // ── 异步加载新词批次 ──
  loadLearnBatch().then(() => {
    if (!pageActive) return
    if (batch.length === 0) {
      cardArea.innerHTML = `
        <div class="word-empty">
          <div class="word-empty-icon">🎉</div>
          <div class="word-empty-text">所有词库中的单词都已学过，没有新词了 🎉</div>
        </div>`
      progressEl.textContent = '已完成'
      return
    }
    renderCurrentCard()
  }).catch(err => {
    console.error('[word-ui] 加载新词批次失败:', err)
    if (!pageActive) return
    cardArea.innerHTML = `
      <div class="word-empty">
        <div class="word-empty-icon">⚠️</div>
        <div class="word-empty-text">加载失败，请返回重试</div>
      </div>`
    progressEl.textContent = '错误'
  })

  async function loadLearnBatch() {
    const learnedSet = new Set(Object.keys(wp.words || {}))
    const allCandidates = []

    for (const bankId of selectedBanks) {
      const bank = await loadBank(bankId)
      if (!bank) continue
      const newWords = getNextNewWords(bank.words, groupSize * 2, learnedSet)
      for (const w of newWords) {
        allCandidates.push({ word: w, sourceBank: bankId })
      }
    }

    // 随机打乱并取前 groupSize 个
    shuffleArray(allCandidates)
    const selected = allCandidates.slice(0, groupSize)

    // 批量查词
    if (selected.length > 0) {
      const words = selected.map(s => s.word)
      const entries = await window.electronAPI.word.batchLookup(words)
      // 建立 word → entry 映射
      const entryMap = new Map()
      for (const e of entries) {
        entryMap.set(e.word, e)
      }
      for (const s of selected) {
        const entry = entryMap.get(s.word)
        if (entry) {
          batch.push({ word: s.word, entry, sourceBank: s.sourceBank, _retries: 0 })
        }
      }
    }
  }

  function renderCurrentCard() {
    if (currentIdx >= batch.length) {
      showGroupComplete('learn')
      return
    }

    const item = batch[currentIdx]
    const entry = item.entry
    isFlipped = false

    const def = entry.translation || entry.definition || ''
    const example = entry.detail || ''

    progressEl.textContent = `${currentIdx + 1} / ${batch.length}`

    cardArea.innerHTML = `
      <div class="word-card" id="word-card">
        <div class="word-card-inner" id="word-card-inner">
          <div class="word-card-face word-card-front">
            <div class="word-card-word">${escapeHTML(item.word)}</div>
            <div class="word-card-front-hint">点击翻面查看释义</div>
          </div>
          <div class="word-card-face word-card-back">
            <div class="word-card-word">${escapeHTML(item.word)}</div>
            ${entry.phonetic ? `<div class="word-card-phonetic">${escapeHTML(entry.phonetic)}</div>` : ''}
            <div class="word-card-definition">${escapeHTML(def)}</div>
            ${example ? `<div class="word-card-example">${escapeHTML(example)}</div>` : ''}
            <div class="word-card-actions">
              <button class="word-card-fav ${sessionFavorites.has(item.word) ? 'word-card-fav--active' : ''}" id="word-learn-fav" title="收藏">⭐</button>
              <button class="word-card-rate-btn word-card-rate-btn--good" id="word-learn-good">记住了</button>
              <button class="word-card-rate-btn word-card-rate-btn--again" id="word-learn-again">不太熟</button>
            </div>
          </div>
        </div>
      </div>
    `

    // ── 翻卡 ──
    const card = cardArea.querySelector('#word-card')
    const cardInner = cardArea.querySelector('#word-card-inner')
    card.addEventListener('click', (e) => {
      // 如果已经翻面，不处理（按钮有自己的事件）
      if (isFlipped) return
      isFlipped = true
      cardInner.classList.add('word-card-inner--flipped')
    })

    // ── 收藏（新词尚未写入 PetState，先存入 sessionFavorites，rating 时写入）──
    const favBtn = cardArea.querySelector('#word-learn-fav')
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (sessionFavorites.has(item.word)) {
        sessionFavorites.delete(item.word)
      } else {
        sessionFavorites.add(item.word)
      }
      favBtn.classList.toggle('word-card-fav--active', sessionFavorites.has(item.word))
    })

    // ── 自评 ──
    const goodBtn = cardArea.querySelector('#word-learn-good')
    const againBtn = cardArea.querySelector('#word-learn-again')

    goodBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      rateWord('good')
    })
    againBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      rateWord('again')
    })
  }

  function rateWord(rating) {
    const item = batch[currentIdx]
    const wp2 = getWordProgress()
    const words = wp2.words || {}

    const existing = words[item.word]
    const isNewWord = !existing || !existing.state || existing.state === 'new'

    // ── 新词 + "不太熟" + 还有重试次数 → 排到队尾 ──
    if (isNewWord && rating === 'again' && item._retries < 2) {
      item._retries++
      batch.push({ ...item })  // 副本追加到队尾，独立 _retries 计数
      currentIdx++
      showToast(`${item._retries === 1 ? '已移到队尾，稍后再看' : '最后一次机会了'} 🔄`)
      renderCurrentCard()
      return  // 不存 FSRS，不计数，不触发 streak
    }

    // ── 正常存入 FSRS ──
    if (existing && existing.state && existing.state !== 'new') {
      words[item.word] = preserveMeta(existing, scheduleReview(existing, rating))
    } else {
      let initial = initLearnedWord(item.word, item.sourceBank)
      if (sessionFavorites.has(item.word)) {
        initial = { ...initial, isFavorited: true }
        sessionFavorites.delete(item.word)
      }
      if (rating === 'again') {
        words[item.word] = preserveMeta(initial, scheduleReview(initial, 'again'))
      } else {
        words[item.word] = initial
      }
    }
    wp2.words = words
    updateStreak(wp2)
    saveWordProgress(wp2)

    EventBus.emit(EVENTS.WORD_LEARNED, { word: item.word })

    completed++
    currentIdx++
    renderCurrentCard()
  }

  function showGroupComplete(mode) {
    const wp2 = getWordProgress()
    const goal = wp2.settings?.dailyGoal ?? 10
    const today = new Date().toISOString().slice(0, 10)
    const learnedToday = Object.values(wp2.words || {}).filter(s =>
      s.lastReview?.slice(0, 10) === today && s.state !== 'new'
    ).length
    const remaining = goal - learnedToday
    const goalText = remaining > 0
      ? `🎯 目标 ${goal} 个，已学 ${learnedToday} 个，还需 ${remaining} 个`
      : `🎯 目标 ${goal} 个 ✅ 已完成！`
    const overlay = document.createElement('div')
    overlay.className = 'word-overlay'
    overlay.innerHTML = `
      <div class="word-modal">
        <div class="word-modal-title">🎉 本组完成！</div>
        <div class="word-modal-body">
          本组学了 ${completed} 个新词<br>
          ${goalText}
        </div>
        <div class="word-modal-buttons">
          <button class="word-modal-btn word-modal-btn--primary" id="word-modal-learn-more">📖 继续学下一组</button>
          <button class="word-modal-btn word-modal-btn--primary" id="word-modal-go-review">📋 去复习</button>
          <button class="word-modal-btn word-modal-btn--secondary" id="word-modal-done">✅ 今天就到这</button>
        </div>
      </div>
    `
    container.appendChild(overlay)

    overlay.querySelector('#word-modal-learn-more').addEventListener('click', () => {
      overlay.remove()
      navigateTo('learn')
    })
    overlay.querySelector('#word-modal-go-review').addEventListener('click', () => {
      overlay.remove()
      navigateTo('review')
    })
    overlay.querySelector('#word-modal-done').addEventListener('click', () => {
      overlay.remove()
      navigateTo('home')
    })
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })
  }

  return () => {
    pageActive = false
    // 清理可能的 overlay
    const overlay = container.querySelector('.word-overlay')
    if (overlay) overlay.remove()
  }
}

// ══════════════════════════════════════════════════════
// 复习
// ══════════════════════════════════════════════════════

function renderReview(container) {
  container.className = 'page page--word'
  let pageActive = true

  const wp = getWordProgress()
  const settings = wp.settings || {}
  const groupSize = settings.reviewGroupSize || 15
  const dueWords = getDueWords(wp.words || {})
  const actualSize = Math.min(groupSize, dueWords.length)

  // 复习会话状态
  let batch = []          // [{ word, entry, state }]
  let currentIdx = 0
  let stage = 'word'      // 'word' | 'choice' | 'result'
  let choices = []        // [{ word, entry }] 当前题的选项（含正确答案）
  let selectedChoice = null
  let completed = 0

  // ── 初始渲染（加载中）──
  container.innerHTML = `
    <div class="word-session">
      <div class="word-session-header">
        <button class="word-session-back" id="word-review-back">← 返回</button>
        <span class="word-session-progress" id="word-review-progress">加载中...</span>
      </div>
      <div class="word-review-stage" id="word-review-area">
        <div style="text-align:center;padding:60px 20px;color:#888">⏳ 正在准备复习...</div>
      </div>
    </div>
  `

  const progressEl = container.querySelector('#word-review-progress')
  const reviewArea = container.querySelector('#word-review-area')
  const backBtn = container.querySelector('#word-review-back')

  backBtn.addEventListener('click', () => {
    if (!pageActive) return
    navigateTo('home')
  })

  // ── 异步加载复习批次 ──
  loadReviewBatch().then(() => {
    if (!pageActive) return
    if (batch.length === 0) {
      reviewArea.innerHTML = `
        <div class="word-empty">
          <div class="word-empty-icon">🎉</div>
          <div class="word-empty-text">没有需要复习的单词<br>干得漂亮！</div>
        </div>`
      progressEl.textContent = '已完成'
      return
    }
    renderCurrentWord()
  }).catch(err => {
    console.error('[word-ui] 加载复习批次失败:', err)
    if (!pageActive) return
    reviewArea.innerHTML = `
      <div class="word-empty">
        <div class="word-empty-icon">⚠️</div>
        <div class="word-empty-text">加载失败，请返回重试</div>
      </div>`
    progressEl.textContent = '错误'
  })

  async function loadReviewBatch() {
    const selected = dueWords.slice(0, actualSize)
    if (selected.length === 0) return

    const words = selected.map(s => s.word)
    const entries = await window.electronAPI.word.batchLookup(words)
    const entryMap = new Map()
    for (const e of entries) {
      entryMap.set(e.word, e)
    }

    for (const s of selected) {
      const entry = entryMap.get(s.word)
      if (entry) {
        batch.push({ word: s.word, entry, state: s.state, _wrongCount: 0 })
      }
    }
  }

  function renderCurrentWord() {
    if (currentIdx >= batch.length) {
      showReviewGroupComplete()
      return
    }

    stage = 'choice'
    selectedChoice = null
    choices = []
    const item = batch[currentIdx]

    progressEl.textContent = `${currentIdx + 1} / ${batch.length}`

    reviewArea.innerHTML = `
      <div class="word-review-word" id="word-review-word">${escapeHTML(item.word)}</div>
      <div class="word-choices" id="word-choices"><div style="text-align:center;color:#888;padding:20px">⏳ 加载选项...</div></div>
      <button class="word-forgot-btn" id="word-forgot-btn" style="display:none">😕 忘了，看答案</button>
    `

    const choicesEl = reviewArea.querySelector('#word-choices')
    const forgotBtn = reviewArea.querySelector('#word-forgot-btn')

    // 异步加载干扰项
    window.electronAPI.word.choices(item.word, 3).then(distractors => {
      if (!pageActive) return
      const allOptions = [
        { word: item.word, entry: item.entry, isCorrect: true },
        ...distractors.map(d => ({ word: d.word, entry: d, isCorrect: false })),
      ]
      shuffleArray(allOptions)
      choices = allOptions

      choicesEl.innerHTML = allOptions.map((opt, i) => {
        const def = opt.entry.translation || opt.entry.definition || ''
        return `<button class="word-choice-btn" data-choice-idx="${i}">${escapeHTML(def)}</button>`
      }).join('')
      forgotBtn.style.display = ''

      // 选项点击
      choicesEl.querySelectorAll('.word-choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (stage !== 'choice') return
          const idx = parseInt(btn.dataset.choiceIdx, 10)
          handleChoice(idx)
        })
      })

      // 忘了按钮
      forgotBtn.addEventListener('click', () => {
        if (stage !== 'choice') return
        handleForgot()
      })
    }).catch(() => {
      if (!pageActive) return
      choicesEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px">加载失败，请返回重试</div>'
    })
  }

  function handleChoice(idx) {
    stage = 'result'
    selectedChoice = idx
    const opt = choices[idx]
    const item = batch[currentIdx]

    // 高亮正确/错误选项
    const buttons = reviewArea.querySelectorAll('.word-choice-btn')
    buttons.forEach((btn, i) => {
      btn.classList.add('word-choice-btn--disabled')
      if (choices[i].isCorrect) {
        btn.classList.add('word-choice-btn--correct')
      } else if (i === idx && !opt.isCorrect) {
        btn.classList.add('word-choice-btn--wrong')
      }
    })

    const forgotBtn = reviewArea.querySelector('#word-forgot-btn')
    if (forgotBtn) forgotBtn.style.display = 'none'

    const wordEl = reviewArea.querySelector('#word-review-word')
    if (wordEl) wordEl.style.display = 'none'

    if (opt.isCorrect) {
      // ── 正确 → 保存 FSRS，展示卡片 ──
      const wp2 = getWordProgress()
      const words = wp2.words || {}
      let state = item.state
      for (let i = 0; i < (item._wrongCount || 0); i++) {
        state = scheduleReview(state, 'again')
      }
      state = scheduleReview(state, 'good')
      words[item.word] = preserveMeta(item.state, state)
      wp2.words = words
      updateStreak(wp2)
      saveWordProgress(wp2)
      EventBus.emit(EVENTS.WORD_REVIEWED, { word: item.word, rating: 'good' })

      completed++
      currentIdx++
      showReviewResultCard('correct')
    } else {
      // ── 答错 → 展示完整卡片，排到队尾 ──
      item._wrongCount = (item._wrongCount || 0) + 1
      batch.push({ ...item })
      currentIdx++
      showReviewResultCard('wrong')
    }
  }

  function handleForgot() {
    stage = 'result'
    const item = batch[currentIdx]

    // 高亮正确答案
    const buttons = reviewArea.querySelectorAll('.word-choice-btn')
    buttons.forEach((btn, i) => {
      btn.classList.add('word-choice-btn--disabled')
      if (choices[i].isCorrect) {
        btn.classList.add('word-choice-btn--correct')
      }
    })

    const forgotBtn = reviewArea.querySelector('#word-forgot-btn')
    if (forgotBtn) forgotBtn.style.display = 'none'

    const wordEl = reviewArea.querySelector('#word-review-word')
    if (wordEl) wordEl.style.display = 'none'

    // 排到队尾
    item._wrongCount = (item._wrongCount || 0) + 1
    batch.push({ ...item })
    currentIdx++
    showReviewResultCard('forgot')
  }

  function showReviewResultCard(reason) {
    const item = batch[currentIdx - 1]  // 已 advance 过，取上一个
    const entry = item.entry
    const example = entry.detail || ''

    const correctChoice = choices.find(c => c.isCorrect)
    const defText = correctChoice
      ? (correctChoice.entry.translation || correctChoice.entry.definition || '')
      : (entry.translation || entry.definition || '')

    reviewArea.innerHTML = `
      <div class="word-review-result">
        <div class="word-review-result-icon">${reason === 'correct' ? '✅' : reason === 'forgot' ? '😕' : '❌'}</div>
        <div class="word-review-result-word">${escapeHTML(item.word)}</div>
        ${entry.phonetic ? `<div style="font-size:14px;color:#888">${escapeHTML(entry.phonetic)}</div>` : ''}
        <div class="word-review-result-info">
          <div style="color:#e0e0e0;font-size:16px;margin-bottom:4px">${escapeHTML(defText)}</div>
          ${example ? `<div style="color:#999;font-size:13px;font-style:italic">${escapeHTML(example)}</div>` : ''}
        </div>
        <button class="word-card-fav ${isWordFavorited(item.word) ? 'word-card-fav--active' : ''}" id="word-review-fav" title="收藏">⭐</button>
        <button class="word-review-result-confirm" id="word-review-confirm">继续下一张 →</button>
      </div>
    `

    const favBtn = reviewArea.querySelector('#word-review-fav')
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        toggleFavorite(item.word)
        favBtn.classList.toggle('word-card-fav--active', isWordFavorited(item.word))
      })
    }

    reviewArea.querySelector('#word-review-confirm').addEventListener('click', () => {
      renderCurrentWord()
    })
  }


  function showReviewGroupComplete() {
    const wp2 = getWordProgress()
    const dueLeft = getDueWords(wp2.words || {}).length

    const overlay = document.createElement('div')
    overlay.className = 'word-overlay'
    overlay.innerHTML = `
      <div class="word-modal">
        <div class="word-modal-title">🎉 复习完成！</div>
        <div class="word-modal-body">
          本组完成 ${completed} 个单词<br>
          ${dueLeft > 0 ? `还有 ${dueLeft} 个到期未复习` : '全部复习完毕！'}
        </div>
        <div class="word-modal-buttons">
          ${dueLeft > 0 ? '<button class="word-modal-btn word-modal-btn--primary" id="word-modal-review-more">📋 继续复习</button>' : ''}
          <button class="word-modal-btn word-modal-btn--primary" id="word-modal-go-learn">📖 去学新词</button>
          <button class="word-modal-btn word-modal-btn--secondary" id="word-modal-done">✅ 今天就到这</button>
        </div>
      </div>
    `
    container.appendChild(overlay)

    const moreBtn = overlay.querySelector('#word-modal-review-more')
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        overlay.remove()
        navigateTo('review')
      })
    }
    overlay.querySelector('#word-modal-go-learn').addEventListener('click', () => {
      overlay.remove()
      navigateTo('learn')
    })
    overlay.querySelector('#word-modal-done').addEventListener('click', () => {
      overlay.remove()
      navigateTo('home')
    })
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })
  }

  return () => {
    pageActive = false
    const overlay = container.querySelector('.word-overlay')
    if (overlay) overlay.remove()
  }
}

// ══════════════════════════════════════════════════════
// 收藏
// ══════════════════════════════════════════════════════

function isWordFavorited(word) {
  const wp = getWordProgress()
  return !!(wp.words && wp.words[word] && wp.words[word].isFavorited)
}

function toggleFavorite(word) {
  const wp = getWordProgress()
  if (!wp.words || !wp.words[word]) return
  wp.words[word] = { ...wp.words[word], isFavorited: !wp.words[word].isFavorited }
  saveWordProgress(wp)
}

// ══════════════════════════════════════════════════════
// Toast
// ══════════════════════════════════════════════════════

function showToast(msg) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2000)
}

// ══════════════════════════════════════════════════════
// 辅助
// ══════════════════════════════════════════════════════

/**
 * scheduleReview 返回的新对象不包含 isFavorited / sourceBank 等元数据。
 * 此函数将旧状态中的用户元数据复制到 scheduleReview 返回的新状态上。
 */
function preserveMeta(oldState, newState) {
  const meta = {}
  if (oldState && oldState.isFavorited !== undefined) {
    meta.isFavorited = oldState.isFavorited
  }
  if (oldState && oldState.sourceBank !== undefined) {
    meta.sourceBank = oldState.sourceBank
  }
  return { ...newState, ...meta }
}

function escapeHTML(str) {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

// ══════════════════════════════════════════════════════
// 对外 API
// ══════════════════════════════════════════════════════

/**
 * 挂载单词模块到指定容器。返回清理函数。
 * @param {HTMLElement} container
 * @returns {Function} cleanup — 切页时调用
 */
export function mountWordPage(container) {
  _container = container

  // 注入样式（仅一次）
  if (!_styleEl) {
    _styleEl = document.createElement('style')
    _styleEl.textContent = CSS_TEXT
    document.head.appendChild(_styleEl)
  }

  // 渲染首页
  navigateTo('home')

  // 返回清理函数
  return () => {
    if (_cleanupCurrent) {
      _cleanupCurrent()
      _cleanupCurrent = null
    }
    _currentPage = 'home'
    _container = null
  }
}
