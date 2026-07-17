// 预加载脚本 — 安全地暴露 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口切换
  toggleWindow: () => ipcRenderer.invoke('window:toggle'),
  getWindowMode: () => ipcRenderer.invoke('window:mode'),

  // 宠物状态
  getPetState: () => ipcRenderer.invoke('pet:state:get'),
  setPetState: (updates) => ipcRenderer.invoke('pet:state:set', updates),

  // 菜单事件监听（返回取消订阅函数，防止面板重载时监听器堆积）
  onMenuFeed: (callback) => {
    ipcRenderer.on('menu:feed', callback)
    return () => ipcRenderer.removeListener('menu:feed', callback)
  },
  onMenuStatus: (callback) => {
    ipcRenderer.on('menu:status', callback)
    return () => ipcRenderer.removeListener('menu:status', callback)
  },

  // 窗口移动（桌面级）
  getWindowPosition: () => ipcRenderer.invoke('window:position:get'),
  moveWindow: (x, y) => ipcRenderer.invoke('window:move', { x, y }),

  // 光标拉取：渲染进程按需调，自然背压，永不积压
  getCursorPos: () => ipcRenderer.invoke('cursor:pos:get'),

  // 用户拖拽通知：OS 原生拖拽时主进程推送，渲染端暂停自动化
  onUserDrag: (callback) => {
    ipcRenderer.on('user:drag', callback);
    return () => ipcRenderer.removeListener('user:drag', callback);
  },

  // 窗口尺寸 / 位置（面板缩放用）
  setWindowBounds: (bounds) => ipcRenderer.invoke('window:setBounds', bounds),
  getWindowBounds: () => ipcRenderer.invoke('window:bounds:get'),

  // 通用悬浮面板
  showOverlay: (opts) => ipcRenderer.invoke('overlay:show', opts),
  closeOverlay: () => ipcRenderer.send('overlay:force-close'),

  // Tooltip 悬浮提示（fire-and-forget，无返回值）
  showTooltip: (opts) => ipcRenderer.send('tooltip:show', opts),
  hideTooltip: () => ipcRenderer.send('tooltip:hide'),
  closeTooltip: () => ipcRenderer.send('tooltip:close'),

  // 设置
  setAlwaysOnTop: (val) => ipcRenderer.send('settings:setAlwaysOnTop', val),

  // 番茄钟
  pomodoro: {
    getState: () => ipcRenderer.invoke('pomodoro:state:get'),
    command: (action) => ipcRenderer.send('pomodoro:command', action),
    updateSettings: (s) => ipcRenderer.send('pomodoro:settings:update', s),
    onTick: (cb) => {
      const h = (_, d) => cb(d);
      ipcRenderer.on('pomodoro:tick', h);
      return () => ipcRenderer.removeListener('pomodoro:tick', h);
    },
    onPhaseChange: (cb) => {
      const h = (_, d) => cb(d);
      ipcRenderer.on('pomodoro:phase:changed', h);
      return () => ipcRenderer.removeListener('pomodoro:phase:changed', h);
    },
    onNavigate: (cb) => {
      const h = () => cb();
      ipcRenderer.on('pomodoro:navigate', h);
      return () => ipcRenderer.removeListener('pomodoro:navigate', h);
    },
  },
});
