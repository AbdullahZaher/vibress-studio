#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const environmentFields = ['fixtureVersion', 'fixtureHash', 'profile', 'browser', 'platform', 'cpu', 'viewport', 'cpuThrottle', 'method'];
const metrics = { mountMs: report => report.mountMs, typingP95Ms: report => report.typing.p95Ms };
const key = report => `${report.profile}/${report.scenario}`;

/** Comparison deliberately requires an explicit, reviewed tolerance and the same
 * fixture/environment. These frame proxies do not establish INP acceptance. */
export function compareEditorBenchmarks(baseline, candidate, maxRatio) {
  if (!Number.isFinite(maxRatio) || maxRatio < 1) throw new Error('An explicit --max-ratio >= 1 is required.');
  if (!baseline.length || !candidate.length) throw new Error('Both report sets must contain benchmark results.');
  const index = reports => {
    const result = new Map();
    for (const report of reports) {
      if (typeof report.profile !== 'string' || typeof report.scenario !== 'string') throw new Error('Invalid benchmark identity.');
      if (result.has(key(report))) throw new Error(`Duplicate benchmark: ${key(report)}`);
      result.set(key(report), report);
    }
    return result;
  };
  const before = index(baseline);
  const after = index(candidate);
  if ([...before.keys()].sort().join('\n') !== [...after.keys()].sort().join('\n')) throw new Error('Scenario/profile sets differ.');
  const results = [];
  for (const [id, current] of after) {
    const previous = before.get(id);
    for (const field of environmentFields) {
      if (current[field] === undefined || JSON.stringify(current[field]) !== JSON.stringify(previous[field])) {
        throw new Error(`Incomparable ${field} for ${id}.`);
      }
    }
    if (current.typing?.samples < 20 || previous.typing?.samples < 20) throw new Error(`Insufficient typing samples for ${id}.`);
    for (const [metric, value] of Object.entries(metrics)) {
      const oldValue = value(previous);
      const newValue = value(current);
      if (!Number.isFinite(oldValue) || oldValue <= 0 || !Number.isFinite(newValue) || newValue <= 0) throw new Error(`Invalid ${metric} for ${id}.`);
      const ratio = newValue / oldValue;
      results.push({ scenario: id, metric, baseline: oldValue, candidate: newValue, ratio, status: ratio <= maxRatio ? 'pass' : 'regression' });
    }
  }
  return { status: results.some(result => result.status === 'regression') ? 'regression' : 'pass', maxRatio, results };
}

function readReports(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? readReports(path) : entry.name === 'editor-benchmark.json' ? [JSON.parse(readFileSync(path, 'utf8'))] : [];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
  const baseline = arg('--baseline');
  const candidate = arg('--candidate');
  if (!baseline || !candidate) throw new Error('Usage: --baseline DIRECTORY --candidate DIRECTORY --max-ratio ACCEPTED_RATIO');
  const report = compareEditorBenchmarks(readReports(baseline), readReports(candidate), Number(arg('--max-ratio')));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'pass') process.exitCode = 1;
}
