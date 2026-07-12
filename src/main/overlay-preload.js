// 预加载脚本 — overlay 窗口专用的安全 IPC 桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  // 获取 overlay 配置（html, width, height 等）
  getConfig: () => ipcRenderer.invoke('overlay:config:get'),

  // 关闭 overlay 并返回结果给调用方
  close: (result) => ipcRenderer.invoke('overlay:close', result),
});
