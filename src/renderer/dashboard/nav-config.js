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

function buildWarehousePlaceholder(container) {
  buildPlaceholderPage(container, '🎒', '仓库')
}

function buildShopPlaceholder(container) {
  buildPlaceholderPage(container, '🛒', '商店')
}

function buildSettingsPlaceholder(container) {
  buildPlaceholderPage(container, '⚙️', '设置')
}

export const NAV_ITEMS = [
  { id: 'home',      icon: '🏠', label: '主页',  section: 'top',    enabled: true,  render: null }, // render 在 dashboard.js 注入
  { id: 'warehouse', icon: '🎒', label: '仓库',  section: 'top',    enabled: false, render: buildWarehousePlaceholder },
  { id: 'shop',      icon: '🛒', label: '商店',  section: 'top',    enabled: false, render: buildShopPlaceholder },
  { id: 'settings',  icon: '⚙️', label: '设置',  section: 'bottom', enabled: false, render: buildSettingsPlaceholder },
]
