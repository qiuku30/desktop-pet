const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { initStore, getState, setState } = require('./storage/store');

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

  // 宠物状态读写
  ipcMain.handle('pet:state:get', async () => {
    return await getState();
  });

  ipcMain.handle('pet:state:set', async (_, updates) => {
    const current = await getState();
    const merged = { ...current, ...updates };
    await setState(merged);
    return merged;
  });

  // 获取当前窗口模式
  ipcMain.handle('window:mode', () => currentMode);
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
