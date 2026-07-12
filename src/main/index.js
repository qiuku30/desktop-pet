const { app, BrowserWindow, ipcMain, Menu, dialog, screen } = require('electron');
const path = require('path');
const { initStore, getState, setState } = require('./storage/store');
const { registerPetIPC } = require('./ipc/pet-ipc');

// ── 窗口状态常量 ──
const DASHBOARD_MODE = {
  width: 800,
  height: 600,
  transparent: false,
  frame: true,
  alwaysOnTop: false,
  resizable: true,
  skipTaskbar: false,
};

let mainWindow = null;
let currentMode = 'pet'; // 'pet' | 'dashboard'
let isAutoMoving = false; // 区分自动走动 vs 用户拖拽
let currentZoom = 1.0;   // 用户缩放倍率（0.75 / 1.0 / 1.25 / 1.5）
let savedPetBounds = null; // 切面板前记下宠物位置，切回时恢复
let wanderEnabled = true;  // 随机走动开关
let currentPetSize = 200;  // 当前宠物窗口的基准尺寸（防 DPI 漂移）

// 动态窗口尺寸：基准 200px × 显示器缩放 × 用户缩放
function getPetSize(zoomLevel) {
  return Math.round(200 * screen.getPrimaryDisplay().scaleFactor * zoomLevel)
}

// 锁定窗口为正方形（用 min=max 代替 resizable:false，程序可调）
function lockPetSize(win, size) {
  win.setMinimumSize(size, size)
  win.setMaximumSize(size, size)
}


// ── 创建窗口 ──
function createWindow() {
  const size = getPetSize(currentZoom)
  mainWindow = new BrowserWindow({
    width: size,
    height: size,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    hasShadow: false,
  });
  currentPetSize = size;
  lockPetSize(mainWindow, size);

  mainWindow.loadFile(path.join(__dirname, '../renderer/pet/pet.html'));

  // 用户拖拽检测：OS 原生拖拽不经过 IPC，move 事件里 !isAutoMoving = 用户拖拽
  mainWindow.on('move', () => {
    if (!isAutoMoving) {
      mainWindow.webContents.send('user:drag');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 右键菜单
  mainWindow.webContents.on('context-menu', (_, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: '喂食',
        click: () => mainWindow.webContents.send('menu:feed'),
      },
      {
        label: '状态',
        click: () => mainWindow.webContents.send('menu:status'),
      },
      { type: 'separator' },
      {
        label: '缩放',
        submenu: [
          { label: '小 (75%)',  type: 'radio', checked: currentZoom === 0.75, click: () => applyZoom(0.75) },
          { label: '中 (100%)', type: 'radio', checked: currentZoom === 1.0,  click: () => applyZoom(1.0) },
          { label: '大 (125%)', type: 'radio', checked: currentZoom === 1.25, click: () => applyZoom(1.25) },
          { label: '特大 (150%)', type: 'radio', checked: currentZoom === 1.5,  click: () => applyZoom(1.5) },
        ],
      },
      { type: 'separator' },
      {
        label: '自动走动',
        type: 'checkbox',
        checked: wanderEnabled,
        click: () => {
          wanderEnabled = !wanderEnabled
          mainWindow.webContents.send('wander:toggle', wanderEnabled)
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);
    menu.popup();
  });
}

// ── 缩放 ──
async function applyZoom(zoom) {
  currentZoom = zoom
  if (currentMode === 'pet' && mainWindow) {
    const newSize = getPetSize(zoom)
    // 以窗口中心为锚点缩放，避免位置偏移
    const [x, y] = mainWindow.getPosition()
    const [w, h] = mainWindow.getSize()
    const cx = x + w / 2
    const cy = y + h / 2
    const newX = Math.round(cx - newSize / 2)
    const newY = Math.round(cy - newSize / 2)
    currentPetSize = newSize
    lockPetSize(mainWindow, newSize)
    mainWindow.setBounds({ x: newX, y: newY, width: newSize, height: newSize })
  }
  // 持久化：合并现有 state 保留其他字段
  try {
    const state = await getState()
    state.zoomLevel = zoom
    await setState(state)
  } catch (_) {}
}

// ── 窗口模式切换 ──
function switchToDashboard() {
  currentMode = 'dashboard';

  // 保存宠物态位置，切回时恢复
  savedPetBounds = mainWindow.getBounds();

  mainWindow.setMinimumSize(600, 400);
  mainWindow.setMaximumSize(0, 0);     // 解除宠物态的尺寸锁定
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setResizable(true);
  mainWindow.setSkipTaskbar(false);

  // 展开到面板大小
  mainWindow.setSize(DASHBOARD_MODE.width, DASHBOARD_MODE.height);
  mainWindow.center();

  mainWindow.loadFile(path.join(__dirname, '../renderer/dashboard/dashboard.html'));
}

function switchToPet() {
  currentMode = 'pet';
  const size = getPetSize(currentZoom)
  currentPetSize = size
  lockPetSize(mainWindow, size)
  mainWindow.setResizable(false)
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setSkipTaskbar(true)

  if (savedPetBounds) {
    // 恢复宠物原来的位置（面板从哪来，回哪去）
    mainWindow.setBounds({ x: savedPetBounds.x, y: savedPetBounds.y, width: size, height: size })
  } else {
    mainWindow.setSize(size, size)
    mainWindow.center()
  }

  mainWindow.loadFile(path.join(__dirname, '../renderer/pet/pet.html'));
}

// ── IPC 处理 ──
function setupIPC() {
  // 窗口模式切换
  ipcMain.handle('window:toggle', () => {
    if (currentMode === 'pet') {
      switchToDashboard();
    } else {
      switchToPet();
    }
    return currentMode;
  });

  // 宠物状态读写 — 委托给 pet-ipc 模块（整体覆盖 + 空快照保护）
  registerPetIPC(ipcMain);

  // 保护 zoomLevel 不被渲染端存盘整体覆盖冲掉
  ipcMain.removeHandler('pet:state:set')
  ipcMain.handle('pet:state:set', async (_, snapshot) => {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || Object.keys(snapshot).length === 0) {
      console.warn('[main] pet:state:set 拒绝空快照')
      return await getState()
    }
    const current = await getState()
    if (current.zoomLevel != null) snapshot.zoomLevel = current.zoomLevel
    await setState(snapshot)
    return snapshot
  })

  // 光标拉取：渲染进程在自己的 rAF 循环里主动调，渲染忙时自然降频，永不积压
  ipcMain.handle('cursor:pos:get', () => {
    const { x, y } = screen.getCursorScreenPoint();
    return { x, y };
  });

  // 获取当前窗口模式
  ipcMain.handle('window:mode', () => currentMode);

  // 取窗口左上角坐标
  ipcMain.handle('window:position:get', () => {
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  });

  // 自动走动：标记 isAutoMoving，防止被 move 事件误判为用户拖拽
  // 用 currentPetSize 而非 getSize()：高 DPI 下 getSize 会读到已被漂移污染的尺寸
  ipcMain.handle('window:move', (_, { x, y }) => {
    isAutoMoving = true;
    mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: currentPetSize, height: currentPetSize })
    isAutoMoving = false;
    return { x, y };
  });
}

// ── 应用生命周期 ──
app.whenReady().then(async () => {
  await initStore();

  // 恢复用户缩放偏好
  try {
    const state = await getState()
    if (state.zoomLevel) currentZoom = state.zoomLevel
  } catch (_) {}

  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
