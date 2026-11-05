import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpus, platform } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

for (const scenario of ['empty', '1000-words', '5000-words', '20000-words', 'mixed-5000', 'table-5000', 'media-5000']) {
  test(scenario, async ({ page, browser }, testInfo) => {
    const mobile = testInfo.project.name.startsWith('mobile');
    if (mobile) {
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
    await editable.locator('p').first().click();
    await page.keyboard.press('End');
    await page.evaluate(() => (window as unknown as { __studio: { beginBenchmarkTyping(): void } }).__studio.beginBenchmarkTyping());
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
    const snapshot = await page.evaluate(() => (window as unknown as { __studio: { getDoc(): unknown } }).__studio.getDoc());
    expect(JSON.stringify(snapshot)).toContain('x'.repeat(20));
    const commitSamples = await page.evaluate(() => (window as unknown as { __studio: { benchmarkTypingSamples(): number[] } }).__studio.benchmarkTypingSamples());
    expect(commitSamples).toHaveLength(20);
    const rawCommitSamples = [...commitSamples];
    commitSamples.sort((a, b) => a - b);
    samples.sort((a, b) => a - b);
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
        method: 'DOM keydown capture to first dirty Lexical update listener; includes synchronous earlier listeners, excludes paint and host persistence. Not INP.',
        samples: commitSamples.length, rawSamplesMs: rawCommitSamples,
        p50Ms: commitSamples[9], p95Ms: commitSamples[18], maxMs: commitSamples.at(-1),
      },
      serializedBytes: Buffer.byteLength(JSON.stringify(snapshot)),
    };
    const path = testInfo.outputPath('editor-benchmark.json');
    writeFileSync(path, JSON.stringify(report, null, 2));
    await testInfo.attach('editor-benchmark', { path, contentType: 'application/json' });
  });
}
