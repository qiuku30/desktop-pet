// FSRS word-service 测试
// 运行：node --test src/renderer/shared/word-service.test.mjs

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initFSRS,
  getParams,
  scheduleReview,
  initLearnedWord,
  getDueWords,
  getNextNewWords,
  getStats,
} from './word-service.js';

// ── 辅助：固定时间戳 2026-08-06T12:00:00Z ──
const NOW = new Date('2026-08-06T12:00:00Z').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

// ── 1. initFSRS ──

describe('initFSRS', () => {
  it('should set default params', () => {
    initFSRS();
    const p = getParams();
    assert.equal(p.requestRetention, 0.9);
    assert.equal(p.maximumInterval, 365);
    assert.equal(p.w.length, 13);
    assert.equal(p.w[0], 1.0);
  });

  it('should merge custom params', () => {
    initFSRS({ requestRetention: 0.8, maximumInterval: 180 });
    const p = getParams();
    assert.equal(p.requestRetention, 0.8);
    assert.equal(p.maximumInterval, 180);
    // 未指定的保持默认
    assert.equal(p.w.length, 13);
    assert.equal(p.w[0], 1.0);
  });

  it('should deep copy w array to prevent mutation', () => {
    initFSRS();
    const p1 = getParams();
    p1.w[0] = 999;
    const p2 = getParams();
    assert.equal(p2.w[0], 1.0); // unchanged
  });

  it('should accept custom w array', () => {
    const customW = [0.5, 0.5, 3.0, -0.3, -0.3, 0.1, 1.0, -0.1, 0.5, 1.0, -0.1, 0.1, 0.5];
    initFSRS({ w: customW });
    const p = getParams();
    assert.deepEqual(p.w, customW);
  });

  it('reset to defaults when called with no args', () => {
    initFSRS({ requestRetention: 0.5 });
    initFSRS(); // reset
    assert.equal(getParams().requestRetention, 0.9);
  });
});

// ── 2. scheduleReview ──

describe('scheduleReview', () => {
  // 重置参数确保测试隔离
  beforeEach(() => initFSRS());

  describe('rating: good', () => {
    it('should increase reps and keep lapses unchanged', () => {
      const word = { stability: 2.0, difficulty: 0.3, state: 'review', reps: 3, lapses: 0, lastReview: new Date(NOW - 2 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'good', NOW);
      assert.equal(result.reps, 4);
      assert.equal(result.lapses, 0);
      assert.equal(result.state, 'review');
    });

    it('should produce valid stability and correct state transition for good rating', () => {
      const word = { stability: 1.0, difficulty: 0.1, state: 'review', reps: 2, lapses: 0,
        lastReview: new Date(NOW - 0.1 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'good', NOW);
      // 验证基本契约：状态正确、reps+1、due 在未来
      assert.ok(result.stability > 0, `Expected stability > 0, got ${result.stability}`);
      assert.equal(result.state, 'review');
      assert.equal(result.reps, 3);
      assert.ok(new Date(result.due).getTime() > NOW);
    });

    it('should produce larger due intervals for higher stability words', () => {
      const lowS = { stability: 0.5, difficulty: 0.1, state: 'review', reps: 1, lapses: 0,
        lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const highS = { stability: 10.0, difficulty: 0.1, state: 'review', reps: 5, lapses: 0,
        lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };

      const resultLow = scheduleReview(lowS, 'good', NOW);
      const resultHigh = scheduleReview(highS, 'good', NOW);

      // 高稳定性的词下次复习间隔应该更长
      const dueLow = new Date(resultLow.due).getTime();
      const dueHigh = new Date(resultHigh.due).getTime();
      assert.ok(dueHigh > dueLow,
        `High stability due (${resultHigh.due}) should be after low stability due (${resultLow.due})`);
    });

    it('should set due date in the future', () => {
      const word = { stability: 1.0, difficulty: 0.3, state: 'review', reps: 1, lapses: 0, lastReview: new Date(NOW - DAY_MS).toISOString() };
      const result = scheduleReview(word, 'good', NOW);
      assert.ok(new Date(result.due).getTime() > NOW);
    });

    it('should set lastReview to now', () => {
      const word = { stability: 1.0, difficulty: 0.3, state: 'review', reps: 1, lapses: 0, lastReview: new Date(NOW - DAY_MS).toISOString() };
      const result = scheduleReview(word, 'good', NOW);
      assert.equal(new Date(result.lastReview).getTime(), NOW);
    });

    it('should decrease difficulty slightly for good rating', () => {
      const word = { stability: 1.0, difficulty: 0.5, state: 'review', reps: 1, lapses: 0, lastReview: new Date(NOW - DAY_MS).toISOString() };
      const result = scheduleReview(word, 'good', NOW);
      // difficulty: 0.5 - w[6]=0.2 = 0.3
      assert.ok(result.difficulty < 0.5, `Expected difficulty < 0.5, got ${result.difficulty}`);
    });

    it('should handle a word with no lastReview (first review)', () => {
      const word = { stability: 0.5, difficulty: 0.3, state: 'new', reps: 0, lapses: 0 };
      const result = scheduleReview(word, 'good', NOW);
      assert.equal(result.reps, 1);
      assert.equal(result.state, 'review');
      assert.ok(new Date(result.due).getTime() > NOW);
    });

    it('should cap stability at maximumInterval', () => {
      initFSRS({ maximumInterval: 5 });
      const word = { stability: 4.0, difficulty: 0.1, state: 'review', reps: 10, lapses: 0, lastReview: new Date(NOW - 4 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'good', NOW);
      assert.ok(result.stability <= 5, `Expected stability <= 5, got ${result.stability}`);
    });
  });

  describe('rating: again', () => {
    it('should reset reps to 0 and increment lapses', () => {
      const word = { stability: 3.0, difficulty: 0.3, state: 'review', reps: 5, lapses: 0, lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'again', NOW);
      assert.equal(result.reps, 0);
      assert.equal(result.lapses, 1);
      assert.equal(result.state, 'relearning');
    });

    it('should increase difficulty for again rating', () => {
      const word = { stability: 3.0, difficulty: 0.3, state: 'review', reps: 5, lapses: 0, lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'again', NOW);
      // difficulty: 0.3 + w[5]=0.2 = 0.5
      assert.ok(result.difficulty > 0.3, `Expected difficulty > 0.3, got ${result.difficulty}`);
    });

    it('should cap difficulty at max (w[12])', () => {
      initFSRS({ w: [1.0, 1.0, 5.0, -0.5, -0.5, 0.2, 1.4, -0.12, 0.8, 2.0, -0.2, 0.2, 0.5] }); // w[12]=0.5
      const word = { stability: 3.0, difficulty: 0.5, state: 'review', reps: 5, lapses: 0, lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'again', NOW);
      assert.equal(result.difficulty, 0.5); // already at max
    });

    it('should set due date to ~1 day from now', () => {
      const word = { stability: 3.0, difficulty: 0.3, state: 'review', reps: 5, lapses: 0, lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'again', NOW);
      const dueMs = new Date(result.due).getTime();
      const expectedMs = NOW + DAY_MS;
      // 允许少量精度误差
      assert.ok(Math.abs(dueMs - expectedMs) < 1000);
    });

    it('should use w[0] for new/learning state stability reset', () => {
      const word = { stability: 0.5, difficulty: 0.3, state: 'new', reps: 0, lapses: 0 };
      const result = scheduleReview(word, 'again', NOW);
      assert.equal(result.stability, 1.0); // w[0]
    });

    it('should use w[2] for review/relearning state stability reset', () => {
      const word = { stability: 3.0, difficulty: 0.3, state: 'review', reps: 5, lapses: 0, lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'again', NOW);
      assert.equal(result.stability, 5.0); // w[2]
    });
  });

  describe('unknown rating', () => {
    it('should treat any non-good rating as again', () => {
      const word = { stability: 3.0, difficulty: 0.3, state: 'review', reps: 5, lapses: 0, lastReview: new Date(NOW - 3 * DAY_MS).toISOString() };
      const result = scheduleReview(word, 'anything-else', NOW);
      assert.equal(result.state, 'relearning');
      assert.equal(result.reps, 0);
      assert.equal(result.lapses, 1);
    });
  });

  describe('field preservation', () => {
    it('should preserve isFavorited and sourceBank after good rating', () => {
      const word = {
        stability: 2.0, difficulty: 0.3, state: 'review', reps: 3, lapses: 0,
        lastReview: new Date(NOW - 2 * DAY_MS).toISOString(),
        isFavorited: true, sourceBank: 'cet4',
      };
      const result = scheduleReview(word, 'good', NOW);
      assert.equal(result.isFavorited, true);
      assert.equal(result.sourceBank, 'cet4');
    });

    it('should preserve isFavorited and sourceBank after again rating', () => {
      const word = {
        stability: 2.0, difficulty: 0.3, state: 'review', reps: 3, lapses: 0,
        lastReview: new Date(NOW - 2 * DAY_MS).toISOString(),
        isFavorited: false, sourceBank: 'ielts',
      };
      const result = scheduleReview(word, 'again', NOW);
      assert.equal(result.isFavorited, false);
      assert.equal(result.sourceBank, 'ielts');
    });

    it('should not mutate the original word object', () => {
      const word = {
        stability: 2.0, difficulty: 0.3, state: 'review', reps: 3, lapses: 0,
        lastReview: new Date(NOW - 2 * DAY_MS).toISOString(),
        isFavorited: true, sourceBank: 'cet4',
      };
      const originalReps = word.reps;
      const originalState = word.state;
      scheduleReview(word, 'good', NOW);
      assert.equal(word.reps, originalReps, 'reps should not change on original');
      assert.equal(word.state, originalState, 'state should not change on original');
      assert.equal(word.isFavorited, true, 'isFavorited should not change on original');
    });

    it('should preserve unknown/extra fields (forward compat)', () => {
      const word = {
        stability: 1.0, difficulty: 0.2, state: 'review', reps: 1, lapses: 0,
        lastReview: new Date(NOW - DAY_MS).toISOString(),
        customField: 'should survive', anotherOne: 42,
      };
      const result = scheduleReview(word, 'good', NOW);
      assert.equal(result.customField, 'should survive');
      assert.equal(result.anotherOne, 42);
    });
  });
});

// ── 3. initLearnedWord ──

describe('initLearnedWord', () => {
  beforeEach(() => initFSRS());

  it('should create initial FSRS state for a newly learned word', () => {
    const state = initLearnedWord('hello', 'cet4', NOW);
    assert.equal(state.stability, 0.001);
    assert.equal(state.difficulty, getParams().w[4]);
    assert.equal(state.state, 'review');
    assert.equal(state.reps, 1);
    assert.equal(state.lapses, 0);
    assert.equal(state.isFavorited, false);
    assert.equal(state.sourceBank, 'cet4');
    assert.ok(new Date(state.due).getTime() > NOW);
  });
});

// ── 4. getDueWords ──

describe('getDueWords', () => {
  it('should return only words with due <= now', () => {
    const words = {
      overdue: { due: new Date(NOW - DAY_MS).toISOString(), stability: 1.0, state: 'review' },
      future:  { due: new Date(NOW + DAY_MS).toISOString(), stability: 3.0, state: 'review' },
      now:     { due: new Date(NOW).toISOString(), stability: 0.5, state: 'review' },
    };
    const result = getDueWords(words, NOW);
    assert.equal(result.length, 2);
    const wordNames = result.map(r => r.word);
    assert.deepEqual(wordNames.sort(), ['now', 'overdue']);
  });

  it('should return empty array when no words are due', () => {
    const words = {
      future1: { due: new Date(NOW + DAY_MS).toISOString(), stability: 1.0, state: 'review' },
      future2: { due: new Date(NOW + 5 * DAY_MS).toISOString(), stability: 5.0, state: 'review' },
    };
    assert.deepEqual(getDueWords(words, NOW), []);
  });

  it('should return empty array for empty words object', () => {
    assert.deepEqual(getDueWords({}, NOW), []);
  });

  it('should skip words without due field', () => {
    const words = {
      noDue: { stability: 1.0, state: 'review' },
      withDue: { due: new Date(NOW - DAY_MS).toISOString(), stability: 1.0, state: 'review' },
    };
    const result = getDueWords(words, NOW);
    assert.equal(result.length, 1);
    assert.equal(result[0].word, 'withDue');
  });

  it('should sort by stability ascending', () => {
    const words = {
      a: { due: new Date(NOW - DAY_MS).toISOString(), stability: 5.0, state: 'review' },
      b: { due: new Date(NOW - DAY_MS).toISOString(), stability: 1.0, state: 'review' },
      c: { due: new Date(NOW - DAY_MS).toISOString(), stability: 3.0, state: 'review' },
    };
    const result = getDueWords(words, NOW);
    assert.equal(result[0].word, 'b'); // stability 1.0
    assert.equal(result[1].word, 'c'); // stability 3.0
    assert.equal(result[2].word, 'a'); // stability 5.0
  });

  it('should default to Date.now() when no now parameter', () => {
    const words = {
      old: { due: '2020-01-01T00:00:00.000Z', stability: 1.0, state: 'review' },
    };
    const result = getDueWords(words);
    assert.equal(result.length, 1); // definitely due
  });
});

// ── 5. getNextNewWords ──

describe('getNextNewWords', () => {
  const bankWords = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape'];

  it('should return count new words not in alreadyLearned', () => {
    const learned = new Set(['apple', 'banana']);
    const result = getNextNewWords(bankWords, 3, learned);
    assert.equal(result.length, 3);
    assert.ok(!result.includes('apple'));
    assert.ok(!result.includes('banana'));
    // all results should be in bank
    for (const w of result) {
      assert.ok(bankWords.includes(w));
    }
  });

  it('should return all available candidates when count > available', () => {
    const learned = new Set(['apple', 'banana', 'cherry', 'date', 'elderberry']);
    const result = getNextNewWords(bankWords, 10, learned);
    assert.equal(result.length, 2); // only fig and grape left
  });

  it('should return empty array when all words are learned', () => {
    const learned = new Set(bankWords);
    const result = getNextNewWords(bankWords, 5, learned);
    assert.deepEqual(result, []);
  });

  it('should accept array as alreadyLearned', () => {
    const result = getNextNewWords(bankWords, 2, ['apple', 'banana', 'cherry', 'date']);
    assert.equal(result.length, 2);
    assert.ok(!result.includes('apple'));
  });

  it('should return empty array for empty bank', () => {
    assert.deepEqual(getNextNewWords([], 5, new Set()), []);
  });

  it('should handle count=0', () => {
    const result = getNextNewWords(bankWords, 0, new Set());
    assert.deepEqual(result, []);
  });

  it('should not duplicate returned words', () => {
    const learned = new Set(['date', 'elderberry']);
    // 多次调用验证去重（基于随机性，做有限断言）
    for (let i = 0; i < 5; i++) {
      const result = getNextNewWords(bankWords, 3, learned);
      const unique = new Set(result);
      assert.equal(unique.size, result.length, 'Results should not contain duplicates');
    }
  });
});

// ── 6. getStats ──

describe('getStats', () => {
  it('should return zero stats for empty wordProgress', () => {
    const stats = getStats({ words: {}, streak: { current: 0, lastStudyDate: null } }, NOW);
    assert.equal(stats.totalWords, 0);
    assert.equal(stats.learnedToday, 0);
    assert.equal(stats.dueCount, 0);
    assert.equal(stats.streak, 0);
    assert.equal(stats.totalReviews, 0);
    assert.equal(stats.accuracy, null);
  });

  it('should count total learned words (state !== new)', () => {
    const wp = {
      words: {
        a: { state: 'review', reps: 3, lapses: 0, stability: 2.0 },
        b: { state: 'relearning', reps: 1, lapses: 0, stability: 0.5 },
        c: { state: 'new' },
      },
      streak: { current: 0, lastStudyDate: null },
    };
    const stats = getStats(wp, NOW);
    assert.equal(stats.totalWords, 2); // a and b
  });

  it('should count learnedToday correctly', () => {
    const today = new Date(NOW).toISOString();
    const yesterday = new Date(NOW - DAY_MS).toISOString();
    const wp = {
      words: {
        a: { state: 'review', lastReview: today, reps: 3, lapses: 0, stability: 2.0 },
        b: { state: 'review', lastReview: yesterday, reps: 5, lapses: 0, stability: 5.0 },
        c: { state: 'review', lastReview: today, reps: 1, lapses: 0, stability: 0.5 },
      },
      streak: { current: 0, lastStudyDate: null },
    };
    const stats = getStats(wp, NOW);
    assert.equal(stats.learnedToday, 2); // a and c
  });

  it('should count due words', () => {
    const wp = {
      words: {
        overdue: { state: 'review', due: new Date(NOW - 2 * DAY_MS).toISOString(), reps: 3, lapses: 0 },
        future:  { state: 'review', due: new Date(NOW + 2 * DAY_MS).toISOString(), reps: 5, lapses: 0 },
        now:     { state: 'review', due: new Date(NOW).toISOString(), reps: 1, lapses: 0 },
      },
      streak: { current: 0, lastStudyDate: null },
    };
    const stats = getStats(wp, NOW);
    assert.equal(stats.dueCount, 2);
  });

  it('should sum total reviews (reps) across all words', () => {
    const wp = {
      words: {
        a: { state: 'review', reps: 3, lapses: 0 },
        b: { state: 'review', reps: 5, lapses: 0 },
        c: { state: 'new', reps: 0, lapses: 0 },
      },
      streak: { current: 0, lastStudyDate: null },
    };
    const stats = getStats(wp, NOW);
    assert.equal(stats.totalReviews, 8);
  });

  it('should calculate accuracy correctly', () => {
    const wp = {
      words: {
        a: { state: 'review', reps: 8, lapses: 2 },   // 8/10 = 0.8
        b: { state: 'review', reps: 5, lapses: 0 },   // 5/5 = 1.0
        c: { state: 'new', reps: 0, lapses: 0 },      // no reviews yet
      },
      streak: { current: 0, lastStudyDate: null },
    };
    const stats = getStats(wp, NOW);
    // total: (8+5) / (8+2+5+0) = 13/15 = 0.87
    assert.equal(stats.accuracy, 0.87);
  });

  it('should handle all-zero reviews (accuracy = null)', () => {
    const wp = {
      words: {
        a: { state: 'new', reps: 0, lapses: 0 },
        b: { state: 'new', reps: 0, lapses: 0 },
      },
      streak: { current: 0, lastStudyDate: null },
    };
    const stats = getStats(wp, NOW);
    assert.equal(stats.accuracy, null);
  });

  it('should pass through streak value', () => {
    const wp = {
      words: {},
      streak: { current: 7, lastStudyDate: '2026-08-05' },
    };
    const stats = getStats(wp, NOW);
    assert.equal(stats.streak, 7);
  });

  it('should handle missing words field gracefully', () => {
    const stats = getStats({}, NOW);
    assert.equal(stats.totalWords, 0);
    assert.equal(stats.dueCount, 0);
  });
});
