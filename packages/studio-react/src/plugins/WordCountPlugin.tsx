import React, { useEffect, useState, useMemo } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';

export interface WordCountStats {
  words: number;
  characters: number;
  readingTimeMinutes: number;
}

export interface WordCountPluginProps {
  showReadingTime?: boolean;
  className?: string;
  debounceMs?: number;
}

/**
 * Counts non-whitespace word tokens without allocating an array of strings.
 * Operates in O(N) time and O(1) space to prevent GC pressure on large documents.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  let count = 0;
  const re = /\S+/g;
  while (re.exec(text) !== null) {
    count++;
  }
  return count;
}

/**
 * Calculates words, character count, and estimated reading time (200 wpm standard).
 */
export function calculateWordCountStats(text: string): WordCountStats {
  const characters = text.length;
  const words = countWords(text);
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return { words, characters, readingTimeMinutes };
}

/**
 * Ghost-inspired Editorial Word Count & Reading Time Indicator.
 * Docks subtly at the bottom corner of the editor canvas.
 * Optimized for large-document responsiveness (STU-R16):
 *  - Ignores pure selection changes (dirtyElements/dirtyLeaves == 0)
 *  - Debounces calculations during rapid typing
 *  - Uses non-blocking scheduling to avoid main-thread typing latency
 */
export function WordCountPlugin({
  showReadingTime = true,
  className = '',
  debounceMs = 150,
}: WordCountPluginProps): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const [stats, setStats] = useState<WordCountStats>({
    words: 0,
    characters: 0,
    readingTimeMinutes: 1,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const computeAndSetStats = () => {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        const nextStats = calculateWordCountStats(text);
        setStats(nextStats);
      });
    };

    // Calculate initial state immediately
    computeAndSetStats();

    const unregister = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      // If no elements or leaves were modified, this is a pure selection / caret change.
      // Word counts cannot change on selection alone; skip full document re-traversal.
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
        return;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        idleId = null;
      }

      timeoutId = setTimeout(() => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          idleId = (window as Window & {
            requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
          }).requestIdleCallback(
            () => {
              computeAndSetStats();
            },
            { timeout: 250 }
          );
        } else {
          computeAndSetStats();
        }
      }, debounceMs);
    });

    return () => {
      unregister();
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
    };
  }, [editor, debounceMs]);

  const formattedWords = useMemo(() => stats.words.toLocaleString(), [stats.words]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`studio-word-count-dock ${className}`}
      title={`${stats.characters.toLocaleString()} characters · ~${stats.readingTimeMinutes} min reading time`}
      style={{
        position: 'fixed',
        bottom: '24px',
        insetInlineEnd: '32px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        fontSize: '12px',
        color: 'var(--vb-studio-foreground-muted, var(--muted-foreground, #64748b))',
        background: 'transparent',
        userSelect: 'none',
        pointerEvents: 'auto',
        zIndex: 30,
        boxSizing: 'border-box',
      }}
    >
      <span className="studio-word-count-val" style={{ fontWeight: 400 }}>{formattedWords} words</span>
      {showReadingTime && stats.words > 0 && (
        <>
          <span className="studio-word-count-dot" style={{ opacity: 0.5 }}>·</span>
          <span className="studio-word-count-time" style={{ fontWeight: 400 }}>{stats.readingTimeMinutes} min read</span>
        </>
      )}
      <span
        className="studio-word-count-help"
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: '1px solid currentColor',
          fontSize: '10px',
          lineHeight: 1,
          opacity: 0.6,
          cursor: 'help',
        }}
      >
        ?
      </span>
    </div>
  );
}

