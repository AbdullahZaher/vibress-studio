import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { escapeRegExp, isSafeUrl } from '@vibress/studio-utils';
import { STUDIO_CORE_NODES } from '@vibress/studio-nodes';
import { CardErrorBoundary } from '@vibress/studio-react';

/**
 * P4: editor robustness. Malformed input must never crash the editor.
 */

describe('Slash menu — regex construction (P4)', () => {
  const CARD_TITLES = ['Image', 'Gallery', 'Video', 'Audio', 'File', 'Bookmark', 'Embed', 'Button', 'Callout', 'Toggle', 'Markdown', 'Html', 'Divider'];

  function filterTitles(query: string): string[] {
    const regex = new RegExp(escapeRegExp(query), 'i');
    return CARD_TITLES.filter((t) => regex.test(t));
  }

  it('does not crash on regex metacharacters', () => {
    expect(() => filterTitles('[')).not.toThrow();
    expect(() => filterTitles('(')).not.toThrow();
    expect(() => filterTitles('*')).not.toThrow();
    expect(() => filterTitles('^')).not.toThrow();
    expect(() => filterTitles('\\')).not.toThrow();
    expect(() => filterTitles('')).not.toThrow();
  });

  it('treats metacharacters literally', () => {
    expect(filterTitles('[')).toEqual([]);
    expect(filterTitles('(')).toEqual([]);
    expect(filterTitles('*')).toEqual([]);
    expect(filterTitles('.')).toEqual([]);
  });

  it('filters correctly for normal queries', () => {
    expect(filterTitles('image')).toEqual(['Image']);
    expect(filterTitles('vid')).toEqual(['Video', 'Divider']);
    expect(filterTitles('toggle')).toEqual(['Toggle']);
  });

  it('empty query matches everything', () => {
    expect(filterTitles('').length).toBe(CARD_TITLES.length);
  });

  it('escapeRegExp escapes every special character', () => {
    const special = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(special);
    // The escaped string must be a valid regex that matches the literal input.
    expect(new RegExp(escaped).test(special)).toBe(true);
  });
});

describe('Bookmark editor — malformed URL safety (P4)', () => {
  it('new URL throws are caught without crashing (safe parse pattern)', () => {
    const parseSafely = (url: string): string | null => {
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    };
    expect(parseSafely('https://example.com')).toBe('example.com');
    expect(parseSafely('not a url')).toBeNull();
    expect(parseSafely('::bad::')).toBeNull();
    expect(parseSafely('')).toBeNull();
  });

  it('unsafe URLs are rejected before persistence', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('https://example.com" onerror="x')).toBe(false);
  });
});

describe('Card error boundary (P4)', () => {
  const config = {
    namespace: 'studio-test',
    nodes: STUDIO_CORE_NODES,
    onError: () => undefined,
  };

  function ThrowingCard() {
    throw new Error('boom');
  }

  function OkCard({ label }: { label: string }) {
    return <div>{label}</div>;
  }

  it('a crashing card editor shows the fallback instead of crashing the editor', () => {
    render(
      <LexicalComposer initialConfig={config}>
        <CardErrorBoundary nodeKey="1">
          <ThrowingCard />
        </CardErrorBoundary>
        <CardErrorBoundary nodeKey="2">
          <OkCard label="healthy card" />
        </CardErrorBoundary>
      </LexicalComposer>
    );
    // Fallback for the broken card…
    expect(screen.getByText('This card could not be rendered.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove card' })).toBeTruthy();
    // …while a sibling card still renders normally.
    expect(screen.getByText('healthy card')).toBeTruthy();
  });

  it('normal card editors render without the boundary interfering', () => {
    render(
      <LexicalComposer initialConfig={config}>
        <CardErrorBoundary nodeKey="3">
          <OkCard label="fine" />
        </CardErrorBoundary>
      </LexicalComposer>
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByText('This card could not be rendered.')).toBeNull();
  });
});
