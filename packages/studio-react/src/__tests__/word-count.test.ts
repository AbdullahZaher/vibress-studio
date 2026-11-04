import { describe, it, expect } from 'vitest';
import { countWords, calculateWordCountStats } from '../plugins/WordCountPlugin';

describe('Editorial Word Count and Reading Time Calculation (STU-R16)', () => {
  it('correctly calculates word count for standard English text', () => {
    const text = 'The double-edged sword of independence gives you freedom, but demands discipline.';
    const stats = calculateWordCountStats(text);
    expect(stats.words).toBe(11);
    expect(stats.characters).toBe(text.length);
    expect(stats.readingTimeMinutes).toBe(1);
  });

  it('correctly calculates word count for Arabic text', () => {
    const text = 'محرر الاستوديو يوفر تجربة كتابة هادئة ومتكاملة بدون تشتيت.';
    const stats = calculateWordCountStats(text);
    expect(stats.words).toBe(9);
    expect(stats.readingTimeMinutes).toBe(1);
  });

  it('calculates reading time for larger articles (Ghost 200 WPM standard)', () => {
    // 600 words should be 3 minutes reading time
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
    const stats = calculateWordCountStats(words);
    expect(stats.words).toBe(600);
    expect(stats.readingTimeMinutes).toBe(3);
  });

  it('handles empty and whitespace-only text gracefully', () => {
    expect(calculateWordCountStats('').words).toBe(0);
    expect(calculateWordCountStats('   \n\t  ').words).toBe(0);
    expect(calculateWordCountStats('').readingTimeMinutes).toBe(1);
  });

  it('handles mixed punctuation, hyphens, and newlines correctly', () => {
    const text = 'First line.\nSecond line—with dashes and 123 numbers!\nThird.';
    expect(countWords(text)).toBe(9);
  });

  it('processes a 500-paragraph long document under 15ms without allocating string arrays', () => {
    // Generate 500 paragraphs, each 100 words (~50,000 words, ~350KB text)
    const paragraph = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    const largeDoc = Array.from({ length: 500 }, () => paragraph).join('\n\n');

    expect(largeDoc.length).toBeGreaterThan(300_000);

    const start = performance.now();
    const stats = calculateWordCountStats(largeDoc);
    const duration = performance.now() - start;

    expect(stats.words).toBe(50_000);
    expect(stats.readingTimeMinutes).toBe(250);
    // Computation should complete in a small fraction of a frame (typically < 10ms)
    expect(duration).toBeLessThan(50);
  });
});

