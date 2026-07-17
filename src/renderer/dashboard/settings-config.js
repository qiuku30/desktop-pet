// src/renderer/dashboard/settings-config.js
// 设置页配置 — 原则 5 配置驱动
// 新增分类/设置项只需追加配置，不改渲染逻辑

export const SETTINGS_TABS = [
  {
    id: 'general',
    label: '通用',
    items: [
      { id: 'showTooltip', label: '悬浮提示', type: 'toggle', default: true },
    ],
  },
  {
    id: 'window',
    label: '窗口',
    items: [
      { id: 'alwaysOnTop',   label: '面板置顶',   type: 'toggle', default: false },
      { id: 'wanderEnabled', label: '自动走动',   type: 'toggle', default: true },
    ],
  },
]
