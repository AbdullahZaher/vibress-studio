import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareEditorBenchmarks } from './compare-editor-benchmarks.mjs';

const report = () => ({ scenario: '5000-words', profile: 'desktop', fixtureVersion: 1, fixtureHash: 'fixture-a', browser: 'test-browser',
  platform: 'test-platform', cpu: 'test-cpu', viewport: { width: 1440, height: 900 }, cpuThrottle: 1, method: 'frame-proxy',
  mountMs: 100, typing: { samples: 20, p95Ms: 20 } });

test('compares mount and typing and fails a measured regression', () => {
  const candidate = report();
  candidate.typing.p95Ms = 30;
  const result = compareEditorBenchmarks([report()], [candidate], 1.2);
  assert.equal(result.status, 'regression');
  assert.equal(result.results.find(item => item.metric === 'typingP95Ms').ratio, 1.5);
  assert.equal(compareEditorBenchmarks([report()], [report()], 1.2).status, 'pass');
});

test('requires matching datasets, scenarios and environments', () => {
  for (const changed of [{ fixtureHash: 'changed' }, { cpu: 'different' }, { browser: 'new' }, { scenario: 'missing' }]) {
    assert.throws(() => compareEditorBenchmarks([report()], [{ ...report(), ...changed }], 1.2));
  }
  assert.throws(() => compareEditorBenchmarks([report()], [report(), report()], 1.2), /Duplicate/);
});

test('rejects missing samples, malformed metrics and implicit tolerances', () => {
  for (const candidate of [{ ...report(), mountMs: NaN }, { ...report(), typing: { samples: 5, p95Ms: 1 } }]) {
    assert.throws(() => compareEditorBenchmarks([report()], [candidate], 1.2));
  }
  assert.throws(() => compareEditorBenchmarks([], [], 1.2));
  assert.throws(() => compareEditorBenchmarks([report()], [report()], NaN));
});
