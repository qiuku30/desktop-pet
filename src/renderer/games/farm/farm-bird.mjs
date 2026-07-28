const FIRST_DELAY_MINUTES = Object.freeze({ min: 2, max: 5 })
const NEXT_DELAY_MINUTES = Object.freeze({ min: 5, max: 12 })
const VISIT_SECONDS = Object.freeze({ min: 8, max: 12 })
const DAILY_LIMIT = 10

function randomInteger(range, random) {
  const value = Number(random())
  const normalized = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 0.9999999999999999)
    : 0
  return range.min + Math.floor(normalized * (range.max - range.min + 1))
}

export function createBirdScheduler({
  now = () => new Date().toISOString(),
  random = Math.random,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onAppear = () => {},
  onLeave = () => {},
} = {}) {
  let destroyed = false
  let visible = true
  let started = false
  let sequence = 0
  let timerId = null
  let timerToken = 0
  let currentBird = null

  function cancelTimer() {
    timerToken += 1
    if (timerId !== null) clearTimer(timerId)
    timerId = null
  }

  function leaveCurrent() {
    if (!currentBird) return
    const bird = currentBird
    currentBird = null
    onLeave(bird)
  }

  function schedule({ dailyCount, subsequent }) {
    if (destroyed || !visible || timerId !== null || currentBird
        || dailyCount >= DAILY_LIMIT) return
    const range = subsequent ? NEXT_DELAY_MINUTES : FIRST_DELAY_MINUTES
    const delay = randomInteger(range, random) * 60_000
    const token = ++timerToken
    timerId = setTimer(() => {
      if (destroyed || !visible || token !== timerToken) return
      timerId = null
      currentBird = {
        birdId: `bird:${now()}:${++sequence}`,
      }
      onAppear(currentBird)
      const leaveToken = ++timerToken
      const visitMs = randomInteger(VISIT_SECONDS, random) * 1_000
      timerId = setTimer(() => {
        if (destroyed || !visible || leaveToken !== timerToken) return
        timerId = null
        leaveCurrent()
        schedule({ dailyCount, subsequent: true })
      }, visitMs)
    }, delay)
  }

  return {
    start({ dailyCount = 0 } = {}) {
      if (destroyed) return
      if (!started) started = true
      schedule({ dailyCount, subsequent: false })
    },

    setVisible(nextVisible, { dailyCount = 0 } = {}) {
      if (destroyed) return
      visible = Boolean(nextVisible)
      cancelTimer()
      leaveCurrent()
      if (visible) {
        started = true
        schedule({ dailyCount, subsequent: false })
      }
    },

    claimed({ birdId, dailyCount = 0 } = {}) {
      if (destroyed) return
      if (dailyCount >= DAILY_LIMIT) {
        cancelTimer()
        leaveCurrent()
        return
      }
      if (!currentBird || currentBird.birdId !== birdId) return
      cancelTimer()
      leaveCurrent()
      schedule({ dailyCount, subsequent: true })
    },

    destroy() {
      if (destroyed) return
      destroyed = true
      cancelTimer()
      leaveCurrent()
    },
  }
}
