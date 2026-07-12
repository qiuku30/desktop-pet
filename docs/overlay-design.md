# Overlay 通用悬浮面板 — 设计文档

> 日期：2026-07-12 | 窗口：infra-03 | 状态：设计确认

---

## 动机

宠物窗口只有 150×150（动态缩放），喂食 flyout、气泡历史等富内容面板装不下。
需要独立 overlay 窗口，不受宠物窗口尺寸限制，可复用。

## 架构

```
调用方（pet.js, dashboard.js 等）
  → showOverlay({ html, width, height, x, y })
  → IPC: overlay:show
  → overlay-manager 创建子 BrowserWindow（parent=宠物窗口）
  → 加载 overlay.html + overlay-preload.js
  → overlay.js 注入内容 + 绑定事件
  → 用户点按钮（data-overlay-result）→ overlayAPI.close(value)
  → Promise resolve(value)，窗口销毁
```

## 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 父子关系 | `parent: mainWindow` | overlay 跟随宠物层级，不脱离宠物单独悬浮 |
| 定位 | 相对父窗口偏移（x, y offset） | 调用方不关心宠物屏幕位置，语义清晰 |
| 拖拽 | CSS `-webkit-app-region: drag` | OS 原生拖拽零延迟，对齐 ADR-007 |
| 关闭 | 仅手动关闭（点按钮） | 简单可靠，后续可按需加速关 |
| 窗口样式 | frameless, transparent, alwaysOnTop, skipTaskbar | 保持与宠物窗口一致的悬浮体验 |

## 文件清单

### 新建

| 文件 | 职责 |
|------|------|
| `src/main/overlay-manager.js` | 导出 `initOverlayIPC(ipcMain)` 和 `showOverlayWindow(parentWindow, opts)`；维护 Promise Map |
| `src/main/overlay-preload.js` | contextBridge 暴露 `overlayAPI.getConfig()` 和 `overlayAPI.close(result)` |
| `src/renderer/overlay/overlay.html` | 骨架：`#overlay-handle`（拖拽把手）+ `#overlay-content`（内容注入区） |
| `src/renderer/overlay/overlay.js` | 初始化：获取配置 → 注入内容 → 事件委托（data-overlay-result） |
| `src/renderer/overlay/overlay.css` | 样式：透明背景、handle drag、content no-drag |

### 修改

| 文件 | 改动 |
|------|------|
| `src/main/preload.js` | electronAPI 加 `showOverlay: (opts) => ipcRenderer.invoke('overlay:show', opts)` |
| `src/main/index.js` | require overlay-manager，setupIPC() 中 initOverlayIPC + overlay:show handler |

## IPC 通道

| 通道 | 方向 | 参数 | 返回值 |
|------|------|------|--------|
| `overlay:show` | renderer → main | `{ html, width, height, x, y }` | overlay 关闭时 resolve 的值 |
| `overlay:config:get` | overlay → main | 无（按 sender.id 取） | opts 配置对象 |
| `overlay:close` | overlay → main | result（任意值） | void |

## 交互约定

overlay 内容里的按钮用 `data-overlay-result` 属性：

```html
<button data-overlay-result='"apple"'>🍎 苹果</button>
<button data-overlay-result='"cake"'>🍰 蛋糕</button>
<button data-overlay-result='null'>关闭</button>
```

overlay.js 使用事件委托：
```js
document.querySelector('#overlay-content').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-overlay-result]')
  if (btn) {
    const value = JSON.parse(btn.dataset.overlayResult)
    window.overlayAPI.close(value)
  }
})
```

## overlay-manager 内部设计

```js
const pendingOverlays = new Map() // window.id → { resolve, reject }

function showOverlayWindow(parentWindow, opts) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      parent: parentWindow,
      width: opts.width || 300,
      height: opts.height || 200,
      x: parentWindow.getPosition()[0] + (opts.x || 0),  // 相对父窗口偏移
      y: parentWindow.getPosition()[1] + (opts.y || 0),
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'overlay-preload.js'),
      },
    })

    pendingOverlays.set(win.id, { resolve, reject, opts })
    win.loadFile(path.join(__dirname, '../renderer/overlay/overlay.html'))

    win.on('closed', () => {
      // 窗口被外部关闭（如父窗口关闭），resolve null
      const entry = pendingOverlays.get(win.id)
      if (entry) {
        entry.resolve(null)
        pendingOverlays.delete(win.id)
      }
    })
  })
}
```

## 调用示例

```js
// pet.js 中弹出喂食面板
const food = await window.electronAPI.showOverlay({
  html: `
    <div class="feed-title">选择食物</div>
    <button data-overlay-result='"apple"'>🍎 苹果</button>
    <button data-overlay-result='"cake"'>🍰 蛋糕</button>
  `,
  width: 200,
  height: 150,
  x: 160,   // 宠物窗口右侧
  y: 0,
})

if (food) {
  // 喂食逻辑
}
```

## 注意事项

- overlay 窗口关闭时清理 Map，防止内存泄漏
- 同一时间只允许一个 overlay（`pendingOverlays.size > 0` 时拒绝新的 showOverlay 调用）
- 拖拽：handle 区 `-webkit-app-region: drag`，content 区 `-webkit-app-region: no-drag`
- 销毁 overlay 窗口时 `pendingOverlays.delete(win.id)`
