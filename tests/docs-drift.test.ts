import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Documentation Drift & Alignment Verification (STU-R15)', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('all unit test suites referenced in docs/testing.md exist on disk', () => {
    const testingDocsPath = path.join(rootDir, 'docs/testing.md');
    expect(fs.existsSync(testingDocsPath)).toBe(true);

    const content = fs.readFileSync(testingDocsPath, 'utf-8');
    // Extract list items like `- `packages/...test.ts`` or `- `tests/...test.ts``
    const lines = content.split('\n');
    const testFiles: string[] = [];
    for (const line of lines) {
      const match = line.match(/^-\s+`((?:packages|tests)\/[^`]+\.test\.[jt]sx?)`/);
      if (match) {
        testFiles.push(match[1]);
      }
    }

    expect(testFiles.length).toBeGreaterThanOrEqual(15);

    for (const file of testFiles) {
      const fullPath = path.join(rootDir, file);
      expect(fs.existsSync(fullPath), `Documented test suite "${file}" must exist on disk`).toBe(true);
    }
  });

  it('all workspace packages referenced in docs/architecture.md exist on disk', () => {
    const archDocsPath = path.join(rootDir, 'docs/architecture.md');
    expect(fs.existsSync(archDocsPath)).toBe(true);

    const content = fs.readFileSync(archDocsPath, 'utf-8');
    // Extract package names from the table: `| `studio-...` |`
    const lines = content.split('\n');
    const packages: string[] = [];
    for (const line of lines) {
      const match = line.match(/^\|\s+`([a-z0-9-]+)`\s+\|/);
      if (match && match[1].startsWith('studio-')) {
        packages.push(match[1]);
      }
    }

    expect(packages.length).toBeGreaterThanOrEqual(10);
    const uniquePackages = Array.from(new Set(packages));
    for (const pkg of uniquePackages) {
      const pkgPath = path.join(rootDir, 'packages', pkg);
      expect(fs.existsSync(pkgPath), `Documented package "${pkg}" must exist in packages/`).toBe(true);
    }
  });

  it('historical removed APIs (sanitizeHtmlFragment, HTML_SANITIZE_POLICY) are not exported in source', () => {
    const utilsIndexPath = path.join(rootDir, 'packages/studio-utils/src/index.ts');
    const utilsSource = fs.readFileSync(utilsIndexPath, 'utf-8');

    expect(utilsSource.includes('sanitizeHtmlFragment')).toBe(false);
    expect(utilsSource.includes('HTML_SANITIZE_POLICY')).toBe(false);
  });

  it('WordCountPlugin exports optimized countWords and calculateWordCountStats', async () => {
    const { countWords, calculateWordCountStats } = await import('@vibress/studio-react');
    expect(typeof countWords).toBe('function');
    expect(typeof calculateWordCountStats).toBe('function');

    const result = calculateWordCountStats('Hello world from Vibress Studio');
    expect(result.words).toBe(5);
    expect(result.characters).toBe('Hello world from Vibress Studio'.length);
    expect(result.readingTimeMinutes).toBe(1);
  });
});
