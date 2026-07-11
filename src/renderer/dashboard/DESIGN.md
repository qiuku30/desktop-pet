# 面板模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#dashboard` — 面板根容器
- `#nav-bar` — 导航栏（由 module-registry.js 驱动渲染）
- `#content-area` — 内容区（动态加载模块页面）

## 状态切换

- 宠物态 ↔ 面板态：窗口 resize + 内容切换
- 面板内导航切换：替换 `#content-area` 内容

## 模块加载

- 读取 `module-registry.js` 的 MODULES 数组
- 渲染导航按钮
- 点击导航按钮时动态加载对应模块
