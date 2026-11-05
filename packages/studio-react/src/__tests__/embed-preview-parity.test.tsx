import React from 'react';
import { render, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { describe, expect, it } from 'vitest';
import { StudioCardNode } from '@vibress/studio-cards';
import { ReactStudioCardNode } from '../nodes/ReactStudioCardNode';
import { EmbedCardEditor } from '../components/cards/EmbedCardEditor';

function preview(cardData: { url: string; html?: string }) {
  const config = {
    namespace: 'EmbedPreviewTest',
    nodes: [StudioCardNode, ReactStudioCardNode],
    onError: (error: Error) => { throw error; },
  };
  return render(
    <LexicalComposer initialConfig={config}>
      <EmbedCardEditor nodeKey="embed-preview" cardData={{ ...cardData, caption: '' }} />
    </LexicalComposer>
  );
}

describe('EmbedCardEditor safe publication parity', () => {
  it('renders only the approved provider iframe instead of legacy HTML', () => {
    const { container } = preview({
      url: 'https://www.youtube.com/watch?v=abc123',
      html: '<iframe src="https://untrusted.example/"></iframe><script>evil()</script>',
    });
    const iframe = container.querySelector('.vb-embed-card iframe');
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(container.querySelectorAll('.vb-embed-card iframe')).toHaveLength(1);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/Legacy embed HTML is not published/)).not.toBeNull();
  });

  it('shows a safe external link for an unsupported provider', () => {
    const { container } = preview({ url: 'https://example.org/story', html: '<b>not published</b>' });
    expect(container.querySelector('.vb-embed-card iframe')).toBeNull();
    expect(container.querySelector('.vb-embed-card a')?.getAttribute('href')).toBe('https://example.org/story');
  });

  it('clearly signals invalid and missing media without executing arbitrary HTML', () => {
    const { container } = preview({ url: 'javascript:alert(1)', html: '<iframe src="/private"></iframe>' });
    expect(screen.getByText('Unsupported or unsafe embed URL.')).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });
});
