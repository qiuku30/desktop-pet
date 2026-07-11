// 宠物移动的纯几何计算。无 DOM、无 IPC —— 可用 node --test 直接单测。
// 坐标皆为 {x,y}（屏幕绝对像素）；winSize 为 {w,h}。

// 两点欧氏距离。
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// 光标是否落在宠物中心 threshold 像素内。
export function isCursorNear(petCenter, cursor, threshold) {
  return distance(petCenter, cursor) < threshold
}

// 沿「光标 → 宠物中心」反方向弹开 push 像素后的新中心。
// 光标与中心重合（方向未定义）时，默认朝正上方弹。
export function fleeCenter(petCenter, cursor, push) {
  let dx = petCenter.x - cursor.x
  let dy = petCenter.y - cursor.y
  const len = Math.hypot(dx, dy)
  if (len === 0) {
    dx = 0
    dy = -1
  } else {
    dx /= len
    dy /= len
  }
  return { x: petCenter.x + dx * push, y: petCenter.y + dy * push }
}

// 在当前中心 radius 内随机挑一个目标中心。
// rand: () => [0,1)，注入以便测试确定性。
export function wanderTarget(center, radius, rand) {
  const angle = rand() * Math.PI * 2
  const r = rand() * radius
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r,
  }
}

// 中心 → 窗口左上角（四舍五入到整数像素）。
export function centerToTopLeft(center, winSize) {
  return {
    x: Math.round(center.x - winSize.w / 2),
    y: Math.round(center.y - winSize.h / 2),
  }
}

// 窗口左上角 → 中心。
export function topLeftToCenter(pos, winSize) {
  return { x: pos.x + winSize.w / 2, y: pos.y + winSize.h / 2 }
}
