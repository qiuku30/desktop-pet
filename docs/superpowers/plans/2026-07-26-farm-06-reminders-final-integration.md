# Farm 06 Reminders and Final Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add farm bird rewards and deduplicated desktop-pet summaries, then independently verify the complete farm module and all regressions.

**Architecture:** Bird scheduling belongs to the mounted farm UI; reward authority remains FarmService. Pet reminders derive a compact summary from persisted farm/inventory state and never alter the pet animation runtime’s established semantic queue.

**Tech Stack:** ES modules, DOM/CSS, PetState/EventBus, Node tests, Electron manual verification.

## Global Constraints

- Bird appears only while Farm is visible, never offline.
- First delay 2–5 minutes; subsequent delay 5–12 minutes; 8–12 second visit; 1–3 coins; 10 claims per local day.
- Farm reminders are weak and deduplicated.
- Click, feed, drag, sleep and transient animation semantics remain exactly as pet-fix-02/pet-12 specify.

---

### Task 1: Bird scheduler and UI

**Files:**
- Create: `src/renderer/games/farm/farm-bird.mjs`
- Create: `src/renderer/games/farm/farm-bird.test.mjs`
- Modify: `src/renderer/games/farm/farm-ui.js`
- Modify: `src/renderer/games/farm/farm.css`

**Interfaces:**
- Produces: `createBirdScheduler({ now, random, setTimer, clearTimer, onAppear, onLeave })`.
- UI invokes `service.claimBird()`; scheduler never grants coins itself.

- [ ] **Step 1: Write deterministic scheduler tests**

Use fake timers to assert first/subsequent delay ranges, visit duration, one bird maximum, cleanup cancellation, hidden-page cancellation, and no schedule after daily cap.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-bird.test.mjs`

- [ ] **Step 3: Implement scheduler and accessible bird button**

Render a native button with `aria-label="点击小鸟获得金币"`. On successful claim, disable immediately, call service once, show `+N 🪙`, then schedule the next visit.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-bird.test.mjs src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm
git commit -m "feat: add farm bird reward"
```

### Task 2: Shared pure farm reminder summary

**Files:**
- Create: `src/renderer/shared/farm-summary.js`
- Create: `src/renderer/shared/farm-summary.test.mjs`

**Interfaces:**
- Produces: `getFarmSummary(farm, inventory, now)`, `diffFarmReminder(previous, next)`.
- Reminder kinds: `mature`, `processing-complete`, `order-ready`; unchanged state returns `null`.

- [ ] **Step 1: Write failing summary tests**

Test mature count, all-processing-complete transition, order first becoming satisfiable, no duplicate transition, and malformed farm returning an empty safe summary.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/shared/farm-summary.test.mjs`

- [ ] **Step 3: Implement pure summary**

Do not import pet code. Return only serializable counts/timestamps and one reminder descriptor.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/shared/farm-summary.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/shared/farm-summary.js src/renderer/shared/farm-summary.test.mjs
git commit -m "feat: add farm reminder summary"
```

### Task 3: Desktop pet weak reminder

**Files:**
- Modify: `src/renderer/pet/pet.html`
- Modify: `src/renderer/pet/pet.js`
- Modify: `src/renderer/pet/pet.css`
- Create: `src/renderer/pet/pet-farm-reminder.mjs`
- Create: `src/renderer/pet/pet-farm-reminder.test.mjs`
- Modify: `src/renderer/pet/DESIGN.md`

**Interfaces:**
- Produces: `createPetFarmReminder({ getState, now, onSummary, onBubble }) -> { refresh, destroy }`.

- [ ] **Step 1: Write lifecycle and dedupe tests**

Test initial summary without bubble, one bubble on first transition, no duplicate bubble, mature count update, pagehide cleanup, and no callback after destroy.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/pet/pet-farm-reminder.test.mjs`

- [ ] **Step 3: Implement reminder adapter**

Add a compact `#farm-indicator`. Bubble text examples are fixed:

```js
{
  mature: '农场有作物成熟啦～ 🌾',
  'processing-complete': '加工台忙完啦～ ⚙️',
  'order-ready': '有订单可以交付啦～ 📋',
}
```

The adapter may call existing `showBubble` but must not call animation transient APIs, reset idle timers, or wake sleep.

- [ ] **Step 4: Run pet regression**

Run: `node --test src/renderer/pet/*.test.mjs src/renderer/pet/animation/*.test.mjs`

Manual: sleep pet, let farm reminder become due, verify bubble/indicator does not wake or reset the 10-minute idle timer.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pet
git commit -m "feat: add desktop farm reminders"
```

### Task 4: Full acceptance and architecture review

**Files:**
- Modify: `src/renderer/games/farm/DESIGN.md`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Modify: `src/renderer/pet/DESIGN.md`
- Modify: `PROJECT_BRIEF.md`
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

**Interfaces:**
- No new code interface; this task verifies the complete approved spec.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
node --test src/renderer/shared/*.test.mjs src/renderer/games/2048/*.test.mjs src/renderer/games/farm/*.test.mjs src/renderer/pet/*.test.mjs src/renderer/pet/animation/*.test.mjs
```

Expected: zero failures.

- [ ] **Step 2: Run compliance searches**

Run:

```bash
rg -n "foodInventory" src
rg -n "localStorage|writeFile|readFile" src/renderer/games/farm
rg -n "from ['\"].*(pet|dashboard)/" src/renderer/games/farm src/renderer/shared
git diff --check
```

Expected: `foodInventory` only in migration/tests/docs; no farm filesystem/localStorage; no cross-module import; no whitespace errors.

- [ ] **Step 3: Complete Electron manual matrix**

Verify normal and edge paths:

- first farm open and one-time starter seeds
- all six crop unlocks using test-state fixtures
- quick-buy, plant, mature, single harvest, harvest-all, removal
- every land/building level and overlap rule
- app exit/reopen offline settlement
- three processing jobs and queued cancellation
- raw and processed orders, abandonment cooldown
- warehouse categories, multi-sell and every feed entry
- bird cap/local-day reset
- pet weak reminder dedupe and sleep non-interference
- dashboard 800×600 and 600×400
- pet 75/100/125/150% zoom and dashboard round trips

- [ ] **Step 4: Independently review race/lifecycle/fallback**

Review repeated clicks, page teardown, late callbacks, save debounce/flush, migration idempotence, configuration failure isolation, notification dedupe and transaction atomicity. Fix every finding, then rerun Steps 1–3.

- [ ] **Step 5: Synchronize docs and commit**

Record exact test counts, manual results, files, cross-boundary authorization, known issues and commit/push state.

```bash
git add PROJECT_BRIEF.md docs src/renderer
git commit -m "docs: complete farm module verification"
```
