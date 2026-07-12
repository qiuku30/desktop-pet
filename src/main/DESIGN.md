# 主进程技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 窗口管理

- 单 BrowserWindow
- 宠物态：transparent + frame:false + alwaysOnTop
- 面板态：正常窗口
- 两种状态通过 resize + 内容切换实现

## IPC 通道

### 窗口控制
- `window:toggle` — 宠物态↔面板态切换
- `window:mode` — 获取当前模式（pet/dashboard）
- `window:move` — 移窗到屏幕绝对坐标（fire-and-forget，不 clamp）
- `window:position:get` — 获取窗口左上角坐标

### 光标
- `cursor:pos:get` — 拉取当前全局光标位置（设备像素）

### 宠物状态（委托给 pet-ipc.js）
- `pet:state:get` — 获取完整宠物状态
- `pet:state:set` — 完整快照整体覆盖写盘 + 空快照保护

### 菜单推送（主→渲染）
- `menu:feed` — 右键"喂食"通知
- `menu:status` — 右键"状态"通知

### 拖拽推送（主→渲染）
- `user:drag` — 用户正通过 OS 原生拖拽移动窗口，渲染端暂停自动化

## 数据存储

- 位置：`app.getPath('userData')/pet-data.json`
- 格式：见 store.js
