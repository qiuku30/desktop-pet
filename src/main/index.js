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
let isAutoMoving = false; // 区分自动走动 vs 用户拖拽


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
        label: '退出',
        click: () => app.quit(),
      },
    ]);
    menu.popup();
  });
}

// ── 窗口模式切换 ──
function switchToDashboard() {
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
  ipcMain.handle('window:move', (_, { x, y }) => {
    isAutoMoving = true;
    mainWindow.setPosition(Math.round(x), Math.round(y));
    isAutoMoving = false;
    return { x, y };
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
