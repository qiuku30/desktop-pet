# 主进程技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 窗口管理

- 单 BrowserWindow
- 宠物态：transparent + frame:false + alwaysOnTop
- 面板态：正常窗口
- 两种状态通过 resize + 内容切换实现

## IPC 通道

- `pet:state:get` — 获取宠物状态
- `pet:state:set` — 更新宠物状态
- `storage:read` — 读取 JSON 文件
- `storage:write` — 写入 JSON 文件

## 数据存储

- 位置：`app.getPath('userData')/pet-data.json`
- 格式：见 store.js
