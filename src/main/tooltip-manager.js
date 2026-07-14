// Tooltip 窗口管理器 — 创建/管理独立 tooltip BrowserWindow
// 解决 dashboard 内 tooltip 被容器 overflow 裁剪的问题
const { BrowserWindow } = require('electron');

/** @type {BrowserWindow|null} */
let tooltipWin = null;

// 当前 tooltip 的目标屏幕坐标 + 宽度（模块级，防止快速滑动时旧 fitToContent 覆盖新位置）
let _targetX = 0, _targetY = 0, _targetW = 160;

/**
 * 创建或更新 tooltip 窗口并显示
 * @param {BrowserWindow} mainWindow - 主窗口（用于计算屏幕坐标）
 * @param {{ html: string, x: number, y: number, width?: number, height?: number }} opts
 */
function showTooltipWindow(mainWindow, { html, x, y, width, height }) {
  const w = width || 160
  const initH = height || 100   // 初始估算高度，加载完成后自动修正
  const [px, py] = mainWindow.getPosition();
  _targetX = px + x;
  _targetY = py + y;
  _targetW = w;

  // ── 自动高度：页面加载完成后取 scrollHeight，窗口恰好包住内容 ──
  function fitToContent(win) {
    const tx = _targetX, ty = _targetY, tw = _targetW;
    return win.webContents.executeJavaScript('document.body.scrollHeight')
      .then(actualH => {
        if (win && !win.isDestroyed()) {
          win.setBounds({ x: tx, y: ty, width: tw, height: actualH });
        }
      })
      .catch(() => {});  // executeJavaScript 失败静默忽略，用估算高度兜底
  }

  // 窗口已存在 → 移动 + 更新内容 + 调整尺寸 + 显示
  if (tooltipWin && !tooltipWin.isDestroyed()) {
    tooltipWin.setBounds({ x: _targetX, y: _targetY, width: _targetW, height: initH });
    tooltipWin.webContents.stop();
    const htmlBase64 = Buffer.from(html, 'utf-8').toString('base64');
    tooltipWin.loadURL('data:text/html;charset=utf-8;base64,' + htmlBase64)
      .then(() => fitToContent(tooltipWin))
      .catch(() => {});
    tooltipWin.showInactive();
    return;
  }

  // 首次创建
  tooltipWin = new BrowserWindow({
    parent: mainWindow,
    width: _targetW,
    height: initH,
    x: _targetX,
    y: _targetY,
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
  // 先取实际高度 → 调整后再显示，消除首次闪烁
  tooltipWin.once('ready-to-show', async () => {
    if (tooltipWin && !tooltipWin.isDestroyed()) {
      await fitToContent(tooltipWin);
      tooltipWin.showInactive();
    }
  });
  tooltipWin.loadURL('data:text/html;charset=utf-8;base64,' + htmlBase64);

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
