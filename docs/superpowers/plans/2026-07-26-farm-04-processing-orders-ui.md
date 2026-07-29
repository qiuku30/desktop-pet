# Farm 04 Processing and Orders UI Implementation Plan

> **Status (2026-07-29):** Completed after settlement/mutation concurrency repairs; final implementation commit `64f049c`, 290/290 full-suite tests. The unchecked steps below are retained as the original execution script, not as current progress.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the farm page with processing and order tabs, persistent top summary, offline catch-up, cancellation, delivery and abandonment flows.

**Architecture:** Extend Farm 03’s mount with two focused subviews. All mutations remain Farm 02 service commands; low-frequency refresh settles timestamps and re-renders summaries.

**Tech Stack:** ES modules, DOM/CSS, Node `node:test`, existing overlay manager.

## Global Constraints

- Maximum queue capacity is three; only queued, not running, tasks may be cancelled.
- Orders are full-delivery only and have no expiry.
- Abandonment cooldown is 30 minutes.
- No duplicate sell/feed logic in farm UI.

---

### Task 1: Processing tab

**Files:**
- Create: `src/renderer/games/farm/farm-processing-ui.js`
- Create: `src/renderer/games/farm/farm-processing-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm.css`
- Modify: `src/renderer/games/farm/farm-ui.js`

**Interfaces:**
- Produces: `renderProcessingTab(container, viewModel, actions) -> cleanup`.
- Consumes: service `enqueue`, `cancelQueued`, `settle`.

- [ ] **Step 1: Write failing tests**

Cover recipe unlock visibility, inventory sufficiency, queue capacity, running timer, queued cancel refund confirmation, completed output automatic inventory display, and locked recipe messaging.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-processing-ui.test.mjs`

- [ ] **Step 3: Implement processing view**

Render configuration-driven recipe cards and a three-row queue. Use one 1-second display timer only while the processing tab is mounted; invoke service settlement at mount and when a displayed boundary reaches zero.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-processing-ui.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm
git commit -m "feat: add farm processing tab"
```

### Task 2: Order tab

**Files:**
- Create: `src/renderer/games/farm/farm-orders-ui.js`
- Create: `src/renderer/games/farm/farm-orders-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm.css`
- Modify: `src/renderer/games/farm/farm-ui.js`

**Interfaces:**
- Produces: `renderOrdersTab(container, viewModel, actions) -> cleanup`.
- Consumes: service `completeOrder`, `abandonOrder`, `settle`.

- [ ] **Step 1: Write failing tests**

Cover exactly three slots, missing/owned quantities, disabled incomplete delivery, single-click full delivery, visible rewards, abandoned cooldown countdown and regenerated order.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-orders-ui.test.mjs`

- [ ] **Step 3: Implement orders view**

Render each requirement as `owned / required`, reward coins/exp/seed, one delivery button and one ghost abandon action. Confirm abandonment in overlay; delivery needs no second confirmation.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-orders-ui.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm
git commit -m "feat: add farm orders tab"
```

### Task 3: Persistent summary and offline catch-up

**Files:**
- Modify: `src/renderer/games/farm/farm-ui.js`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm.css`

**Interfaces:**
- Summary: `{ matureCount, processingCount, nextProcessingAt, readyOrderCount, level, exp, requiredExp }`.

- [ ] **Step 1: Add failing summary tests**

Assert summary persists across all three tabs, updates after settlement, shows “可交付” only after inventory satisfies an order, and stops updating after cleanup.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 3: Implement one lifecycle-owned refresh loop**

Use a single low-frequency interval owned by `mountFarm`; child tabs must not create duplicate settlement loops. On cleanup, clear the interval and child cleanup.

- [ ] **Step 4: Verify full farm UI**

Run: `node --test src/renderer/games/farm/*.test.mjs`

Manual: enqueue three tasks, leave Farm, switch to pet and back, verify automatic catch-up and order readiness.

- [ ] **Step 5: Update docs and commit**

```bash
git add src/renderer/games/farm docs/progress.md docs/session-log.md
git commit -m "feat: complete farm processing and orders"
```
