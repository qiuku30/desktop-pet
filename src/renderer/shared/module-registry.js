// 模块注册表
// 面板导航自动渲染的数据源
// 加新模块只需要在此数组中加一行

export const MODULES = [
  { id: 'farm', modulePath: '../games/farm/farm-module.js' },
  // 后续模块在此注册：
  // { id: 'word',    label: '背单词',   path: '../games/word/word.html' },
  // { id: 'game2048', label: '2048',    path: '../games/2048/game.html' },
]

export async function loadRegisteredModule(moduleId, moduleLoader = path => import(path)) {
  const registration = MODULES.find(module => module.id === moduleId)
  if (!registration) throw new Error(`Module is not registered: ${moduleId}`)
  const loaded = await moduleLoader(registration.modulePath)
  if (!loaded || typeof loaded.mount !== 'function') {
    throw new TypeError(`Registered module must export mount(): ${moduleId}`)
  }
  return loaded
}
