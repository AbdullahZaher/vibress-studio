#!/usr/bin/env node
/**
 * Reproducible CPU-only document pipeline benchmark. NOT a measurement of real
 * editor keystrokes, INP, scrolling, Yjs, or mobile hardware responsiveness.
 *
 * Run: pnpm build && pnpm benchmark:document
 * Record output (including SHA/browser/hardware) for an audited baseline.
 */
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { createDefaultStudioDocument } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { htmlToStudioDocument } from '@vibress/studio-html';

function sha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}
function block(text) {
  return { type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text }] };
}
function documentOf(words, { mixed = false, media = false } = {}) {
  const doc = createDefaultStudioDocument();
  const content = mixed ? 'مرحبا English اختبار mixed 123' : 'Publishing editor content for stress benchmarking';
  const wordsPerChunk = content.split(/\s+/).length;
  const chunks = Math.ceil(words / wordsPerChunk / 40);
  doc.root.children = Array.from({ length: chunks }, (_, i) =>
    block(Array.from({ length: Math.min(40, Math.ceil(words / wordsPerChunk) - i * 40) },
      () => content).join(' ')));
  if (media) {
    for (let i = 0; i < 80; i++) {
      doc.root.children.push({ type: 'studio-card', version: 1, cardType: 'image',
        cardData: { src: `/assets/photo-${i}.png`, alt: `Photo ${i}`, caption: 'وصف صورة' } });
    }
    for (let i = 0; i < 12; i++) {
      doc.root.children.push({ type: 'table', version: 1, children: Array.from({ length: 4 }, (_, row) =>
        ({ type: 'tablerow', version: 1, children: Array.from({ length: 4 }, (_, col) =>
          ({ type: 'tablecell', version: 1, children: [block(`row ${row} col ${col} العربية`)] })) })) });
    }
  }
  return doc;
}
function percentile(sorted, factor) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * factor) - 1)];
}
function measure(fn, repeats = 7) {
  const durations = [];
  // One warm-up iteration reduces module/JIT cold-start noise.
  fn();
  for (let i = 0; i < repeats; i++) {
    const start = performance.now();
    fn();
    durations.push(Number((performance.now() - start).toFixed(3)));
  }
  durations.sort((a, b) => a - b);
  return { iterations: repeats, medianMs: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95), minMs: durations[0], maxMs: durations.at(-1) };
}
const scenarios = [
  { label: '1000-words', words: 1000 },
  { label: '5000-words', words: 5000 },
  { label: '20000-words', words: 20000 },
  { label: '50000-words', words: 50000 },
  { label: 'media-tables-5000-words', words: 5000, media: true },
  { label: 'arabic-mixed-5000-words', words: 5000, mixed: true },
];
const output = {
  note: 'CPU document pipeline only; no browser editor latency or INP measured',
  commitSha: sha(), utc: new Date().toISOString(),
  platform: process.platform, arch: process.arch, node: process.version,
  cpuModel: os.cpus()[0]?.model ?? 'unknown', cpuCount: os.cpus().length,
  totalMemoryMiB: Math.round(os.totalmem() / 1048576),
  results: [],
};
for (const scenario of scenarios) {
  const doc = documentOf(scenario.words, scenario);
  const serialized = serializeStudioDocument(doc.root);
  const html = renderStudioDocumentToHtml(serialized);
  const metrics = {
    scenario: scenario.label, approximateWords: scenario.words,
    serializedBytes: Buffer.byteLength(JSON.stringify(serialized)),
    serialize: measure(() => serializeStudioDocument(doc.root)),
    htmlRender: measure(() => renderStudioDocumentToHtml(serialized)),
    markdownExport: measure(() => studioDocumentToMarkdown(serialized)),
    htmlReimport: measure(() => htmlToStudioDocument(html), 3),
    heapUsedMiBAtEnd: Number((process.memoryUsage().heapUsed / 1048576).toFixed(1)),
  };
  output.results.push(metrics);
}
console.log(JSON.stringify(output, null, 2));
