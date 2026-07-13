// Tooltip 窗口管理器 — 创建/管理独立 tooltip BrowserWindow
// 解决 dashboard 内 tooltip 被容器 overflow 裁剪的问题
const { BrowserWindow } = require('electron');

/** @type {BrowserWindow|null} */
let tooltipWin = null;

/**
 * 创建或更新 tooltip 窗口并显示
 * @param {BrowserWindow} mainWindow - 主窗口（用于计算屏幕坐标）
 * @param {{ html: string, x: number, y: number }} opts
 */
function showTooltipWindow(mainWindow, { html, x, y }) {
  const [px, py] = mainWindow.getPosition();
  const screenX = px + x;
  const screenY = py + y;

  // 窗口已存在 → 先隐藏，更新内容，加载完成后显示（避免旧内容闪烁）
  if (tooltipWin && !tooltipWin.isDestroyed()) {
    tooltipWin.hide();
    tooltipWin.setPosition(screenX, screenY);
    const htmlBase64 = Buffer.from(html, 'utf-8').toString('base64');
    tooltipWin.once('ready-to-show', () => {
      if (tooltipWin && !tooltipWin.isDestroyed()) tooltipWin.showInactive();
    });
    tooltipWin.loadURL('data:text/html;charset=utf-8;base64,' + htmlBase64);
    return;
  }

  // 首次创建
  tooltipWin = new BrowserWindow({
    parent: mainWindow,
    width: 160,
    height: 100,
    x: screenX,
    y: screenY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      sandbox: false,
    },
  });

  const htmlBase64 = Buffer.from(html, 'utf-8').toString('base64');
  tooltipWin.loadURL('data:text/html;charset=utf-8;base64,' + htmlBase64);

  // 准备好再显示，避免白屏闪烁
  tooltipWin.once('ready-to-show', () => {
    if (tooltipWin && !tooltipWin.isDestroyed()) {
      tooltipWin.showInactive();
    }
  });

  // 加载失败时清理
  tooltipWin.webContents.on('did-fail-load', () => {
    if (tooltipWin && !tooltipWin.isDestroyed()) {
      tooltipWin.close();
    }
    tooltipWin = null;
  });

  // 窗口被外部关闭时清理引用
  tooltipWin.on('closed', () => {
    tooltipWin = null;
  });
}

/**
 * 隐藏 tooltip 窗口（不销毁）
 */
function hideTooltipWindow() {
  if (tooltipWin && !tooltipWin.isDestroyed()) {
    tooltipWin.hide();
  }
}

/**
 * 销毁 tooltip 窗口
 */
function closeTooltipWindow() {
  if (tooltipWin && !tooltipWin.isDestroyed()) {
    tooltipWin.close();
  }
  tooltipWin = null;
}

module.exports = { showTooltipWindow, hideTooltipWindow, closeTooltipWindow };
