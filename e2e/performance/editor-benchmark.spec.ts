import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpus, platform } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

for (const scenario of ['empty', '1000-words', '5000-words', '20000-words', '50000-words', 'mixed-5000', 'table-5000', 'media-5000']) {
  test(scenario, async ({ page, browser }, testInfo) => {
    const mobile = testInfo.project.name.startsWith('mobile');
    if (mobile && browser.browserType().name() === 'chromium') {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.route('**/mock/assets/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
    await page.goto(`/e2e.html?benchmark=${scenario}`);
    const editable = page.locator('[data-testid="studio-editor"] [contenteditable="true"]').first();
    await expect(editable).toBeVisible();
    await page.waitForFunction(() => {
      const api = (window as unknown as { __studio: { benchmarkReadyMs(): number | null } }).__studio;
      return Boolean(api && api.benchmarkReadyMs() !== null);
    });
    const mountMs = await page.evaluate(() => (window as unknown as { __studio: { benchmarkReadyMs(): number } }).__studio.benchmarkReadyMs());
    const memInitial = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: { usedJSHeapSize: number } };
      return {
        heapUsed: perf.memory ? perf.memory.usedJSHeapSize : null,
        domNodes: document.querySelectorAll('*').length,
      };
    });
    await editable.locator('p').first().click();
    await page.keyboard.press('End');
    await page.evaluate(() => (window as unknown as { __studio: { beginBenchmarkTyping(): void } }).__studio.beginBenchmarkTyping());
    await page.evaluate(() => {
      const win = window as unknown as {
        __studioInpEntries: number[];
        __studioInpObserver?: PerformanceObserver;
        __studioRawEvents?: unknown[];
      };
      win.__studioInpEntries = [];
      win.__studioRawEvents = [];
      try {
        if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('event')) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const eventEntry = entry as unknown as { duration: number; interactionId?: number; name?: string };
              win.__studioRawEvents?.push({ name: eventEntry.name, duration: eventEntry.duration, interactionId: eventEntry.interactionId });
              if (eventEntry.name === 'keydown' || eventEntry.interactionId) {
                win.__studioInpEntries.push(eventEntry.duration);
              }
            }
          });
          observer.observe({ type: 'event', buffered: true, durationThreshold: 0 });
          win.__studioInpObserver = observer;
        }
      } catch {
        // Event Timing API not available in this browser engine
      }
    });
    await editable.evaluate(root => {
      const target = window as unknown as { __studioTiming: number[] };
      target.__studioTiming = [];
      root.addEventListener('keydown', event => {
        if ((event as KeyboardEvent).key !== 'x') return;
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => target.__studioTiming.push(performance.now() - start)));
      }, { capture: true });
    });
    for (let index = 0; index < 20; index++) {
      await page.keyboard.press('x');
      await page.waitForFunction(expected => (window as unknown as { __studioTiming: number[] }).__studioTiming.length >= expected, index + 1);
    }
    const samples = await page.evaluate(() => (window as unknown as { __studioTiming: number[] }).__studioTiming);
    const { inpSamples } = await page.evaluate(() => {
      const win = window as unknown as {
        __studioInpEntries?: number[];
        __studioInpObserver?: PerformanceObserver;
      };
      win.__studioInpObserver?.disconnect();
      return {
        inpSamples: win.__studioInpEntries ?? [],
      };
    });
    const snapshot = await page.evaluate(() => (window as unknown as { __studio: { getDoc(): unknown } }).__studio.getDoc());
    expect(JSON.stringify(snapshot)).toContain('x'.repeat(20));
    const commitSamples = await page.evaluate(() => (window as unknown as { __studio: { benchmarkTypingSamples(): number[] } }).__studio.benchmarkTypingSamples());
    expect(commitSamples).toHaveLength(20);

    // Measure slash menu trigger latency
    let slashLatencyMs: number | null = null;
    try {
      await page.keyboard.press('Enter');
      const slashStart = performance.now();
      await page.keyboard.type('/');
      const slashMenu = page.locator('.vibress-slash-menu, [role="listbox"]').first();
      await slashMenu.waitFor({ state: 'visible', timeout: 3000 });
      slashLatencyMs = Math.round((performance.now() - slashStart) * 100) / 100;
      await page.keyboard.press('Escape');
    } catch {
      slashLatencyMs = null;
    }

    // Measure paste insertion latency
    let pasteLatencyMs: number | null = null;
    try {
      const pasteText = 'Benchmark paste text';
      const pasteStart = performance.now();
      await page.evaluate((text) => {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const event = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        document.activeElement?.dispatchEvent(event);
      }, pasteText);
      await page.waitForTimeout(50);
      pasteLatencyMs = Math.round((performance.now() - pasteStart) * 100) / 100;
    } catch {
      pasteLatencyMs = null;
    }

    // Repeated editing cycles for memory stability check
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('y');
      await page.keyboard.press('Backspace');
    }
    const memFinal = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: { usedJSHeapSize: number } };
      return {
        heapUsed: perf.memory ? perf.memory.usedJSHeapSize : null,
        domNodes: document.querySelectorAll('*').length,
      };
    });

    const rawCommitSamples = [...commitSamples];
    commitSamples.sort((a, b) => a - b);
    samples.sort((a, b) => a - b);
    inpSamples.sort((a, b) => a - b);

    const inpMetrics = inpSamples.length > 0 ? {
      supported: true,
      samples: inpSamples.length,
      p50Ms: Math.round(inpSamples[Math.floor(inpSamples.length * 0.5)] * 100) / 100,
      p75Ms: Math.round(inpSamples[Math.floor(inpSamples.length * 0.75)] * 100) / 100,
      p95Ms: Math.round(inpSamples[Math.floor(inpSamples.length * 0.95)] * 100) / 100,
      maxMs: Math.round((inpSamples.at(-1) ?? 0) * 100) / 100,
    } : {
      supported: false,
      samples: 0,
    };

    const report = {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      workingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
      fixtureVersion: 1,
      fixtureHash: createHash('sha256').update(readFileSync('packages/studio-testing/src/index.ts')).digest('hex'),
      scenario, profile: testInfo.project.name, browser: browser.version(), platform: platform(), cpu: cpus()[0]?.model,
      viewport: page.viewportSize(), cpuThrottle: mobile ? 4 : 1,
      method: 'React mount to second animation frame; keydown to second frame proxy. Not INP, not physical mobile hardware.',
      mountMs, typing: { samples: samples.length, p50Ms: samples[9], p95Ms: samples[18], maxMs: samples.at(-1) },
      lexicalVersion: JSON.parse(readFileSync('packages/studio-react/package.json', 'utf8')).dependencies.lexical,
      commitLatency: {
        method: 'DOM keydown capture to a microtask after the dirty Lexical commit listener chain; includes synchronous serialization/listeners, excludes later React rendering, paint and host persistence. Not INP.',
        samples: commitSamples.length, rawSamplesMs: rawCommitSamples,
        p50Ms: commitSamples[9], p95Ms: commitSamples[18], maxMs: commitSamples.at(-1),
      },
      inp: inpMetrics,
      slashCommandLatencyMs: slashLatencyMs,
      pasteLatencyMs,
      memory: {
        initialHeapBytes: memInitial.heapUsed,
        finalHeapBytes: memFinal.heapUsed,
        deltaHeapBytes: (memInitial.heapUsed !== null && memFinal.heapUsed !== null)
          ? memFinal.heapUsed - memInitial.heapUsed
          : null,
        initialDomNodes: memInitial.domNodes,
        finalDomNodes: memFinal.domNodes,
      },
      serializedBytes: Buffer.byteLength(JSON.stringify(snapshot)),
    };
    const path = testInfo.outputPath('editor-benchmark.json');
    writeFileSync(path, JSON.stringify(report, null, 2));
    await testInfo.attach('editor-benchmark', { path, contentType: 'application/json' });
  });
}
