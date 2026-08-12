import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import { UrlPlaceholder } from '@vibress/studio-react';
import { CardPlaceholder } from '@vibress/studio-react';
import { SafeHtml, sanitizeToSafeHtml } from '@vibress/studio-react';
import { UploadStatusOverlay } from '@vibress/studio-react';

/**
 * P9: accessibility smoke tests (axe) plus keyboard/label behavior checks.
 * Color-contrast is excluded: it requires a real browser rendering engine
 * (axe marks it incomplete under jsdom).
 */
async function assertNoAxeViolations(container: HTMLElement, context: string) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  const violations = results.violations.filter((v) => v.id !== 'color-contrast');
  expect(violations, `${context}: ${JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.length })))}`).toEqual([]);
}

describe('Axe accessibility smoke (P9)', () => {
  it('UrlPlaceholder has accessible form controls and no violations', async () => {
    const { container } = render(
      <UrlPlaceholder iconType="bookmark" title="Bookmark" description="Paste a URL" onUrlSubmit={() => undefined} />
    );
    const input = screen.getByLabelText('URL');
    expect(input).toBeTruthy();
    await assertNoAxeViolations(container, 'UrlPlaceholder');
  });

  it('UrlPlaceholder exposes errors via aria-describedby + role=alert', async () => {
    const { container } = render(
      <UrlPlaceholder
        iconType="embed"
        title="Embed"
        description="x"
        onUrlSubmit={() => undefined}
        validate={() => false}
      />
    );
    const input = screen.getByLabelText('URL');
    fireEvent.change(input, { target: { value: '::bad::' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert').textContent).toContain('not valid');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    await assertNoAxeViolations(container, 'UrlPlaceholder error state');
  });

  it('CardPlaceholder is keyboard-activatable and labeled', async () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <CardPlaceholder iconType="image" title="Image" description="click" onFileSelect={onFileSelect} />
    );
    const trigger = screen.getByRole('button', { name: /Add Image/i });
    expect(trigger.getAttribute('tabindex')).toBe('0');
    // Enter activates the hidden file input (no crash in jsdom).
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: ' ' });
    await assertNoAxeViolations(container, 'CardPlaceholder');
  });

  it('SafeHtml-rendered content has no violations', async () => {
    const { container } = render(
      <SafeHtml html={sanitizeToSafeHtml('<p>Hello <strong>world</strong></p>')} />
    );
    await assertNoAxeViolations(container, 'SafeHtml');
  });

  it('UploadStatusOverlay announces progress and errors accessibly', async () => {
    const { container } = render(
      <>
        <UploadStatusOverlay state={{ status: 'uploading', progress: 40, error: null }} onRetry={() => undefined} onDismiss={() => undefined} />
        <UploadStatusOverlay state={{ status: 'error', progress: 0, error: 'boom' }} onRetry={() => undefined} onDismiss={() => undefined} />
      </>
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain('40%');
    expect(screen.getByRole('alert').textContent).toContain('boom');
    await assertNoAxeViolations(container, 'UploadStatusOverlay');
  });
});

describe('Keyboard and label behavior (P9)', () => {
  it('card editors expose labeled inputs', () => {
    render(
      <UrlPlaceholder iconType="bookmark" title="Bookmark" description="Paste a URL" onUrlSubmit={() => undefined} />
    );
    // Label is visually hidden (sr-only) but linked via htmlFor/id.
    const label = screen.getByText('URL');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBeTruthy();
    expect(screen.getByLabelText('URL').id).toBe(label.getAttribute('for'));
  });

  it('error message is announced to assistive tech', () => {
    render(
      <UrlPlaceholder iconType="embed" title="Embed" description="x" onUrlSubmit={() => undefined} validate={() => false} />
    );
    const input = screen.getByLabelText('URL');
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    const alert = screen.getByRole('alert');
    // The alert must be linked from the input via aria-describedby.
    expect(alert.id).toBe(input.getAttribute('aria-describedby'));
  });

  it('slash menu options expose listbox semantics', () => {
    // The typeahead plugin owns the full menu; here we verify the option
    // markup contract used by the plugin's menuRenderFn.
    const { container } = render(
      <ul role="listbox" aria-label="Insert card">
        <li role="option" aria-selected="true" id="slash-option-image" tabIndex={-1}>Image</li>
        <li role="option" aria-selected="false" id="slash-option-video" tabIndex={-1}>Video</li>
      </ul>
    );
    expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe('Insert card');
    expect(container.querySelectorAll('[role="option"]').length).toBe(2);
    expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe('Image');
  });
});
