// IPC 处理器 — 宠物相关
// 处理渲染进程的宠物状态读写请求。
//
// 跨进程契约（对齐 pet-state.js 的 _save()）：
//   渲染端 PetState._save() 通过 electronAPI.setPetState({ ...this._data }) 发来的
//   是**完整状态快照**（非增量 diff）。本模块直接把整份快照交给 store.setState()
//   整体覆盖写盘，不做 merge。
//
// 空快照保护：
//   若渲染端 init() 失败（electronAPI 不可用等），内存可能退化为 {}。此时 _save()
//   会发来空对象，若直接整体覆盖会清空磁盘存档。故对空/非法快照拒绝写盘，返回当前
//   存档，避免数据丢失。
//
// 接线：由 index.js 的 setupIPC() 调用一次 registerPetIPC(ipcMain)。

const { getState } = require('../storage/store');

// ── 快照校验 ──
// 合法快照：非 null 的普通对象，且至少有一个 key。
// 数组、null、基础类型、空对象 {} 一律视为非法（触发空快照保护）。
function isValidSnapshot(snapshot) {
  return (
    snapshot !== null &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot) &&
    Object.keys(snapshot).length > 0
  );
}

// ── 注册宠物 IPC 通道 ──
// 由主进程 index.js 在 setupIPC() 中调用一次。
// 先 removeHandler 再 handle，使注册幂等、可安全重入。
//
// 注意：pet:state:set 不在本模块注册，由 index.js 直接处理（需要 zoomLevel 保护）。
function registerPetIPC(ipcMain) {
  // 读取完整宠物状态。渲染端 PetState.init() 依赖此返回值灌入内存。
  ipcMain.removeHandler('pet:state:get');
  ipcMain.handle('pet:state:get', async () => {
    return await getState();
  });
}

module.exports = { registerPetIPC, isValidSnapshot };
