import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VibressStudio } from '../VibressStudio';
import { isStudioMigrationError, createEmptyStudioDocument } from '@vibress/studio-core';

describe('VibressStudio safe document migration and recovery (STU-R01)', () => {
  it('renders recovery alert and never calls onChange when value is invalid persisted data', () => {
    const onError = vi.fn();
    const onChange = vi.fn();

    const invalidValue = {
      foo: 'corrupt data',
      schema: 'unsupported-schema',
      randomField: 42,
    };

    render(
      <VibressStudio
        value={invalidValue as unknown as Parameters<typeof VibressStudio>[0]['value']}
        onError={onError}
        onChange={onChange}
      />
    );

    // 1. Recovery banner must be visible
    const alert = screen.getByRole('alert');
    expect(alert).not.toBeNull();
    expect(screen.getByText('Studio Document Recovery')).not.toBeNull();
    expect(screen.getByText('Content Preserved')).not.toBeNull();

    // 2. onError must be called with StudioMigrationError retaining original document
    expect(onError).toHaveBeenCalledTimes(1);
    const call = onError.mock.calls[0];
    expect(call).toBeDefined();
    const errorArg = call ? call[0] : null;
    expect(isStudioMigrationError(errorArg)).toBe(true);
    if (isStudioMigrationError(errorArg)) {
      expect(errorArg.rawDocument).toBe(invalidValue);
    }

    // 3. onChange MUST NOT be called (preventing silent empty document overwriting)
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders recovery alert when document schema is vibress-studio but root is malformed', () => {
    const onError = vi.fn();
    const onChange = vi.fn();

    const malformedDoc = {
      schema: 'vibress-studio',
      version: 1,
      root: 'not-an-object',
    };

    render(
      <VibressStudio
        value={malformedDoc as unknown as Parameters<typeof VibressStudio>[0]['value']}
        onError={onError}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('alert')).not.toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not autosave serialized invalid Studio JSON as legacy text', () => {
    const onError = vi.fn();
    const onChange = vi.fn();
    const raw = JSON.stringify({ schema: 'vibress-studio', version: 1, root: null });

    render(<VibressStudio value={raw} onError={onError} onChange={onChange} />);

    expect(screen.getByRole('alert')).not.toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    const error = onError.mock.calls[0]?.[0];
    expect(isStudioMigrationError(error)).toBe(true);
    if (isStudioMigrationError(error)) {
      expect(error.rawDocument).toBe(raw);
    }
  });

  it('preserves newer document versions without emitting a downgraded v1 snapshot', () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const newerDocument = {
      schema: 'vibress-studio', version: 2,
      root: { type: 'root', children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Keep newer content', version: 1 }], version: 1 },
      ], version: 1 },
    };

    render(<VibressStudio value={newerDocument} onError={onError} onChange={onChange} />);
    expect(screen.getByRole('alert')).not.toBeNull();
    expect(screen.getByText(/Cannot edit Studio document version 2/)).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    const error = onError.mock.calls[0]?.[0];
    expect(isStudioMigrationError(error)).toBe(true);
    if (isStudioMigrationError(error)) expect(error.rawDocument).toBe(newerDocument);
  });

  it('does not discard unknown future Lexical nodes from a v1 document on save', () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const forwardNodeDocument = {
      schema: 'vibress-studio', version: 1,
      root: { type: 'root', children: [
        { type: 'paragraph', version: 1, children: [
          { type: 'future-rich-node', version: 1, payload: { important: 'retain' } },
        ] },
      ], version: 1 },
    };

    render(<VibressStudio value={forwardNodeDocument} onError={onError} onChange={onChange} />);
    expect(screen.getByRole('alert')).not.toBeNull();
    expect(screen.getByText(/future-rich-node/)).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    const error = onError.mock.calls[0]?.[0];
    expect(isStudioMigrationError(error)).toBe(true);
    if (isStudioMigrationError(error)) expect(error.rawDocument).toBe(forwardNodeDocument);
  });

  it('renders normally when value is genuinely absent (null/undefined)', () => {
    const onError = vi.fn();
    const onChange = vi.fn();

    render(
      <VibressStudio
        value={undefined}
        onError={onError}
        onChange={onChange}
      />
    );

    // Recovery alert should not be rendered
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('recovers cleanly when an invalid value is replaced with a valid document', () => {
    const onError = vi.fn();
    const onChange = vi.fn();

    const invalidValue = { corrupt: true };
    const validValue = createEmptyStudioDocument();

    const { rerender } = render(
      <VibressStudio
        value={invalidValue as unknown as Parameters<typeof VibressStudio>[0]['value']}
        onError={onError}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('alert')).not.toBeNull();

    // Host provides a valid document
    rerender(
      <VibressStudio
        value={validValue}
        onError={onError}
        onChange={onChange}
      />
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
