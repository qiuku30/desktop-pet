// 英语单词本 UI
//
// 职责：
// - mountWordBook(container, opt) → 返回 unmount 清理函数
// - 主页：全局搜索 + 我的单词本/收藏入口 + 词库列表
// - 单词列表：首字母分组 + 右侧字母索引 + 筛选 Tab + 词库内搜索
// - 单词详情：完整卡片 + 收藏切换 + 重新学习（二次确认）
//
// 依赖：PetState / IPC (word:lookup / word:batch-lookup)

import { PetState } from '../../shared/pet-state.js'

// ══════════════════════════════════════════════════════
// CSS（自包含，mount 时注入 <style>）
// ══════════════════════════════════════════════════════

const CSS_TEXT = `
/* ── 单词本主页 ── */
.wb-main{display:flex;flex-direction:column;gap:16px;padding:16px}
.wb-main-header{display:flex;align-items:center;gap:12px;user-select:none}
.wb-main-back{background:none;border:1px solid #444;border-radius:6px;color:#999;font-size:13px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.wb-main-back:hover{border-color:#888;color:#ccc}
.wb-main-title{font-size:18px;font-weight:bold;color:#fff}

.wb-search-wrap{position:relative}
.wb-search-input{width:100%;padding:10px 14px;border:1px solid #444;border-radius:8px;background:#2c2c2c;color:#ccc;font-size:14px;font-family:inherit;box-sizing:border-box;transition:border-color .15s}
.wb-search-input:focus{outline:none;border-color:#2196f3}
.wb-search-input::placeholder{color:#666}
.wb-search-results{position:absolute;top:100%;left:0;right:0;max-height:340px;overflow-y:auto;background:#2c2c2c;border:1px solid #444;border-top:none;border-radius:0 0 8px 8px;z-index:5;display:none}
.wb-search-results--visible{display:block}
.wb-search-result-item{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .1s;border-bottom:1px solid #333}
.wb-search-result-item:last-child{border-bottom:none}
.wb-search-result-item:hover{background:#3a3a3a}
.wb-search-result-word{font-size:15px;font-weight:bold;color:#fff;min-width:120px}
.wb-search-result-def{font-size:13px;color:#999;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-search-result-bank{font-size:11px;color:#666;white-space:nowrap}
.wb-search-result-badges{display:flex;gap:4px;font-size:13px;white-space:nowrap}
.wb-search-count{font-size:12px;color:#666;padding:8px 14px;border-top:1px solid #333;display:none}
.wb-search-count--visible{display:block}
.wb-search-empty{padding:16px;text-align:center;color:#888;font-size:13px}

.wb-section{margin-top:4px}
.wb-section-header{display:flex;align-items:center;gap:6px;margin-bottom:8px;user-select:none}
.wb-section-icon{font-size:14px}
.wb-section-title{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px}
.wb-section-item{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#2c2c2c;border:1px solid #333;border-radius:8px;cursor:pointer;transition:border-color .15s,background .15s;user-select:none;margin-bottom:6px}
.wb-section-item:hover{border-color:#2196f3;background:#333}
.wb-section-item-icon{font-size:18px}
.wb-section-item-label{flex:1;font-size:14px;color:#ccc}
.wb-section-item-count{font-size:13px;color:#888}
.wb-section-item-arrow{font-size:14px;color:#555}

/* ── 单词列表页 ── */
.wb-list{display:flex;flex-direction:column;height:100%}
.wb-list-header{display:flex;align-items:center;gap:12px;padding:12px 16px;user-select:none;flex-shrink:0}
.wb-list-back{background:none;border:1px solid #444;border-radius:6px;color:#999;font-size:13px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.wb-list-back:hover{border-color:#888;color:#ccc}
.wb-list-title{font-size:17px;font-weight:bold;color:#fff}
.wb-list-search-wrap{padding:0 16px 8px;flex-shrink:0}

.wb-list-tabs{display:flex;gap:4px;padding:0 16px 8px;flex-shrink:0;flex-wrap:wrap}
.wb-list-tab{padding:6px 14px;border:1px solid #444;border-radius:16px;background:transparent;color:#999;font-size:12px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s;user-select:none;white-space:nowrap}
.wb-list-tab:hover{border-color:#888;color:#ccc}
.wb-list-tab--active{border-color:#2196f3;color:#2196f3;background:rgba(33,150,243,.1)}

.wb-list-body{display:flex;flex:1;overflow:hidden;position:relative}
.wb-list-content{flex:1;overflow-y:auto;padding:0 16px 16px}
.wb-list-content::-webkit-scrollbar{width:4px}
.wb-list-content::-webkit-scrollbar-thumb{background:#555;border-radius:2px}

.wb-alpha-index{display:flex;flex-direction:column;gap:1px;padding:4px 6px;user-select:none;flex-shrink:0;overflow-y:auto;justify-content:center}
.wb-alpha-char{padding:1px 4px;font-size:10px;color:#888;cursor:pointer;text-align:center;border-radius:3px;transition:color .1s,background .1s;line-height:1.5}
.wb-alpha-char:hover{color:#fff;background:#3a3a3a}
.wb-alpha-char--active{color:#2196f3;font-weight:bold}

.wb-list-group{margin-bottom:2px}
.wb-list-group-title{padding:10px 0 4px;font-size:14px;font-weight:bold;color:#2196f3;user-select:none;position:sticky;top:0;background:#1e1e1e;z-index:1}
.wb-list-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;cursor:pointer;transition:background .1s;border-bottom:1px solid rgba(255,255,255,.04)}
.wb-list-item:hover{background:#2c2c2c}
.wb-list-item-word{font-size:14px;font-weight:bold;color:#e0e0e0;min-width:100px}
.wb-list-item-def{font-size:13px;color:#999;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-list-item-def--loading{color:#555;font-style:italic}
.wb-list-item-badges{display:flex;gap:3px;font-size:13px;flex-shrink:0}
.wb-list-empty{padding:40px 20px;text-align:center;color:#888;font-size:14px}
.wb-list-loading{text-align:center;padding:20px;color:#888;font-size:13px}

/* ── 单词详情 ── */
.wb-detail{display:flex;flex-direction:column;height:100%}
.wb-detail-header{padding:12px 16px;flex-shrink:0;user-select:none}
.wb-detail-back{background:none;border:1px solid #444;border-radius:6px;color:#999;font-size:13px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.wb-detail-back:hover{border-color:#888;color:#ccc}
.wb-detail-card-wrap{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:10px 16px 20px;overflow-y:auto}
.wb-detail-card{width:100%;max-width:420px;background:#2c2c2c;border:1px solid #333;border-radius:12px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:14px}
.wb-detail-word{font-size:30px;font-weight:bold;color:#fff;letter-spacing:1px}
.wb-detail-phonetic{font-size:15px;color:#888}
.wb-detail-defs{width:100%;text-align:center}
.wb-detail-def-item{font-size:16px;color:#e0e0e0;line-height:1.6}
.wb-detail-def-pos{font-size:12px;color:#666;margin-right:4px}
.wb-detail-example{width:100%;text-align:center;margin-top:4px;padding:12px;background:rgba(255,255,255,.03);border-radius:8px}
.wb-detail-example-en{font-size:13px;color:#bbb;font-style:italic;line-height:1.5}
.wb-detail-example-cn{font-size:12px;color:#777;margin-top:4px}
.wb-detail-meta{width:100%;display:flex;justify-content:center;gap:16px;padding-top:4px;border-top:1px solid #333;margin-top:6px}
.wb-detail-source{font-size:12px;color:#666}
.wb-detail-status{font-size:12px;color:#4caf50}
.wb-detail-actions{display:flex;gap:10px;margin-top:8px}
.wb-detail-btn{padding:10px 20px;border:1px solid #444;border-radius:8px;background:transparent;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s;user-select:none;display:flex;align-items:center;gap:6px}
.wb-detail-btn:hover{border-color:#888;color:#fff}
.wb-detail-btn--fav{border-color:#ffc107;color:#ffc107}
.wb-detail-btn--fav:hover{background:rgba(255,193,7,.15)}
.wb-detail-btn--fav-active{background:rgba(255,193,7,.2);border-color:#ffc107;color:#ffc107}
.wb-detail-btn--danger{border-color:#e81123;color:#e81123}
.wb-detail-btn--danger:hover{background:rgba(232,17,35,.15)}

/* ── 确认弹窗 ── */
.wb-overlay{position:absolute;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:10}
.wb-modal{background:#2c2c2c;border:1px solid #444;border-radius:12px;padding:24px;min-width:260px;max-width:320px;display:flex;flex-direction:column;gap:16px;user-select:none;animation:wb-modal-in .2s ease-out}
@keyframes wb-modal-in{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.wb-modal-title{font-size:17px;font-weight:bold;color:#fff;text-align:center}
.wb-modal-body{font-size:13px;color:#999;text-align:center;line-height:1.5}
.wb-modal-buttons{display:flex;gap:8px}
.wb-modal-btn{flex:1;padding:10px 16px;border:1px solid #444;border-radius:8px;background:transparent;color:#ccc;font-size:14px;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s;text-align:center}
.wb-modal-btn:hover{border-color:#888;color:#fff}
.wb-modal-btn--danger{border-color:#e81123;color:#e81123}
.wb-modal-btn--danger:hover{background:rgba(232,17,35,.15)}
.wb-modal-btn--secondary{color:#888}
.wb-modal-btn--secondary:hover{color:#ccc}

/* ── 通用 ── */
.wb-loading{display:flex;align-items:center;justify-content:center;padding:40px 20px;color:#888;font-size:14px;gap:8px}
.wb-spinner{display:inline-block;width:16px;height:16px;border:2px solid #555;border-top-color:#2196f3;border-radius:50%;animation:wb-spin .8s linear infinite}
@keyframes wb-spin{to{transform:rotate(360deg)}}
`

// ══════════════════════════════════════════════════════
// 词库加载（动态 import JSON，懒加载 + 缓存）
// ══════════════════════════════════════════════════════

const BANK_LOADERS = {
  cet4:     () => import('../../assets/word-banks/cet4.json',     { with: { type: 'json' } }),
  cet6:     () => import('../../assets/word-banks/cet6.json',     { with: { type: 'json' } }),
  postgrad: () => import('../../assets/word-banks/postgrad.json', { with: { type: 'json' } }),
  ielts:    () => import('../../assets/word-banks/ielts.json',    { with: { type: 'json' } }),
  toefl:    () => import('../../assets/word-banks/toefl.json',    { with: { type: 'json' } }),
}

/** @type {Map<string, {id:string,name:string,icon:string,count:number,words:string[]}>} */
const _bankCache = new Map()

async function loadBank(bankId) {
  if (_bankCache.has(bankId)) return _bankCache.get(bankId)
  const loader = BANK_LOADERS[bankId]
  if (!loader) return null
  try {
    const mod = await loader()
    _bankCache.set(bankId, mod.default)
    return mod.default
  } catch (err) {
    console.error(`[word-book-ui] 加载词库 ${bankId} 失败:`, err)
    return null
  }
}

// ══════════════════════════════════════════════════════
// 释义缓存 + IPC 批量查词
// ══════════════════════════════════════════════════════

/** @type {Map<string, Object>} */
const _defCache = new Map()

/**
 * 批量查词并写入缓存（只查未缓存的词）。
 * @param {string[]} words
 * @param {number} [chunkSize=150]
 */
async function fetchDefs(words, chunkSize = 150) {
  const uncached = words.filter(w => w && !_defCache.has(w))
  if (uncached.length === 0) return

  for (let i = 0; i < uncached.length; i += chunkSize) {
    const chunk = uncached.slice(i, i + chunkSize)
    try {
      const entries = await window.electronAPI.word.batchLookup(chunk)
      for (const e of entries) {
        if (e && e.word) {
          _defCache.set(e.word, e)
        }
      }
    } catch (err) {
      console.error('[word-book-ui] 批量查词失败:', err)
    }
  }
}

function getDef(word) {
  return _defCache.get(word) || null
}

// ══════════════════════════════════════════════════════
// 辅助函数
// ══════════════════════════════════════════════════════

function getWordProgress() {
  return PetState.get('wordProgress') || {
    settings: { dailyNewWordsLimit: 10, learnGroupSize: 10, reviewGroupSize: 15, selectedBanks: ['cet4'] },
    streak: { current: 0, lastStudyDate: null },
    words: {},
  }
}

function saveWordProgress(wp) {
  PetState.set('wordProgress', wp)
}

function isWordLearned(word) {
  const wp = getWordProgress()
  const s = wp.words && wp.words[word]
  return !!(s && s.state && s.state !== 'new')
}

function isWordFavorited(word) {
  const wp = getWordProgress()
  return !!(wp.words && wp.words[word] && wp.words[word].isFavorited)
}

function getWordSourceBank(word) {
  const wp = getWordProgress()
  return (wp.words && wp.words[word] && wp.words[word].sourceBank) || null
}

function escapeHTML(str) {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/** 词库 id → 显示信息 */
const BANK_META = {
  cet4:     { name: 'CET-4 四级',   emoji: '📗' },
  cet6:     { name: 'CET-6 六级',   emoji: '📘' },
  postgrad: { name: '考研',         emoji: '📙' },
  ielts:    { name: '雅思',         emoji: '📕' },
  toefl:    { name: 'TOEFL',        emoji: '📓' },
}

const ALL_BANK_IDS = ['cet4', 'cet6', 'postgrad', 'ielts', 'toefl']

// ══════════════════════════════════════════════════════
// 主页
// ══════════════════════════════════════════════════════

function renderMain(container, state, navigate, goBack, onBack) {
  container.className = 'page page--word'
  let pageActive = true
  const wp = getWordProgress()
  const enabledBanks = wp.settings?.selectedBanks || ['cet4']

  // 统计已学词数
  const learnedSet = new Set()
  const wordsMap = wp.words || {}
  for (const [w, s] of Object.entries(wordsMap)) {
    if (s.state && s.state !== 'new') learnedSet.add(w)
  }
  const favoritedCount = Object.values(wordsMap).filter(s => s.isFavorited).length

  // ── 渲染骨架 ──
  container.innerHTML = `
    <div class="wb-main">
      <div class="wb-main-header">
        <button class="wb-main-back" id="wb-back-btn">← 返回</button>
        <span class="wb-main-title">📖 单词本</span>
      </div>

      <div class="wb-search-wrap" id="wb-search-wrap">
        <input class="wb-search-input" id="wb-search-input"
               type="text" placeholder="🔍 搜索已学单词...">
        <div class="wb-search-results" id="wb-search-results"></div>
        <div class="wb-search-count" id="wb-search-count"></div>
      </div>

      <div class="wb-section">
        <div class="wb-section-header">
          <span class="wb-section-icon">📂</span>
          <span class="wb-section-title">我的</span>
        </div>
        <div class="wb-section-item" id="wb-my-words">
          <span class="wb-section-item-icon">📝</span>
          <span class="wb-section-item-label">我的单词本</span>
          <span class="wb-section-item-count">${learnedSet.size} →</span>
        </div>
        <div class="wb-section-item" id="wb-my-favorites">
          <span class="wb-section-item-icon">⭐</span>
          <span class="wb-section-item-label">我的收藏</span>
          <span class="wb-section-item-count">${favoritedCount} →</span>
        </div>
      </div>

      <div class="wb-section">
        <div class="wb-section-header">
          <span class="wb-section-icon">📚</span>
          <span class="wb-section-title">词库</span>
        </div>
        <div id="wb-banks-list">
          ${ALL_BANK_IDS.map(id => {
            const meta = BANK_META[id]
            const enabled = enabledBanks.includes(id)
            const learnedInBank = Object.entries(wordsMap).filter(([, s]) =>
              s.sourceBank === id && s.state && s.state !== 'new'
            ).length
            return `
              <div class="wb-section-item wb-bank-item ${enabled ? '' : 'wb-section-item--disabled'}"
                   data-bank-id="${id}" style="${enabled ? '' : 'opacity:.35;pointer-events:none'}">
                <span class="wb-section-item-icon">${meta.emoji}</span>
                <span class="wb-section-item-label">${meta.name}</span>
                <span class="wb-section-item-count">${enabled ? `${learnedInBank} / <span class="wb-bank-total" data-bank-id="${id}">...</span> →` : '未启用'}</span>
              </div>`
          }).join('')}
        </div>
      </div>
    </div>
  `

  // ── 事件绑定 ──
  container.querySelector('#wb-back-btn').addEventListener('click', () => {
    if (!pageActive) return
    onBack()
  })

  // 我的单词本
  container.querySelector('#wb-my-words').addEventListener('click', () => {
    if (!pageActive) return
    navigate('list', { listType: 'my-words', filter: 'all', searchQuery: '', bankId: null })
  })

  // 我的收藏
  container.querySelector('#wb-my-favorites').addEventListener('click', () => {
    if (!pageActive) return
    navigate('list', { listType: 'my-favorites', filter: 'all', searchQuery: '', bankId: null })
  })

  // 词库点击
  container.querySelectorAll('.wb-bank-item').forEach(el => {
    el.addEventListener('click', () => {
      if (!pageActive) return
      const bankId = el.dataset.bankId
      navigate('list', { listType: 'bank', bankId, filter: 'all', searchQuery: '' })
    })
  })

  // ── 异步加载词库总数 ──
  for (const bankId of ALL_BANK_IDS) {
    loadBank(bankId).then(bank => {
      if (!pageActive || !bank) return
      const el = container.querySelector(`.wb-bank-total[data-bank-id="${bankId}"]`)
      if (el) el.textContent = bank.count
    })
  }

  // ── 全局搜索 ──
  const searchCleanup = setupMainSearch(container, enabledBanks, navigate)

  return () => {
    pageActive = false
    searchCleanup()
  }
}

// ══════════════════════════════════════════════════════
// 全局搜索（主页）
// ══════════════════════════════════════════════════════

function setupMainSearch(container, enabledBanks, navigate) {
  const input = container.querySelector('#wb-search-input')
  const resultsEl = container.querySelector('#wb-search-results')
  const countEl = container.querySelector('#wb-search-count')
  let searchTimer = null
  let searchActive = false
  let alive = true

  // 关闭搜索结果（点击外部）
  const clickOutsideHandler = (e) => {
    if (!searchActive) return
    const wrap = container.querySelector('#wb-search-wrap')
    if (wrap && !wrap.contains(e.target)) {
      hideResults()
    }
  }
  container.addEventListener('click', clickOutsideHandler)

  function hideResults() {
    searchActive = false
    resultsEl.classList.remove('wb-search-results--visible')
    countEl.classList.remove('wb-search-count--visible')
  }

  input.addEventListener('input', () => {
    clearTimeout(searchTimer)
    const query = input.value.trim()
    if (!query) {
      hideResults()
      return
    }

    searchTimer = setTimeout(async () => {
      if (!alive) return
      const q = input.value.trim()
      if (!q || q !== query) return // 已变更

      resultsEl.innerHTML = '<div class="wb-search-empty"><span class="wb-spinner"></span> 搜索中...</div>'
      resultsEl.classList.add('wb-search-results--visible')
      searchActive = true

      const lowerQ = q.toLowerCase()
      const matches = []

      // 在所有已启用词库中搜索
      for (const bankId of ALL_BANK_IDS) {
        if (!enabledBanks.includes(bankId) && enabledBanks.length > 0) continue
        const bank = await loadBank(bankId)
        if (!bank) continue
        for (const w of bank.words) {
          if (w.toLowerCase().includes(lowerQ)) {
            matches.push({ word: w, sourceBank: bankId })
          }
        }
      }

      // 也搜索已学词（可能已从词库中移除或来自其他来源）
      const wp = getWordProgress()
      const wordsMap = wp.words || {}
      for (const w of Object.keys(wordsMap)) {
        if (w.toLowerCase().includes(lowerQ) && !matches.some(m => m.word === w)) {
          const sourceBank = wordsMap[w].sourceBank
          if (sourceBank && !enabledBanks.includes(sourceBank)) continue
          matches.push({ word: w, sourceBank: sourceBank || 'unknown' })
        }
      }

      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="wb-search-empty">未找到匹配的单词</div>'
        countEl.classList.remove('wb-search-count--visible')
        return
      }

      // 取前 50 条
      const top = matches.slice(0, 50)

      // 批量查词释义
      await fetchDefs(top.map(m => m.word))

      // 渲染结果
      const learnedMap = new Map()
      for (const [w, s] of Object.entries(wordsMap)) {
        if (s.state && s.state !== 'new') learnedMap.set(w, true)
      }
      const favMap = new Map()
      for (const [w, s] of Object.entries(wordsMap)) {
        if (s.isFavorited) favMap.set(w, true)
      }

      resultsEl.innerHTML = top.map(m => {
        const def = getDef(m.word)
        const defText = def ? (def.translation || def.definition || '') : ''
        const meta = BANK_META[m.sourceBank] || { name: m.sourceBank, emoji: '📖' }
        const learned = learnedMap.has(m.word)
        const fav = favMap.has(m.word)
        return `
          <div class="wb-search-result-item" data-word="${escapeHTML(m.word)}" data-bank="${escapeHTML(m.sourceBank)}">
            <span class="wb-search-result-word">${escapeHTML(m.word)}</span>
            <span class="wb-search-result-def">${escapeHTML(defText)}</span>
            <span class="wb-search-result-bank">${meta.emoji} ${meta.name}</span>
            <span class="wb-search-result-badges">${learned ? '✅' : ''}${fav ? '⭐' : ''}</span>
          </div>`
      }).join('')

      countEl.textContent = `共 ${matches.length} 条${matches.length > 50 ? '（显示前 50 条）' : ''}`
      countEl.classList.add('wb-search-count--visible')

      // 点击结果 → 详情
      resultsEl.querySelectorAll('.wb-search-result-item').forEach(el => {
        el.addEventListener('click', () => {
          const word = el.dataset.word
          const bank = el.dataset.bank
          hideResults()
          input.value = ''
          navigate('detail', {
            detailWord: word,
            detailEntry: getDef(word),
            detailSourceBank: bank,
          })
        })
      })
    }, 200)
  })

  // 返回清理函数
  return () => {
    alive = false
    clearTimeout(searchTimer)
    container.removeEventListener('click', clickOutsideHandler)
  }
}

// ══════════════════════════════════════════════════════
// 单词列表页
// ══════════════════════════════════════════════════════

function renderList(container, state, navigate, goBack, onBack) {
  container.className = 'page page--word'
  let pageActive = true
  const { listType, bankId, filter, searchQuery } = state

  const wp = getWordProgress()
  const wordsMap = wp.words || {}

  // ── 确定标题 ──
  let title = '单词列表'
  if (listType === 'my-words') title = '📝 我的单词本'
  else if (listType === 'my-favorites') title = '⭐ 我的收藏'
  else if (listType === 'bank' && bankId) {
    const meta = BANK_META[bankId]
    title = `${meta ? meta.emoji : ''} ${meta ? meta.name : bankId}`
  }

  // ── 确定 Tab 配置 ──
  let tabs = []
  if (listType === 'my-words') {
    tabs = [
      { id: 'all', label: '全部' },
      { id: 'favorites', label: '⭐ 收藏' },
    ]
    // 最近学习：按 lastReview 排序的前 100 个
    if (Object.keys(wordsMap).length > 0) {
      tabs.push({ id: 'recent', label: '🕐 最近学习' })
    }
  } else if (listType === 'my-favorites') {
    tabs = [{ id: 'all', label: '全部' }]
  } else if (listType === 'bank') {
    const bankLearned = Object.entries(wordsMap).filter(([, s]) =>
      s.sourceBank === bankId && s.state && s.state !== 'new'
    ).length
    tabs = [
      { id: 'all', label: '全部' },
      { id: 'learned', label: `✅ 已学 ${bankLearned}` },
      { id: 'unlearned', label: '未学' },
    ]
  }

  let currentFilter = state.filter || 'all'
  let currentSearchQuery = state.searchQuery || ''

  // ── 渲染骨架 ──
  container.innerHTML = `
    <div class="wb-list">
      <div class="wb-list-header">
        <button class="wb-list-back" id="wb-list-back-btn">← 返回</button>
        <span class="wb-list-title">${escapeHTML(title)}</span>
      </div>
      <div class="wb-list-search-wrap">
        <input class="wb-search-input" id="wb-list-search"
               type="text" placeholder="🔍 搜索..."
               value="${escapeHTML(currentSearchQuery)}">
      </div>
      <div class="wb-list-tabs" id="wb-list-tabs">
        ${tabs.map(t => `
          <button class="wb-list-tab ${t.id === currentFilter ? 'wb-list-tab--active' : ''}"
                  data-tab-id="${t.id}">${t.label}</button>
        `).join('')}
      </div>
      <div class="wb-list-body">
        <div class="wb-list-content" id="wb-list-content">
          <div class="wb-list-loading"><span class="wb-spinner"></span> 加载中...</div>
        </div>
        <div class="wb-alpha-index" id="wb-alpha-index"></div>
      </div>
    </div>
  `

  const contentEl = container.querySelector('#wb-list-content')
  const alphaEl = container.querySelector('#wb-alpha-index')

  // 跟踪异步版本号，防止过期 buildAndRenderList 回调污染 UI
  let buildId = 0
  // 跟踪已注册的 scroll handler，防止重复累积
  let currentScrollHandler = null

  // ── 返回按钮 ──
  container.querySelector('#wb-list-back-btn').addEventListener('click', () => {
    if (!pageActive) return
    goBack()
  })

  // ── 搜索 ──
  const searchInput = container.querySelector('#wb-list-search')
  let searchTimer = null
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      currentSearchQuery = searchInput.value.trim()
      buildAndRenderList()
    }, 200)
  })

  // ── Tab 切换 ──
  container.querySelector('#wb-list-tabs').addEventListener('click', (e) => {
    if (!pageActive) return
    const tab = e.target.closest('.wb-list-tab')
    if (!tab) return
    currentFilter = tab.dataset.tabId
    container.querySelectorAll('.wb-list-tab').forEach(t =>
      t.classList.toggle('wb-list-tab--active', t.dataset.tabId === currentFilter)
    )
    buildAndRenderList()
  })

  // ── 构建并渲染列表 ──
  async function buildAndRenderList() {
    if (!pageActive) return
    const myBuildId = ++buildId

    let words = []

    if (listType === 'my-words') {
      // 所有已学词
      words = Object.entries(wordsMap)
        .filter(([, s]) => s.state && s.state !== 'new')
        .map(([w]) => w)
        .sort()
    } else if (listType === 'my-favorites') {
      // 所有收藏词
      words = Object.entries(wordsMap)
        .filter(([, s]) => s.isFavorited)
        .map(([w]) => w)
        .sort()
    } else if (listType === 'bank' && bankId) {
      const bank = await loadBank(bankId)
      if (!pageActive || myBuildId !== buildId) return
      if (!bank) {
        contentEl.innerHTML = '<div class="wb-list-empty">词库加载失败</div>'
        return
      }
      words = [...bank.words].sort()
    }

    // ── 应用筛选 ──
    if (currentFilter === 'favorites') {
      words = words.filter(w => wordsMap[w] && wordsMap[w].isFavorited)
    } else if (currentFilter === 'recent') {
      // 按 lastReview 降序，取前 100
      words = words
        .filter(w => wordsMap[w] && wordsMap[w].lastReview)
        .sort((a, b) => {
          const da = new Date(wordsMap[a].lastReview).getTime()
          const db = new Date(wordsMap[b].lastReview).getTime()
          return db - da
        })
        .slice(0, 100)
    } else if (currentFilter === 'learned') {
      words = words.filter(w => wordsMap[w] && wordsMap[w].state && wordsMap[w].state !== 'new')
    } else if (currentFilter === 'unlearned') {
      words = words.filter(w => !wordsMap[w] || !wordsMap[w].state || wordsMap[w].state === 'new')
    }

    // ── 应用搜索 ──
    if (currentSearchQuery) {
      const lowerQ = currentSearchQuery.toLowerCase()
      words = words.filter(w => w.toLowerCase().includes(lowerQ))
    }

    // ── 按首字母分组 ──
    const groups = new Map()
    for (const w of words) {
      const letter = /^[a-zA-Z]/.test(w) ? w[0].toUpperCase() : '#'
      if (!groups.has(letter)) groups.set(letter, [])
      groups.get(letter).push(w)
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })

    // ── 渲染字母索引 ──
    const allLetters = sortedGroups.map(([l]) => l)
    alphaEl.innerHTML = allLetters.map(l => {
      const isActive = allLetters.length > 0 && l === allLetters[0]
      return `<span class="wb-alpha-char${isActive ? ' wb-alpha-char--active' : ''}"
                   data-letter="${l}" title="${l}">${l}</span>`
    }).join('')

    if (allLetters.length === 0) {
      alphaEl.innerHTML = ''
    }

    // ── 渲染列表骨架（先显示拼写，释义异步加载）──
    const groupHTML = sortedGroups.map(([letter, letterWords]) => {
      const items = letterWords.map(w => {
        const learned = !!(wordsMap[w] && wordsMap[w].state && wordsMap[w].state !== 'new')
        const fav = !!(wordsMap[w] && wordsMap[w].isFavorited)
        return `
          <div class="wb-list-item" data-word="${escapeHTML(w)}">
            <span class="wb-list-item-word">${escapeHTML(w)}</span>
            <span class="wb-list-item-def wb-list-item-def--loading" data-def-word="${escapeHTML(w)}">...</span>
            <span class="wb-list-item-badges">
              ${learned ? '<span title="已学">✅</span>' : ''}
              ${fav ? '<span title="收藏">⭐</span>' : ''}
            </span>
          </div>`
      }).join('')
      return `
        <div class="wb-list-group" data-letter="${letter}">
          <div class="wb-list-group-title" id="wb-group-${letter}">${letter}</div>
          ${items}
        </div>`
    }).join('')

    if (words.length === 0) {
      contentEl.innerHTML = '<div class="wb-list-empty">没有找到单词</div>'
    } else {
      contentEl.innerHTML = groupHTML
    }

    // ── 异步加载释义 ──
    if (words.length > 0) {
      await fetchDefs(words)
      if (!pageActive || myBuildId !== buildId) return
      // 更新释义
      for (const w of words) {
        const defEl = contentEl.querySelector(`[data-def-word="${escapeHTML(w)}"]`)
        if (!defEl) continue
        const def = getDef(w)
        if (def) {
          const defText = def.translation || def.definition || ''
          defEl.textContent = defText
          defEl.classList.remove('wb-list-item-def--loading')
        }
      }
    }

    // ── 绑定单词点击事件 ──
    contentEl.querySelectorAll('.wb-list-item').forEach(el => {
      el.addEventListener('click', () => {
        if (!pageActive) return
        const word = el.dataset.word
        navigate('detail', {
          detailWord: word,
          detailEntry: getDef(word),
          detailSourceBank: wordsMap[word]?.sourceBank || bankId || null,
        })
      })
    })

    // ── 绑定字母索引点击 ──
    alphaEl.querySelectorAll('.wb-alpha-char').forEach(charEl => {
      charEl.addEventListener('click', () => {
        if (!pageActive) return
        const letter = charEl.dataset.letter
        const group = contentEl.querySelector(`#wb-group-${letter}`)
        if (group) {
          group.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        // 更新激活状态
        alphaEl.querySelectorAll('.wb-alpha-char').forEach(c =>
          c.classList.remove('wb-alpha-char--active')
        )
        charEl.classList.add('wb-alpha-char--active')
      })
    })

    // ── 滚动时更新字母索引激活状态 ──
    // 先移除旧 handler，防止重复调用 buildAndRenderList 时累积监听器
    if (currentScrollHandler) {
      contentEl.removeEventListener('scroll', currentScrollHandler)
    }
    currentScrollHandler = () => {
      if (!pageActive) return
      let activeLetter = null
      const groups = contentEl.querySelectorAll('.wb-list-group-title')
      // 找到最靠近视口顶部的分组（第一个 rect.top >= 0 的标题）
      for (const g of groups) {
        const rect = g.getBoundingClientRect()
        if (rect.top >= -2) { // 允许 2px 容差
          activeLetter = g.textContent
          break
        }
      }
      // 如果所有标题都在视口上方（已滚到最底部），取最后一个
      if (!activeLetter && groups.length > 0) {
        activeLetter = groups[groups.length - 1].textContent
      }
      if (activeLetter) {
        alphaEl.querySelectorAll('.wb-alpha-char').forEach(c => {
          c.classList.toggle('wb-alpha-char--active', c.dataset.letter === activeLetter)
        })
      }
    }
    contentEl.addEventListener('scroll', currentScrollHandler, { passive: true })
  }

  // 初始渲染
  buildAndRenderList()

  return () => {
    pageActive = false
    clearTimeout(searchTimer)
    if (currentScrollHandler) {
      contentEl.removeEventListener('scroll', currentScrollHandler)
    }
  }
}

// ══════════════════════════════════════════════════════
// 单词详情卡片
// ══════════════════════════════════════════════════════

function renderDetail(container, state, navigate, goBack, onBack) {
  container.className = 'page page--word'
  let pageActive = true
  const { detailWord, detailEntry, detailSourceBank } = state

  // ── 获取最新状态 ──
  const wp = getWordProgress()
  const wordState = (wp.words && wp.words[detailWord]) || null
  const isLearned = !!(wordState && wordState.state && wordState.state !== 'new')
  const isFav = !!(wordState && wordState.isFavorited)
  const sourceBank = wordState?.sourceBank || detailSourceBank

  // ── 渲染骨架 ──
  container.innerHTML = `
    <div class="wb-detail">
      <div class="wb-detail-header">
        <button class="wb-detail-back" id="wb-detail-back">← 返回</button>
      </div>
      <div class="wb-detail-card-wrap">
        <div class="wb-detail-card" id="wb-detail-card">
          <div class="wb-list-loading"><span class="wb-spinner"></span> 加载中...</div>
        </div>
      </div>
    </div>
  `

  const cardEl = container.querySelector('#wb-detail-card')

  container.querySelector('#wb-detail-back').addEventListener('click', () => {
    if (!pageActive) return
    goBack()
  })

  // ── 异步加载释义 ──
  loadDetail().then(() => {
    if (!pageActive) return
    renderDetailCard()
  })

  async function loadDetail() {
    if (!detailEntry || (!detailEntry.translation && !detailEntry.definition)) {
      await fetchDefs([detailWord])
    }
  }

  function renderDetailCard() {
    if (!pageActive) return

    // 每次渲染时重新读取最新状态（收藏切换后需要刷新）
    const wp2 = getWordProgress()
    const ws = (wp2.words && wp2.words[detailWord]) || null
    const learned = !!(ws && ws.state && ws.state !== 'new')
    const fav = !!(ws && ws.isFavorited)
    const bank = ws?.sourceBank || detailSourceBank

    const entry = getDef(detailWord) || detailEntry || {}
    const word = entry.word || detailWord
    const phonetic = entry.phonetic || ''
    const defText = entry.translation || entry.definition || ''
    const example = entry.detail || '' // ECDICT 例句 + 翻译

    // 解析例句（格式可能是 "例句英文\\n例句中文"）
    let exampleEn = ''
    let exampleCn = ''
    if (example) {
      const parts = example.split('\n')
      exampleEn = parts[0] || ''
      exampleCn = parts.slice(1).join('\n') || ''
    }

    // 来源词库名称
    const bankMeta = BANK_META[bank]
    const bankName = bankMeta ? bankMeta.name : (bank || '未知')

    cardEl.innerHTML = `
      <div class="wb-detail-word">${escapeHTML(word)}</div>
      ${phonetic ? `<div class="wb-detail-phonetic">${escapeHTML(phonetic)}</div>` : ''}
      <div class="wb-detail-defs">
        <div class="wb-detail-def-item">${escapeHTML(defText) || '(无释义)'}</div>
      </div>
      ${exampleEn ? `
        <div class="wb-detail-example">
          <div class="wb-detail-example-en">📝 "${escapeHTML(exampleEn)}"</div>
          ${exampleCn ? `<div class="wb-detail-example-cn">${escapeHTML(exampleCn)}</div>` : ''}
        </div>` : ''}
      <div class="wb-detail-meta">
        <span class="wb-detail-source">📚 来源：${escapeHTML(bankName)}</span>
        <span class="wb-detail-status">${learned ? '✅ 已学习' : '📖 未学习'}</span>
      </div>
      <div class="wb-detail-actions">
        <button class="wb-detail-btn wb-detail-btn--fav ${fav ? 'wb-detail-btn--fav-active' : ''}"
                id="wb-detail-fav">
          ${fav ? '⭐ 取消收藏' : '☆ 收藏'}
        </button>
        ${learned ? `
          <button class="wb-detail-btn wb-detail-btn--danger" id="wb-detail-relearn">
            🔄 重新学习
          </button>` : ''}
      </div>
    `

    // ── 收藏切换 ──
    const favBtn = cardEl.querySelector('#wb-detail-fav')
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        if (!pageActive) return
        toggleFavorite(detailWord)
        // 刷新 UI
        renderDetailCard()
      })
    }

    // ── 重新学习 ──
    const relearnBtn = cardEl.querySelector('#wb-detail-relearn')
    if (relearnBtn) {
      relearnBtn.addEventListener('click', () => {
        if (!pageActive) return
        showRelearnConfirm()
      })
    }
  }

  function toggleFavorite(word) {
    const wp2 = getWordProgress()
    if (!wp2.words) wp2.words = {}
    if (!wp2.words[word]) {
      // 收藏未学词：创建一个最小记录
      wp2.words[word] = {
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
      wp2.words[word] = {
        ...wp2.words[word],
        isFavorited: !wp2.words[word].isFavorited,
      }
    }
    saveWordProgress(wp2)
  }

  function showRelearnConfirm() {
    const overlay = document.createElement('div')
    overlay.className = 'wb-overlay'
    overlay.innerHTML = `
      <div class="wb-modal">
        <div class="wb-modal-title">🔄 重新学习</div>
        <div class="wb-modal-body">
          将 <b style="color:#fff">${escapeHTML(detailWord)}</b> 从已学词中移除，<br>
          下次可以重新学习这个单词。
        </div>
        <div class="wb-modal-buttons">
          <button class="wb-modal-btn wb-modal-btn--secondary" id="wb-relearn-cancel">取消</button>
          <button class="wb-modal-btn wb-modal-btn--danger" id="wb-relearn-confirm">确认移除</button>
        </div>
      </div>
    `
    container.appendChild(overlay)

    overlay.querySelector('#wb-relearn-cancel').addEventListener('click', () => {
      overlay.remove()
    })

    overlay.querySelector('#wb-relearn-confirm').addEventListener('click', () => {
      if (!pageActive) return
      const wp2 = getWordProgress()
      if (wp2.words && wp2.words[detailWord]) {
        delete wp2.words[detailWord]
        saveWordProgress(wp2)
      }
      // 清除释义缓存
      _defCache.delete(detailWord)
      overlay.remove()

      // 回到上一个视图
      goBack()
    })

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })
  }

  return () => { pageActive = false }
}

// ══════════════════════════════════════════════════════
// 对外 API
// ══════════════════════════════════════════════════════

/**
 * 挂载单词本到指定容器。返回清理函数。
 * @param {HTMLElement} container
 * @param {{ onBack: Function }} opt
 * @returns {Function} cleanup
 */
export function mountWordBook(container, opt) {
  const { onBack } = opt || {}

  // 注入样式（仅一次）
  if (!document.getElementById('word-book-style')) {
    const style = document.createElement('style')
    style.id = 'word-book-style'
    style.textContent = CSS_TEXT
    document.head.appendChild(style)
  }

  // 状态
  const state = {
    view: 'main',
    listType: null,
    bankId: null,
    filter: 'all',
    searchQuery: '',
    detailWord: null,
    detailEntry: null,
    detailSourceBank: null,
    backStack: [],
  }

  let pageActive = true
  let currentCleanup = null

  function navigate(view, params = {}) {
    if (currentCleanup) {
      currentCleanup()
      currentCleanup = null
    }

    // 记录导航历史（推入当前状态）
    if (state.view && state.view !== view) {
      state.backStack.push({
        view: state.view,
        listType: state.listType,
        bankId: state.bankId,
        filter: state.filter,
        searchQuery: state.searchQuery,
        detailWord: state.detailWord,
        detailEntry: state.detailEntry,
        detailSourceBank: state.detailSourceBank,
      })
    }

    // 更新状态
    state.view = view
    state.listType = params.listType !== undefined ? params.listType : state.listType
    state.bankId = params.bankId !== undefined ? params.bankId : state.bankId
    state.filter = params.filter !== undefined ? params.filter : state.filter
    state.searchQuery = params.searchQuery !== undefined ? params.searchQuery : state.searchQuery
    state.detailWord = params.detailWord !== undefined ? params.detailWord : state.detailWord
    state.detailEntry = params.detailEntry !== undefined ? params.detailEntry : state.detailEntry
    state.detailSourceBank = params.detailSourceBank !== undefined ? params.detailSourceBank : state.detailSourceBank

    switch (view) {
      case 'main':
        currentCleanup = renderMain(container, state, navigate, goBack, onBack)
        break
      case 'list':
        currentCleanup = renderList(container, state, navigate, goBack, onBack)
        break
      case 'detail':
        currentCleanup = renderDetail(container, state, navigate, goBack, onBack)
        break
    }
  }

  function goBack() {
    if (currentCleanup) {
      currentCleanup()
      currentCleanup = null
    }

    const prev = state.backStack.pop()
    if (prev) {
      // 恢复之前的状态并直接渲染（不经过 navigate，避免重复 push）
      state.view = prev.view
      state.listType = prev.listType
      state.bankId = prev.bankId
      state.filter = prev.filter
      state.searchQuery = prev.searchQuery
      state.detailWord = prev.detailWord
      state.detailEntry = prev.detailEntry
      state.detailSourceBank = prev.detailSourceBank

      switch (prev.view) {
        case 'main':
          currentCleanup = renderMain(container, state, navigate, goBack, onBack)
          break
        case 'list':
          currentCleanup = renderList(container, state, navigate, goBack, onBack)
          break
        case 'detail':
          currentCleanup = renderDetail(container, state, navigate, goBack, onBack)
          break
      }
    } else {
      // 没有历史记录，回到单词首页
      onBack()
    }
  }

  // 渲染主页
  navigate('main')

  return () => {
    pageActive = false
    if (currentCleanup) {
      currentCleanup()
      currentCleanup = null
    }
  }
}
