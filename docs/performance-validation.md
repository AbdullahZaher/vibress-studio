# Performance & Latency Validation Baseline (F11 / Gate G4)

Status: **Historical/local measurement evidence, not blanket performance SLA or Core Web Vitals INP certification.** The 32 Playwright scenarios record editor input-to-second-animation-frame proxies; the release CI runs the separate Node document-pipeline benchmark, not `benchmark:editor`. Re-run the browser suite on each final candidate SHA before quoting its measurements as release evidence.

---

## 1. Document Pipeline Performance Baseline (CPU Node.js)

### Commands
Run after a clean installation and complete build:
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm benchmark:document
```

The script reports: timestamp, exact commit SHA, Node version, OS architecture, CPU model/count, total system memory, scenario, payload bytes, iteration count, median/p95/min/max for the **CPU document pipeline**, and heap-used-at-end snapshots.

### Verified Baseline Metrics (Apple M4 Pro, Node v24.16.0, darwin arm64)

| Scenario | Words / Complexity | Serialized Size | Serialize ($p_{95}$) | HTML Render ($p_{95}$) | Markdown Export ($p_{95}$) | HTML Reimport ($p_{95}$) | Heap Used |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1000-words** | 1,000 words | 8.9 KB | 0.06 ms | 0.69 ms | 0.70 ms | 0.49 ms | 15.7 MB |
| **5000-words** | 5,000 words | 43.6 KB | 0.14 ms | 1.07 ms | 0.15 ms | 1.77 ms | 17.2 MB |
| **20000-words** | 20,000 words | 173.8 KB | 0.46 ms | 5.59 ms | 0.50 ms | 7.79 ms | 27.3 MB |
| **50000-words** | 50,000 words | 434.2 KB | 1.63 ms | 12.21 ms | 1.29 ms | 18.44 ms | 37.7 MB |
| **media-tables** | 5,000 words + 80 cards + 12 tables | 87.5 KB | 1.20 ms | 3.06 ms | 1.05 ms | 4.05 ms | 32.2 MB |
| **arabic-mixed** | 5,000 words (Arabic / English / 123) | 44.2 KB | 0.12 ms | 0.87 ms | 0.14 ms | 1.50 ms | 38.9 MB |

---

## 2. Browser Editor Performance Suite (`pnpm benchmark:editor`)

### Methodology & Harness
Browser editor latency is evaluated via Playwright under [`e2e/performance.config.ts`](../e2e/performance.config.ts) against the isolated E2E test harness (`/e2e.html?benchmark=<scenario>`).

1. **Mount Readiness Proxy (`mountMs`):** Recorded by the test harness after editor initialization and its readiness callback; it is not a field-measured navigation or Core Web Vitals metric.
2. **Keystroke Latency Proxy (`typing`):** Time from `keydown` to the second `requestAnimationFrame` callback. This is a browser-harness proxy, **not** end-to-end input latency, guaranteed paint time or an official INP measurement; Playwright drives 20 `x` keypresses per scenario.
3. **Commit Pipeline Latency (`commitLatency`):** Time from `keydown` capture to a microtask following the synchronous `editor.registerUpdateListener` chain, isolating pure JavaScript serialization and listener overhead without browser paint.
4. **Slash Command Latency (`slashCommandLatencyMs`):** Time from typing `/` to `.vibress-slash-menu` / `[role="listbox"]` becoming visible.
5. **Paste Latency (`pasteLatencyMs`):** Time to inject and commit a clipboard data transfer block.
6. **Memory & DOM snapshots:** Samples `performance.memory.usedJSHeapSize` when the browser exposes it, plus DOM element counts before/after ten insert/backspace cycles. A single before/after snapshot **cannot prove absence of leaks**; Firefox/WebKit heap samples can be unavailable. Event Timing entries are collected on supporting engines, but are not a field INP distribution.

### Verified Multi-Browser Benchmark Results

#### A. Desktop Chromium (1440×900, 1× CPU)
| Scenario | Mount (ms) | Typing ($p_{50}$) | Typing ($p_{95}$) | Commit ($p_{95}$) | Slash Menu | Paste | Heap Used | DOM Nodes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **empty** | 34.1 ms | 15.5 ms | 16.8 ms | 2.7 ms | 25.6 ms | 53.7 ms | 20.7 MB | 59 |
| **1000-words** | 38.2 ms | 15.7 ms | 16.9 ms | 0.8 ms | 17.1 ms | 54.0 ms | 20.7 MB | 89 |
| **5000-words** | 53.9 ms | 15.6 ms | 17.2 ms | 1.3 ms | 24.9 ms | 54.4 ms | 23.4 MB | 209 |
| **20000-words** | 105.9 ms | 49.2 ms | 56.3 ms | 2.6 ms | 60.9 ms | 55.9 ms | 29.8 MB | 659 |
| **50000-words** | 212.4 ms | 120.9 ms | 132.1 ms | 5.5 ms | 138.5 ms | 57.0 ms | 26.3 MB | 1,559 |
| **mixed-5000** | 81.9 ms | 31.3 ms | 34.3 ms | 1.4 ms | 42.3 ms | 53.8 ms | 24.8 MB | 209 |
| **table-5000** | 122.9 ms | 64.8 ms | 74.8 ms | 4.7 ms | 79.7 ms | 56.0 ms | 45.2 MB | 479 |
| **media-5000** | 110.7 ms | 27.1 ms | 33.5 ms | 28.7 ms | 41.5 ms | 55.0 ms | 40.1 MB | 459 |

#### B. Mobile Emulation (Chromium 390×844, 4× CPU Throttling)
| Scenario | Mount (ms) | Typing ($p_{50}$) | Typing ($p_{95}$) | Commit ($p_{95}$) | Slash Menu | Paste | Heap Used |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **empty** | 130.7 ms | 15.2 ms | 20.8 ms | 10.4 ms | 63.6 ms | 56.9 ms | 20.7 MB |
| **1000-words** | 158.1 ms | 18.2 ms | 30.3 ms | 3.5 ms | 63.4 ms | 55.7 ms | 22.0 MB |
| **5000-words** | 225.8 ms | 62.7 ms | 84.2 ms | 5.0 ms | 110.5 ms | 57.4 ms | 23.4 MB |
| **20000-words** | 444.6 ms | 198.9 ms | 225.1 ms | 18.6 ms | 255.3 ms | 65.2 ms | 29.8 MB |
| **50000-words** | 880.3 ms | 490.3 ms | 512.3 ms | 37.9 ms | 552.9 ms | 86.9 ms | 26.3 MB |
| **mixed-5000** | 344.0 ms | 121.6 ms | 148.1 ms | 6.0 ms | 173.7 ms | 58.8 ms | 26.3 MB |
| **table-5000** | 512.5 ms | 264.3 ms | 293.7 ms | 15.6 ms | 316.9 ms | 84.9 ms | 42.6 MB |
| **media-5000** | 476.9 ms | 113.0 ms | 143.2 ms | 122.9 ms | 171.9 ms | 62.1 ms | 40.1 MB |

#### C. Desktop Firefox (1440×900)
| Scenario | Mount (ms) | Typing ($p_{50}$) | Typing ($p_{95}$) | Commit ($p_{95}$) | Slash Menu | Paste |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **empty** | 21.0 ms | 8.0 ms | 9.0 ms | 1.0 ms | 15.2 ms | 52.3 ms |
| **1000-words** | 31.0 ms | 16.0 ms | 16.0 ms | 1.0 ms | 22.3 ms | 54.0 ms |
| **5000-words** | 60.0 ms | 36.0 ms | 42.0 ms | 2.0 ms | 47.3 ms | 53.2 ms |
| **20000-words** | 146.0 ms | 127.0 ms | 138.0 ms | 3.0 ms | 145.5 ms | 53.6 ms |
| **50000-words** | 378.0 ms | 321.0 ms | 335.0 ms | 5.0 ms | 367.7 ms | 53.9 ms |
| **mixed-5000** | 73.0 ms | 40.0 ms | 43.0 ms | 2.0 ms | 54.9 ms | 52.5 ms |
| **table-5000** | 320.0 ms | 283.0 ms | 299.0 ms | 5.0 ms | 312.1 ms | 51.7 ms |
| **media-5000** | 159.0 ms | 60.0 ms | 69.0 ms | 2.0 ms | 75.4 ms | 53.5 ms |

#### D. Desktop WebKit (Safari Engine, 1440×900)
| Scenario | Mount (ms) | Typing ($p_{50}$) | Typing ($p_{95}$) | Commit ($p_{95}$) | Slash Menu | Paste |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **empty** | 46.0 ms | 32.0 ms | 33.0 ms | 4.0 ms | 21.3 ms | 54.6 ms |
| **1000-words** | 38.0 ms | 32.0 ms | 33.0 ms | 1.0 ms | 18.7 ms | 54.3 ms |
| **5000-words** | 56.0 ms | 30.0 ms | 32.0 ms | 2.0 ms | 31.8 ms | 52.5 ms |
| **20000-words** | 95.0 ms | 47.0 ms | 63.0 ms | 3.0 ms | 70.2 ms | 53.8 ms |
| **50000-words** | 174.0 ms | 123.0 ms | 130.0 ms | 5.0 ms | 137.7 ms | 54.7 ms |
| **mixed-5000** | 68.0 ms | 30.0 ms | 31.0 ms | 2.0 ms | 55.0 ms | 53.0 ms |
| **table-5000** | 156.0 ms | 84.0 ms | 94.0 ms | 6.0 ms | 122.2 ms | 54.8 ms |
| **media-5000** | 140.0 ms | 29.0 ms | 48.0 ms | 32.0 ms | 46.4 ms | 54.2 ms |

---

## 3. Observed results vs proposed budgets (not a blanket SLA pass)

These values are the **recorded historical local benchmark observations** in the tables above. The final release workflow [CI #42522465244](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42522465244) ran `benchmark:document` (Node document pipeline) and the normal editor E2E suite, **not** the 32-case `benchmark:editor` suite. The latter must be repeated with artifacts pinned to the candidate SHA before treating its numbers as final-release evidence.

### Typing proxy p95

The proposed **desktop p95 ≤ 50 ms** threshold is achieved by ordinary 5k-word text (Chromium 17.2 ms, Firefox 42 ms, WebKit 32 ms) and mixed Arabic/English 5k-word text (34.3/43/31 ms). It **is not achieved by all 5k-word or card-heavy scenarios**:

| Scenario | Chromium desktop | Firefox desktop | WebKit desktop | Chromium mobile 4× CPU |
| --- | ---: | ---: | ---: | ---: |
| Plain 5k-word | 17.2 ms | 42 ms | 32 ms | 84.2 ms |
| Mixed Arabic/English 5k | 34.3 ms | 43 ms | 31 ms | 148.1 ms |
| Tables 5k (360 cells) | **74.8 ms** | **299 ms** | **94 ms** | **293.7 ms** |
| Media 5k (50 cards) | 33.5 ms | **69 ms** | 48 ms | **143.2 ms** |
| Plain 20k | **56.3 ms** | **138 ms** | **63 ms** | **225.1 ms** |
| Plain 50k | **132.1 ms** | **335 ms** | **130 ms** | **512.3 ms** |

Bold values exceed the proposed **desktop 50 ms** threshold or the **mobile 85 ms** threshold. Desktop and mobile limits are **proposal budgets**, not CI-enforced acceptance checks.

### Mount, commit pipeline, slash, paste and memory caveats

- **Mount readiness**: the proposed desktop < 85 ms target is exceeded by Chromium 5k tables (122.9 ms), media (110.7 ms), 20k (105.9 ms), and 50k (212.4 ms). Mobile 4× CPU table/media/20k/50k exceed the proposed < 350 ms target (512.5/476.9/444.6/880.3 ms).
- **Synchronous commit/listener proxy**: the statement that all desktop scenarios stay under 5.5 ms is contradicted by media 5k on Chromium (28.7 ms) and WebKit (32 ms), plus WebKit tables 5k (6 ms). Mobile media 5k measures 122.9 ms, above a proposed 40 ms mobile target. The measured scope excludes subsequent paint and host persistence.
- **Slash command**: several stress scenarios exceed the blanket < 45 ms desktop / < 115 ms mobile claims (e.g. desktop Chromium tables 79.7 ms, mobile tables 316.9 ms). The harness suppresses slash measurement failures as `null`; only non-null recorded samples support a timing claim.
- **Paste**: the harness dispatches a synthetic `ClipboardEvent` and waits a fixed 50 ms before taking a stopwatch reading. Its ~52–86 ms figures are **not isolated paste processing latency**, nor proof of a 60 ms budget.
- **INP**: Event Timing entries are optional and local. The harness explicitly labels its typing and commit measurements `Not INP`. No real-user Core Web Vitals INP p75 ≤ 200 ms acceptance is established here; require measured interaction IDs and appropriate field data/window before an INP claim.
- **Memory**: `performance.memory` snapshots and DOM element counts after ten edit/delete cycles do not establish `zero leaks`, `ΔHeap = 0` or detached-node absence. Require repeated long-duration sessions, GC-aware comparisons where supported, snapshots/allocations, and more than a single short loop.

### Reverification criteria

1. Run `pnpm install --frozen-lockfile && pnpm build && pnpm benchmark:editor` on the exact candidate SHA, record platform/CPU/browser versions, and preserve all 32 JSON artifacts.
2. Separately define pass/fail budgets per document class and device profile (plain, RTL/mixed, tables, media, long-form); do not silently omit failing profiles.
3. Add explicit CI assertions only after repeatability assessment, with a documented variance tolerance. Measure genuine INP/field responsiveness separately from typing-to-rAF proxies.
4. Validate real mobile hardware, Arabic IME and host autosave independently; standalone benchmark numbers cannot certify host runtime responsiveness or WCAG conformance.

This correction **does not invalidate successful CI, shipped beta tags, or the historical measurements**. It narrows what those signals actually prove.
