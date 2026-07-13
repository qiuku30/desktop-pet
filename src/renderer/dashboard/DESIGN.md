# 面板模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#dashboard` — 面板根容器
- `#top-bar` — 顶部栏（标题拖拽区 + 关闭按钮）
- `#nav-bar` — 导航栏（占位，待 module-registry.js 驱动渲染）
- `#content-area` — 内容区（当前由 dashboard.js buildStatusDOM() 内联渲染）

## 状态切换

- 宠物态 ↔ 面板态：loadFile 切换 HTML + 窗口 resize
- 面板内导航切换（待实现）：替换 `#content-area` 内容

## 模块加载（待实现）

- 读取 `module-registry.js` 的 MODULES 数组
- 渲染导航按钮
- 点击导航按钮时动态加载对应模块
