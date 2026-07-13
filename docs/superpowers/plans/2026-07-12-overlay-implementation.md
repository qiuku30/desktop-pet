# Overlay 通用悬浮面板 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现通用悬浮面板基础设施，任何模块调用 `showOverlay(opts)` 即可弹出独立 overlay 窗口，用户操作后返回 Promise 结果。

**Architecture:** 调用方通过 IPC `overlay:show` 请求主进程创建子 BrowserWindow（parent=宠物窗口），加载 overlay.html。overlay 通过独立 preload 获取配置、注入 HTML 内容。用户点击 `[data-overlay-result]` 按钮后，overlay 调 `overlay:close` IPC 返回结果，主进程 resolve Promise 并销毁窗口。

**Tech Stack:** Electron (main + renderer), vanilla JS, CSS

## Global Constraints

- 窗口样式：frameless, transparent, alwaysOnTop, skipTaskbar
- 父子关系：`parent: mainWindow`（overlay 跟随宠物窗口层级）
- 定位：opts.x / opts.y 为相对父窗口左上角的偏移量
- 拖拽：CSS `-webkit-app-region: drag`（OS 原生，零延迟）
- 关闭：仅手动关闭（点按钮），不自动失焦关闭
- 同一时间只允许一个 overlay（新调用被拒绝时返回 null）
- contextIsolation: true，所有数据通过 preload 桥接

---
```

## 文件结构

```
src/
├── main/
│   ├── overlay-manager.js      ← 新建：showOverlayWindow + initOverlayIPC
│   ├── overlay-preload.js      ← 新建：overlay 窗口的 contextBridge
│   ├── preload.js              ← 修改：electronAPI 加 showOverlay
│   └── index.js                ← 修改：接线 overlay-manager
└── renderer/
    └── overlay/
        ├── overlay.html         ← 新建：骨架 HTML
        ├── overlay.css          ← 新建：样式
        └── overlay.js           ← 新建：初始化 + 事件委托
```

---

### Task 1: 创建 overlay-preload.js

**Files:**
- Create: `src/main/overlay-preload.js`

**Interfaces:**
- Produces: `window.overlayAPI.getConfig()` → Promise\<object\>, `window.overlayAPI.close(result)` → Promise\<void\>

overlay 窗口的独立 preload 脚本。通过 contextBridge 暴露两个方法给 overlay 渲染进程。

- [ ] **Step 1: 写入 overlay-preload.js**

```js
// 预加载脚本 — overlay 窗口专用的安全 IPC 桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  // 获取 overlay 配置（html, width, height 等）
  getConfig: () => ipcRenderer.invoke('overlay:config:get'),

  // 关闭 overlay 并返回结果给调用方
  close: (result) => ipcRenderer.invoke('overlay:close', result),
});
```

- [ ] **Step 2: 验证文件存在**

```bash
ls -la "src/main/overlay-preload.js"
```

- [ ] **Step 3: 提交**

```bash
git add src/main/overlay-preload.js
git commit -m "feat: add overlay-preload.js with contextBridge for overlay windows"
```

---

### Task 2: 创建 overlay.html + overlay.css

**Files:**
- Create: `src/renderer/overlay/overlay.html`
- Create: `src/renderer/overlay/overlay.css`

**Interfaces:**
- Produces: `#overlay-handle`（拖拽把手，CSS drag）、`#overlay-content`（内容注入区，CSS no-drag）

overlay 窗口的骨架 HTML 和样式。结构分两层：顶部拖拽把手 + 内容区。

- [ ] **Step 1: 创建目录并写入 overlay.html**

```bash
mkdir -p "src/renderer/overlay"
```

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="overlay.css">
  <title>Overlay</title>
</head>
<body>
  <div id="overlay-root">
    <div id="overlay-handle"></div>
    <div id="overlay-content"></div>
  </div>
  <script src="overlay.js"></script>
</body>
</html>
```

- [ ] **Step 2: 写入 overlay.css**

```css
/* Overlay 悬浮面板样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

#overlay-root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgba(30, 30, 30, 0.94);
  backdrop-filter: blur(12px);
  color: #eee;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
}

/* ── 拖拽把手 ── */
#overlay-handle {
  height: 28px;
  min-height: 28px;
  -webkit-app-region: drag;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px 12px 0 0;
}

#overlay-handle::after {
  content: '';
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
}

/* ── 内容区 ── */
#overlay-content {
  flex: 1;
  padding: 10px 14px 14px;
  -webkit-app-region: no-drag;
  overflow-y: auto;
}

/* ── 内容区按钮基础样式 ── */
#overlay-content button[data-overlay-result] {
  display: inline-block;
  padding: 6px 14px;
  margin: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #eee;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
}

#overlay-content button[data-overlay-result]:hover {
  background: rgba(255, 255, 255, 0.18);
}
```

- [ ] **Step 3: 验证文件存在**

```bash
ls -la src/renderer/overlay/overlay.html src/renderer/overlay/overlay.css
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/overlay/overlay.html src/renderer/overlay/overlay.css
git commit -m "feat: add overlay.html and overlay.css skeleton"
```

---

### Task 3: 创建 overlay.js

**Files:**
- Create: `src/renderer/overlay/overlay.js`

**Interfaces:**
- Consumes: `window.overlayAPI.getConfig()` → `{ html, ...opts }`, `window.overlayAPI.close(result)`
- Produces: 初始化 overlay 内容，绑定事件委托

overlay 窗口的渲染逻辑：获取配置 → 注入 HTML → 监听 `[data-overlay-result]` 点击 → 调 close 返回结果。

- [ ] **Step 1: 写入 overlay.js**

```js
// Overlay 渲染逻辑
(async function () {
  try {
    const config = await window.overlayAPI.getConfig();

    if (!config) {
      console.warn('[overlay] 未获取到配置，关闭窗口');
      window.overlayAPI.close(null);
      return;
    }

    // 注入 HTML 内容
    if (config.html) {
      document.getElementById('overlay-content').innerHTML = config.html;
    }

    // 事件委托：监听内容区所有 [data-overlay-result] 点击
    document.getElementById('overlay-content').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-overlay-result]');
      if (!btn) return;

      const raw = btn.dataset.overlayResult;
      let value = null;
      try {
        value = JSON.parse(raw);
      } catch (_) {
        // 如果解析失败，当做原始字符串
        value = raw;
      }
      window.overlayAPI.close(value);
    });
  } catch (err) {
    console.error('[overlay] 初始化失败:', err);
    window.overlayAPI.close(null);
  }
})();
```

- [ ] **Step 2: 验证文件存在**

```bash
ls -la src/renderer/overlay/overlay.js
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/overlay/overlay.js
git commit -m "feat: add overlay.js with config injection and event delegation"
```

---

### Task 4: 创建 overlay-manager.js

**Files:**
- Create: `src/main/overlay-manager.js`

**Interfaces:**
- Produces: `initOverlayIPC(ipcMain)` — 注册 `overlay:config:get` 和 `overlay:close` handler；`showOverlayWindow(parentWindow, opts)` → Promise\<any\> — 创建 overlay 窗口，返回 Promise

主进程侧的 overlay 管理器。维护 Promise Map，处理窗口创建、配置传递、结果返回、资源清理。

- [ ] **Step 1: 写入 overlay-manager.js**

```js
// Overlay 窗口管理器 — 创建/管理独立悬浮面板
const { BrowserWindow } = require('electron');
const path = require('path');

// window.id → { resolve, reject, opts }
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

    pendingOverlays.set(win.id, { resolve, reject: _reject, opts });

    win.loadFile(path.join(__dirname, '../renderer/overlay/overlay.html'));

    // 窗口被外部关闭时（如父窗口关闭），resolve null 并清理
    win.on('closed', () => {
      const entry = pendingOverlays.get(win.id);
      if (entry) {
        entry.resolve(null);
        pendingOverlays.delete(win.id);
      }
    });
  });
}

module.exports = { initOverlayIPC, showOverlayWindow };
```

- [ ] **Step 2: 验证文件存在且语法正确**

```bash
node -c "src/main/overlay-manager.js"
```

- [ ] **Step 3: 提交**

```bash
git add src/main/overlay-manager.js
git commit -m "feat: add overlay-manager.js with showOverlayWindow and IPC handlers"
```

---

### Task 5: 修改 preload.js — 添加 showOverlay

**Files:**
- Modify: `src/main/preload.js`

**Interfaces:**
- Consumes: 现有 `electronAPI` 对象结构
- Produces: `window.electronAPI.showOverlay(opts)` → Promise\<any\>

在宠物/面板窗口的 preload 中暴露 `showOverlay` 方法，让渲染进程可以调起 overlay。

- [ ] **Step 1: 在 electronAPI 对象末尾添加 showOverlay**

编辑 `src/main/preload.js`，在 `onWanderToggle` 之后（右花括号之前）加一个方法。

找到：
```js
  // 随机走动开关
  onWanderToggle: (callback) => {
    ipcRenderer.on('wander:toggle', (_e, enabled) => callback(enabled));
    return () => ipcRenderer.removeListener('wander:toggle', callback);
  },
});
```

替换为：
```js
  // 随机走动开关
  onWanderToggle: (callback) => {
    ipcRenderer.on('wander:toggle', (_e, enabled) => callback(enabled));
    return () => ipcRenderer.removeListener('wander:toggle', callback);
  },

  // 通用悬浮面板
  showOverlay: (opts) => ipcRenderer.invoke('overlay:show', opts),
});
```

- [ ] **Step 2: 验证修改后的文件语法**

```bash
node -c "src/main/preload.js"
```

- [ ] **Step 3: 提交**

```bash
git add src/main/preload.js
git commit -m "feat: add showOverlay to electronAPI in preload.js"
```

---

### Task 6: 修改 index.js — 接线 overlay-manager

**Files:**
- Modify: `src/main/index.js`

**Interfaces:**
- Consumes: `initOverlayIPC(ipcMain)`, `showOverlayWindow(parentWindow, opts)`
- Produces: `overlay:show` IPC handler

在主进程中引入 overlay-manager，注册 IPC handler。

- [ ] **Step 1: 在文件顶部添加 require**

在 `src/main/index.js` 第 4 行（`const { registerPetIPC } = require('./ipc/pet-ipc');` 之后）插入：

```js
const { initOverlayIPC, showOverlayWindow } = require('./overlay-manager');
```

- [ ] **Step 2: 在 setupIPC() 中添加 overlay 接线**

在 `setupIPC()` 函数体内（`registerPetIPC(ipcMain);` 之后）插入：

```js
  // Overlay 悬浮面板
  initOverlayIPC(ipcMain);
  ipcMain.handle('overlay:show', async (_, opts) => {
    return await showOverlayWindow(mainWindow, opts);
  });
```

- [ ] **Step 3: 验证修改后的文件语法**

```bash
node -c "src/main/index.js"
```

- [ ] **Step 4: 提交**

```bash
git add src/main/index.js
git commit -m "feat: wire overlay-manager IPC handlers in main process"
```

---

### Task 7: 文档整理 + 进度更新

**Files:**
- Move: `docs/superpowers/specs/2026-07-12-overlay-design.md` → `docs/overlay-design.md`
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

迁移设计文档到项目文档目录，更新进度和会话日志。

- [ ] **Step 1: 移动设计文档**

```bash
mv "docs/superpowers/specs/2026-07-12-overlay-design.md" "docs/overlay-design.md"
```

- [ ] **Step 2: 更新 docs/progress.md**

在"基础设施"表格添加 overlay 条目，在"待实现"列表中移除 overlay 相关项，在末尾添加设计决策记录。

在 `docs/progress.md` 的"主进程"表格中，于 `ipc/storage-ipc.js` 行后添加：
```markdown
| overlay-manager.js — 通用悬浮面板 | ✅ | showOverlayWindow + initOverlayIPC + Promise Map；同一时间单例 |
```

在 `docs/progress.md` 的"渲染进程 — 共享层"表格后添加新的 section：
```markdown
### 渲染进程 — Overlay (src/renderer/overlay/)

| 任务 | 状态 | 备注 |
|------|------|------|
| overlay.html — 骨架 | ✅ | handle（drag）+ content（no-drag） |
| overlay.js — 逻辑 | ✅ | 配置注入 + 事件委托 data-overlay-result |
| overlay.css — 样式 | ✅ | 透明背景 + 毛玻璃 + 暗色主题 |
```

在末尾"设计决策记录"区域添加：
```markdown
---
## 设计决策记录 — Overlay 通用悬浮面板（infra-03, 2026-07-12）

- **架构**：独立 BrowserWindow（parent=宠物窗口），frameless transparent alwaysOnTop skipTaskbar
- **API**：`showOverlay({ html, width, height, x, y })` → Promise<result>
- **定位**：x/y 为相对父窗口左上角偏移量
- **拖拽**：CSS `-webkit-app-region: drag`（对齐 ADR-007）
- **关闭**：仅手动关闭（点 `[data-overlay-result]` 按钮）
- **单例**：同一时间只允许一个 overlay
- **IPC 通道**：`overlay:show` / `overlay:config:get` / `overlay:close`
- **详见**：`docs/overlay-design.md`
```

- [ ] **Step 3: 更新 docs/session-log.md**

在文件末尾添加：
```markdown
---

## infra-03 (2026-07-12)

| 项目 | 内容 |
|------|------|
| 任务 | 实现通用悬浮面板（overlay）基础设施 |
| 新建 | `src/main/overlay-manager.js`, `src/main/overlay-preload.js`, `src/renderer/overlay/overlay.html`, `src/renderer/overlay/overlay.js`, `src/renderer/overlay/overlay.css` |
| 修改 | `src/main/preload.js`（加 showOverlay）, `src/main/index.js`（接线 overlay-manager） |
| 越界授权 | 无（基础设施任务，有权改 main 和 shared） |
| 备注 | 设计文档：docs/overlay-design.md |
```

- [ ] **Step 4: 提交**

```bash
git add docs/overlay-design.md docs/superpowers/specs/2026-07-12-overlay-design.md docs/progress.md docs/session-log.md
git commit -m "docs: add overlay design doc and update progress/session-log"
```

---

## 自检清单

实施完成后逐项确认：

1. `npm start` 启动不报错
2. 控制台无 overlay 相关错误
3. 右键菜单"喂食"能弹出 overlay 面板（后续 pet.js 接入时验证）
4. overlay 窗口能通过 handle 拖拽移动
5. 点击 overlay 内按钮后面板关闭
6. 同一时间只有一个 overlay（快速双击不堆叠）
