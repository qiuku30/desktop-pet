// 面板导航配置 — 原则 5 配置驱动
// 加新导航项只需在此数组中加一行

/**
 * 通用占位页面渲染器
 * @param {HTMLElement} container
 * @param {string} icon
 * @param {string} label
 */
function buildPlaceholderPage(container, icon, label) {
  container.className = 'page page--placeholder'
  container.innerHTML = `
    <div class="placeholder-page">
      <div class="placeholder-icon">${icon}</div>
      <div class="placeholder-label">${label}</div>
      <div class="placeholder-hint">即将开放，敬请期待</div>
    </div>
  `
}

function buildShopPlaceholder(container) {
  buildPlaceholderPage(container, '🛒', '商店')
}

function buildSettingsPlaceholder(container) {
  buildPlaceholderPage(container, '⚙️', '设置')
}

// ── 仓库分类配置（原则 5：配置驱动）──
// 新增分类只需追加一行，不改渲染逻辑。
// enabled: false → 置灰占位（半透明 + pointer-events: none）
// unlockLevel: 未解锁时置灰（预留字段，当前版本不校验）
export const WAREHOUSE_CATEGORIES = [
  { id: 'all',  label: '全部', enabled: true },
  { id: 'food', label: '食物', enabled: true },
  { id: 'item', label: '道具', enabled: false },
]

export const NAV_ITEMS = [
  { id: 'home',      icon: '🏠', label: '主页',  section: 'top',    enabled: true,  render: null }, // render 在 dashboard.js 注入
  { id: 'warehouse', icon: '🎒', label: '仓库',  section: 'top',    enabled: true,  render: null }, // render 在 dashboard.js 注入
  { id: 'shop',      icon: '🛒', label: '商店',  section: 'top',    enabled: true,  render: null }, // render 在 dashboard.js 注入
  { id: 'settings',  icon: '⚙️', label: '设置',  section: 'bottom', enabled: true,  render: null },
]
