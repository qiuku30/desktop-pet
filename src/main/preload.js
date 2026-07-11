// 预加载脚本 — 安全地暴露 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口切换
  toggleWindow: () => ipcRenderer.invoke('window:toggle'),
  getWindowMode: () => ipcRenderer.invoke('window:mode'),

  // 宠物状态
  getPetState: () => ipcRenderer.invoke('pet:state:get'),
  setPetState: (updates) => ipcRenderer.invoke('pet:state:set', updates),

  // 菜单事件监听
  onMenuFeed: (callback) => ipcRenderer.on('menu:feed', callback),
  onMenuStatus: (callback) => ipcRenderer.on('menu:status'),

  // 窗口移动（桌面级）
  getWindowPosition: () => ipcRenderer.invoke('window:position:get'),
  moveWindow: (x, y) => ipcRenderer.invoke('window:move', { x, y }),
  onCursorPos: (callback) => ipcRenderer.on('cursor:pos', callback),
});
