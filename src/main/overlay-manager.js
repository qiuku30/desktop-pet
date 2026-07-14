// Overlay 窗口管理器 — 创建/管理独立悬浮面板
const { BrowserWindow } = require('electron');
const path = require('path');

// window.id → { resolve, opts }
const pendingOverlays = new Map();

/**
 * 注册 overlay 相关的 IPC handler
 * @param {Electron.IPCMain} ipcMain
 */
function initOverlayIPC(ipcMain) {
  // overlay 窗口启动时获取自己的配置
  ipcMain.handle('overlay:config:get', (event) => {
    const entry = pendingOverlays.get(event.sender.id);
    return entry ? entry.opts : null;
  });

  // overlay 窗口请求关闭并返回结果
  ipcMain.handle('overlay:close', (event, result) => {
    const entry = pendingOverlays.get(event.sender.id);
    if (!entry) return;

    entry.resolve(result);
    pendingOverlays.delete(event.sender.id);

    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });
}

/**
 * 创建 overlay 子窗口
 * @param {BrowserWindow} parentWindow - 父窗口（宠物窗口）
 * @param {object} opts - { html, width, height, x, y }
 * @returns {Promise<any>} - overlay 关闭时 resolve 结果，拒绝时返回 null
 */
function showOverlayWindow(parentWindow, opts) {
  // 同一时间只允许一个 overlay
  if (pendingOverlays.size > 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, _reject) => {
    const [px, py] = parentWindow.getPosition();
    const win = new BrowserWindow({
      parent: parentWindow,
      width: opts.width || 300,
      height: opts.height || 200,
      x: px + (opts.x || 0),
      y: py + (opts.y || 0),
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'overlay-preload.js'),
      },
    });

    // 准备好再显示，避免白屏闪烁
    win.once('ready-to-show', () => {
      win.show();
    });

    pendingOverlays.set(win.id, { resolve, opts });

    // 加载失败时 reject Promise，防止挂起
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      pendingOverlays.delete(win.id);
      _reject(new Error(`Overlay failed to load: ${errorDescription} (${errorCode})`));
    });

    win.loadFile(path.join(__dirname, '../renderer/overlay/overlay.html'));

    // 窗口被外部关闭时（如父窗口关闭），resolve null 并清理
    win.on('closed', () => {
      const entry = pendingOverlays.get(win.id);
      if (entry) {
        entry.resolve(null);
        pendingOverlays.delete(win.id);
      }
    });

    // 用户点击 overlay 之外的区域 → 失去焦点 → 自动关闭（等价于点取消）
    win.on('blur', () => {
      const entry = pendingOverlays.get(win.id);
      if (entry) {
        entry.resolve(null);
        pendingOverlays.delete(win.id);
        if (win && !win.isDestroyed()) {
          win.close();
        }
      }
    });
  });
}

/**
 * 强制关闭当前 overlay（面板切页/关闭时清理用）
 */
function closeOverlayWindow() {
  // 先收集再操作：win.close() 同步触发 closed 事件会修改 pendingOverlays
  const entries = Array.from(pendingOverlays.entries())
  pendingOverlays.clear()
  for (const [id, entry] of entries) {
    entry.resolve(null)
    const win = BrowserWindow.fromId(id)
    if (win && !win.isDestroyed()) {
      win.close()
    }
  }
}

module.exports = { initOverlayIPC, showOverlayWindow, closeOverlayWindow };
