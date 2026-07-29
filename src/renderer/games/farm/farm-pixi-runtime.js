const PIXI_ESM_URL = new URL('../../../../node_modules/pixi.js/dist/pixi.mjs', import.meta.url)

export function loadPixiRuntime() {
  return import(PIXI_ESM_URL.href)
}
