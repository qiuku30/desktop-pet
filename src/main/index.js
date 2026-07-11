const { app, BrowserWindow, ipcMain, Menu, dialog, screen } = require('electron');
const path = require('path');
const { initStore } = require('./storage/store');
const { registerPetIPC } = require('./ipc/pet-ipc');

// ── 窗口状态常量 ──
const PET_MODE = {
  width: 200,
  height: 200,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  resizable: false,
  skipTaskbar: true,
};

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

let cursorTimer = null; // 全局光标轮询句柄

// 每 ~16ms 把全局光标坐标推给渲染进程。仅宠物态运行。
function startCursorPolling() {
  if (cursorTimer) return;
  cursorTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { x, y } = screen.getCursorScreenPoint();
    mainWindow.webContents.send('cursor:pos', { x, y });
  }, 32);
}

function stopCursorPolling() {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
}

// ── 创建窗口 ──
function createWindow() {
  mainWindow = new BrowserWindow({
    ...PET_MODE,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    hasShadow: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/pet/pet.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    startCursorPolling();
  });

  mainWindow.on('closed', () => {
    stopCursorPolling();
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
        label: '退出',
        click: () => app.quit(),
      },
    ]);
    menu.popup();
  });
}

// ── 窗口模式切换 ──
function switchToDashboard() {
  stopCursorPolling();
  currentMode = 'dashboard';

  // 保存宠物态时的位置和大小
  const petBounds = mainWindow.getBounds();

  mainWindow.setMinimumSize(600, 400);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setResizable(true);
  mainWindow.setSkipTaskbar(false);

  // 展开到面板大小，居中
  mainWindow.setSize(DASHBOARD_MODE.width, DASHBOARD_MODE.height);
  mainWindow.center();
}

function switchToPet() {
  currentMode = 'pet';

  mainWindow.setMinimumSize(100, 100);
  mainWindow.setAlwaysOnTop(true);
  mainWindow.setResizable(false);
  mainWindow.setSkipTaskbar(true);

  // 缩回宠物大小
  mainWindow.setSize(PET_MODE.width, PET_MODE.height);
  mainWindow.center();
  startCursorPolling();
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

  // 获取当前窗口模式
  ipcMain.handle('window:mode', () => currentMode);

  // 取窗口左上角坐标
  ipcMain.handle('window:position:get', () => {
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  });

  // 移窗到屏幕绝对坐标，clamp 到当前显示器工作区，返回真实落点
  ipcMain.handle('window:move', (_, { x, y }) => {
    const [w, h] = mainWindow.getSize();
    const { workArea } = screen.getDisplayNearestPoint({ x, y });
    const clampedX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - w));
    const clampedY = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - h));
    mainWindow.setPosition(Math.round(clampedX), Math.round(clampedY));
    const [ax, ay] = mainWindow.getPosition();
    return { x: ax, y: ay };
  });
}

// ── 应用生命周期 ──
app.whenReady().then(async () => {
  await initStore();
  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
