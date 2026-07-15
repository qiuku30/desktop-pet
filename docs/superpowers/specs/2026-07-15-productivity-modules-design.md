# 番茄钟 & 活动监视模块设计

> 2026-07-15 ARCH-05 讨论产出
> 状态：设计确认，待 Phase 2/3 实现

---

## 一、概述

两个独立但可联动的新模块：

1. **番茄钟**：25min 专注 + 5min 休息，通知 + 宠物互动 + 统计
2. **活动监视**：检测前台窗口标题，触发宠物对话 + 使用统计

两者联动：番茄专注期检测到非工作应用 → 宠物提醒。

---

## 二、番茄钟

### 2.1 功能

| 功能 | 说明 |
|------|------|
| 计时周期 | 25 分钟专注 + 5 分钟休息（可配置） |
| 倒计时 UI | 面板内一个卡片，进度环 + 剩余时间 + 今日番茄数 |
| 控制按钮 | 开始、暂停、重置、跳过 |
| 系统通知 | 专注结束 / 休息结束 → Notification API |
| 宠物气泡 | 开始："开始干活！💪"；结束："休息一下吧～" |
| 宠物动画 | 专注时打坐/idle，休息时活跃动画 |
| 后台运行 | 主进程常驻，切换面板/最小化不断计时 |
| 白名单 | 配置哪些应用不算中断（VS Code、Terminal 等） |

### 2.2 数据结构

```js
// settings 新增
settings: {
  showTooltip: true,
  alwaysOnTop: false,
  pomodoroFocusMin: 25,      // 专注时长（分钟）
  pomodoroBreakMin: 5,       // 休息时长（分钟）
  pomodoroLongBreakMin: 15,  // 长休息（每 4 轮后）
  pomodoroWhitelist: [],      // 白名单应用关键词
}

// 番茄统计（主进程独立存储或 PetState 新增）
pomodoroStats: {
  todayCount: 0,
  todayDate: '2026-07-15',
  totalCount: 0,
  streakDays: 0,              // 连续天数
  lastCompletedAt: null,
}
```

### 2.3 技术方案

| 层级 | 方案 |
|------|------|
| 计时 | 主进程 `setInterval`，每秒更新（不丢精度） |
| 通知 | `new Notification({ title, body })` — Electron 原生 |
| 状态推送 | IPC `pomodoro:tick` 每秒推送剩余秒数到渲染进程 |
| 持久化 | `pomodoroStats` 在 store.js 独立 key，和宠物状态隔离 |
| UI 通信 | 面板加载后注册 `pomodoro:tick` 监听，退出注销 |

### 2.4 架构原则对齐

- **原则 1（低耦合）**：番茄钟通过 EventBus/IPC 与宠物模块通信，不直接调 pet.js
- **原则 5（配置驱动）**：时长、轮数、白名单全部在 settings 中可配
- **原则 7（可插拔）**：番茄钟是可选模块，不装不影响核心宠物功能
- **原则 9（容错降级）**：计时器异常不影响宠物窗口

### 2.5 实现估算

| 部分 | 难度 | 预估 |
|------|------|------|
| 主进程计时 + IPC | 🟢 | 1 天 |
| 面板 UI（卡片 + 进度环） | 🟢 | 0.5 天 |
| 通知 + 气泡 | 🟢 | 0.5 天 |
| 统计 + 持久化 | 🟢 | 0.5 天 |
| 设置页扩展 | 🟢 | 0.5 天 |
| **合计** | | **~3 天** |

---

## 三、活动监视

### 3.1 功能

| 功能 | 说明 |
|------|------|
| 前台窗口检测 | 每 5 秒查一次活动窗口标题 |
| 使用统计 | 记录各应用使用时长分布 |
| 触发对话 | 关键词匹配 → 宠物弹对应气泡 |
| 番茄联动 | 专注期检测到非白名单应用 → 提醒 |
| 统计面板 | 面板内展示今日"看了多久XX" |

### 3.2 隐私红线 🚨

| 红线 | 实施 |
|------|------|
| **默认关闭** | 设置页独立开关，首次使用弹确认 |
| **不上传** | 数据只存本地 JSON，不走任何网络 |
| **不存原文** | 只在内存做关键词匹配，不写入磁盘 |
| **可清除** | 设置页一键清除统计数据 |

### 3.3 技术实现

#### 获取活动窗口标题

Windows 上用 PowerShell 一行搞定，无第三方依赖：

```js
// main/index.js
const { execFile } = require('child_process')

function getActiveWindowTitle() {
  return new Promise((resolve) => {
    const ps = `Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinAPI {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$hwnd = [WinAPI]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder(256)
[WinAPI]::GetWindowText($hwnd, $sb, 256)
$sb.ToString()`
    
    execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve(null)
      resolve(stdout.trim() || null)
    })
  })
}
```

或更简单的方式：`child_process.exec('powershell -command "(Get-Process | Where-Object {$_.MainWindowTitle -ne ''}).MainWindowTitle"', ...)` 但效率不如 Win32 API。

**推荐方案**：使用 `node-ffi` 或直接 powershell，每 5 秒轮询一次。

#### 关键词匹配表

```js
// shared/activity-keywords.js（原则 5 配置驱动）
export const ACTIVITY_KEYWORDS = [
  { match: ['bilibili', 'B站', 'b站'],           dialog: '又在刷B站啊…注意护眼 👀' },
  { match: ['VS Code', 'WebStorm', 'vim'],        dialog: '写代码辛苦了，记得喝水 💧' },
  { match: ['微信', 'WeChat'],                     dialog: '跟谁聊得这么开心？' },
  { match: ['网易云', 'QQ音乐', 'Spotify'],        dialog: '这首歌好听！' },
  { match: ['Word', 'Excel', 'WPS'],               dialog: '在写文档呢，加油 ✍️' },
  { match: ['Steam', '原神', '英雄联盟'],          dialog: '游戏玩久了要休息哦 🎮' },
]
```

#### 使用统计

```js
// 当天统计（内存 + localStorage 备份，不写盘）
activityStats: {
  date: '2026-07-15',
  apps: {
    'VS Code': { totalMs: 7200000, lastSeen: '...' },
    'Google Chrome': { totalMs: 3600000, lastSeen: '...' },
  }
}
```

主进程每 5 秒累加 `pollingInterval` 到当前前台应用。过日自动重置。

### 3.4 架构原则对齐

- **原则 1（低耦合）**：主进程只管采集，通过事件总线推送给宠物/面板
- **原则 8（性能隔离）**：5 秒轮询一次 powershell，开销可忽略
- **原则 9（容错降级）**：powershell 调用失败静默跳过，不影响宠物

### 3.5 实现估算

| 部分 | 难度 | 预估 |
|------|------|------|
| 主进程窗口标题采集 | 🟡 | 1 天 |
| 关键词匹配 + 对话触发 | 🟢 | 0.5 天 |
| 使用统计累加 | 🟢 | 0.5 天 |
| 面板统计 UI | 🟡 | 1 天 |
| 设置页开关 + 隐私弹窗 | 🟢 | 0.5 天 |
| 番茄钟联动 | 🟢 | 0.5 天 |
| **合计** | | **~4 天** |

---

## 四、番茄 + 监视联动

| 场景 | 行为 |
|------|------|
| 专注中检测到非白名单应用 | 宠物气泡："专注时间！别看 {应用名} 了！" |
| 专注中在白名单应用（VS Code）| 正常计时，不打扰 |
| 专注结束 | 系统通知 + 气泡 "休息一下吧，今天已经完成了 N 个番茄 🍅" |
| 休息结束 | 气泡 "继续加油！下一个番茄！" |

---

## 五、实现优先级

| 顺序 | 模块 | 理由 |
|------|------|------|
| 🥇 | 番茄钟 | 低难度、独立模块、高实用价值 |
| 🥈 | 活动监视 | 隐私敏感，需要仔细敲细节，番茄做完了再说 |
| 🥉 | 联动 | 两个都做完后，联动只是几行事件监听 |

---

## 六、相关文件

| 文件 | 改动 |
|------|------|
| `src/main/pomodoro.js` | **新建**，主进程计时 + IPC 推送 |
| `src/main/activity-monitor.js` | **新建**，窗口标题采集 + 统计 |
| `src/renderer/dashboard/pomodoro-card.js` | **新建**，面板番茄钟卡片 |
| `src/renderer/shared/activity-keywords.js` | **新建**，关键词配置表 |
| `src/renderer/dashboard/settings-config.js` | 扩展：番茄时长 + 白名单 + 活动监视开关 |
| `src/main/storage/store.js` | DEFAULT_STATE 加 pomodoroStats + activityStats |
| `src/main/index.js` | 初始化番茄计时器 + 活动监视 |
| `src/main/preload.js` | 暴露番茄/活动监视 IPC |
| `src/renderer/shared/events.js` | 新增事件常量 |
| `src/renderer/pet/pet.js` | 监听番茄/活动事件 → 气泡 + 动画 |
