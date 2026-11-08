import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ParagraphNode, TextNode } from 'lexical';
import { StudioCardNode } from '@vibress/studio-cards';
import { CalloutCardEditor } from '../components/cards/CalloutCardEditor';
import { ButtonCardEditor } from '../components/cards/ButtonCardEditor';
import { stripArabicDiacritics, computeSlashOptionRelevance } from '../plugins/slash-menu-filter';

describe('Studio Accessibility, Keyboard & Arabic IME (WCAG 2.2 AA / G3)', () => {
  describe('Callout card accessibility', () => {
    it('exposes accessible labels for icon input and message textarea', () => {
      render(
        <LexicalComposer initialConfig={{
          namespace: 'CalloutA11yTest',
          editable: true,
          nodes: [ParagraphNode, TextNode, StudioCardNode],
          onError: (e) => { throw e; },
        }}>
          <CalloutCardEditor
            nodeKey="callout-a11y"
            cardData={{ emoji: '💡', text: 'ملاحظة هامة للمحررين', backgroundColor: 'blue' }}
          />
        </LexicalComposer>
      );

      const iconInput = screen.getByLabelText('Callout icon');
      expect(iconInput).toBeDefined();
      expect((iconInput as HTMLInputElement).value).toBe('💡');

      const messageTextarea = screen.getByLabelText('Callout text');
      expect(messageTextarea).toBeDefined();
      expect((messageTextarea as HTMLTextAreaElement).value).toBe('ملاحظة هامة للمحررين');
    });
  });

  describe('Button card accessibility & dialog management', () => {
    it('exposes accessible trigger button and settings dialog with labeled inputs', () => {
      render(
        <LexicalComposer initialConfig={{
          namespace: 'ButtonA11yTest',
          editable: true,
          nodes: [ParagraphNode, TextNode, StudioCardNode],
          onError: (e) => { throw e; },
        }}>
          <ButtonCardEditor
            nodeKey="button-a11y"
            cardData={{ text: 'انقر هنا', url: 'https://example.com', alignment: 'center' }}
          />
        </LexicalComposer>
      );

      const triggerBtn = screen.getByRole('button', { name: /انقر هنا/i });
      expect(triggerBtn).toBeDefined();
      expect(triggerBtn.getAttribute('aria-haspopup')).toBe('dialog');
      expect(triggerBtn.getAttribute('aria-expanded')).toBe('false');

      // Click to open settings popover
      act(() => {
        fireEvent.click(triggerBtn);
      });
      expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');

      const dialog = screen.getByRole('dialog', { name: 'Button settings' });
      expect(dialog).toBeDefined();

      const textInput = screen.getByLabelText('Button Text');
      expect(textInput).toBeDefined();
      expect((textInput as HTMLInputElement).value).toBe('انقر هنا');

      const urlInput = screen.getByLabelText('Button URL');
      expect(urlInput).toBeDefined();
      expect((urlInput as HTMLInputElement).value).toBe('https://example.com');
    });
  });

  describe('Arabic IME & Diacritics Normalization', () => {
    it('strips Arabic tashkeel/diacritical marks reliably', () => {
      expect(stripArabicDiacritics('صُورَةٌ')).toBe('صورة');
      expect(stripArabicDiacritics('عُنْوَانٌ فَرْعِيّ')).toBe('عنوان فرعي');
      expect(stripArabicDiacritics('كِتَابَة')).toBe('كتابة');
      expect(stripArabicDiacritics('قَائِمَة')).toBe('قائمة');
    });

    it('matches slash commands regardless of user tashkeel input', () => {
      const option = {
        title: 'Image',
        cardType: 'image',
        keywords: ['صورة', 'صوره', 'photo'],
      };

      // User types "/صُورَة" with damma, fatha, tanwin
      const scoreWithTashkeel = computeSlashOptionRelevance(option, 'صُورَة');
      expect(scoreWithTashkeel).toBeGreaterThan(0);

      // User types plain "/صورة"
      const scorePlain = computeSlashOptionRelevance(option, 'صورة');
      expect(scorePlain).toBeGreaterThan(0);
      expect(scoreWithTashkeel).toBe(scorePlain);
    });

    it('matches bilingual heading actions with complex Arabic vowelization', () => {
      const headingOption = {
        title: 'Heading 1',
        actionType: 'h1',
        keywords: ['عنوان', 'رئيسي', 'heading', 'h1'],
      };

      expect(computeSlashOptionRelevance(headingOption, 'عُنْوَان')).toBeGreaterThan(0);
      expect(computeSlashOptionRelevance(headingOption, 'رَئِيسِيّ')).toBeGreaterThan(0);
    });
  });
});
