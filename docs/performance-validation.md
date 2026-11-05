# Document Pipeline Performance Baseline (F11)

Status: **instrumentation implemented; actual measurements and browser editor budgets must be verified at the final release SHA.**

## Commands

Run after a clean installation and complete build:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm benchmark:document
```

The script reports: timestamp, exact commit SHA (from `GITHUB_SHA` or `git rev-parse HEAD`), Node version, OS architecture, CPU model/count, total system memory, scenario, payload bytes, iteration count, median/p95/min/max for the **CPU document pipeline**, and heap-used-at-end snapshots. These are not editor memory-leak measurements. It warms up once, uses 7 timed samples for most operations and 3 samples for HTML reimport.

## Scenarios

1. Approximately 1,000, 5,000, 20,000 and 50,000 words in paragraph nodes.
2. Media-heavy 5,000-word article with image cards, tables and lists-like structures.
3. Mixed Arabic/English/number 5,000-word article.

Operations: `serializeStudioDocument`, `renderStudioDocumentToHtml`, `studioDocumentToMarkdown`, `htmlToStudioDocument`. These call the actual exported functions and the same resource admission paths used by Studio. All benchmarks must keep the existing 5 MiB/50,000-node/depth-64 document constraints; no fixture should bypass validation.

## Excluded from this benchmark (Not Verified)

- Lexical React initial render, React commit duration, `OnChangePlugin` in the browser and actual keystroke latency.
- Interaction to Next Paint (INP), real scrolling, image decoding, mobile CPU/thermal throttling.
- Yjs collaboration, host autosave network time, host database, physical device memory use.
- Full clipboard paste event latency and accessible interaction throughput.

Track these in a separate controlled Playwright/device benchmark suite. The proposed p95 keystroke below 50 ms and INP at or below 200 ms remain **targets**, not measured claims. Any performance optimization requires baseline traces and regression tests before modifying functionality.

## Interpretation

Do not compare GitHub runner CPU numbers with real-user devices without calibration, or optimize solely for a synthetic result. Keep hardware, browser, build mode, document fixture, exact SHA and timing method with every measurement. Require independent QA sign-off for release budgets.
