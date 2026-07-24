export function frameAtElapsed(elapsedMs, fps, frameCount, loop) {
  if (
    !Number.isFinite(elapsedMs)
    || elapsedMs < 0
    || !Number.isFinite(fps)
    || fps <= 0
    || !Number.isInteger(frameCount)
    || frameCount <= 0
  ) {
    return { index: 0, finished: true }
  }

  const frameDuration = 1000 / fps
  const rawIndex = Math.floor(elapsedMs / frameDuration)
  if (loop) {
    return { index: rawIndex % frameCount, finished: false }
  }
  return {
    index: Math.min(rawIndex, frameCount - 1),
    finished: rawIndex >= frameCount,
  }
}

export function canvasBackingSize(cssWidth, cssHeight, dpr) {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  return {
    width: Math.max(1, Math.round(Math.max(0, cssWidth) * safeDpr)),
    height: Math.max(1, Math.round(Math.max(0, cssHeight) * safeDpr)),
  }
}

export function anchoredDrawRect(source, viewport, scale, anchor) {
  const fit = Math.min(
    viewport.width / source.width,
    viewport.height / source.height,
  ) * scale
  const width = source.width * fit
  const height = source.height * fit
  return {
    x: viewport.width * anchor.x - width * anchor.x,
    y: viewport.height * anchor.y - height * anchor.y,
    width,
    height,
  }
}
