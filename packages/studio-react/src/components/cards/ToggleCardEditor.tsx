import { useRef, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { ToggleCardData, StudioCardNode } from '@vibress/studio-cards';
import { sanitizeHtml } from '@vibress/studio-utils';
import { ChevronRight } from 'lucide-react';

interface Props {
  nodeKey: NodeKey;
  cardData: ToggleCardData;
}

/** Presentation heuristic only; all HTML rendering uses the shared sanitizer. */
export function hasToggleHtmlMarkup(content: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(content);
}

/** Apply a rich-source edit only to the version the author inspected. */
export function resolveToggleHtmlSourceEdit(
  current: Record<string, unknown>,
  originalContent: string,
  draft: string,
): Record<string, unknown> | null {
  if (current.content !== originalContent) return null;
  return { ...current, content: sanitizeHtml(draft) };
}

export function ToggleCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [isOpen, setIsOpen] = useState(true);
  const [isPlainTextFocused, setIsPlainTextFocused] = useState(false);
  const [editingHtml, setEditingHtml] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');
  const [htmlBase, setHtmlBase] = useState('');
  const [saveError, setSaveError] = useState('');

  const headingRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const heading = cardData.heading || '';
  const content = cardData.content || '';
  const showHtmlPreview = hasToggleHtmlMarkup(content) && !isPlainTextFocused;

  const updateCardData = (updates: Partial<ToggleCardData>) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode && node.isAttached()) {
        // A heading edit must never overwrite a concurrent content/metadata edit.
        node.setCardData({ ...node.getCardData(), ...updates });
      }
    });
  };

  const beginHtmlEdit = () => {
    setHtmlDraft(content);
    setHtmlBase(content);
    setSaveError('');
    setEditingHtml(true);
  };

  const commitHtmlEdit = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!(node instanceof StudioCardNode) || !node.isAttached()) {
        setSaveError('The toggle was removed. The unsaved source is preserved here.');
        return;
      }
      const current = node.getCardData();
      const update = resolveToggleHtmlSourceEdit(current, htmlBase, htmlDraft);
      if (!update) {
        setSaveError('This toggle changed while you were editing. Copy your source and reopen the editor to avoid overwriting newer work.');
        return;
      }
      node.setCardData(update);
      setEditingHtml(false);
      setSaveError('');
    });
  };

  useEffect(() => {
    if (headingRef.current) {
      headingRef.current.style.height = 'auto';
      headingRef.current.style.height = headingRef.current.scrollHeight + 'px';
    }
  }, [heading]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
    }
  }, [content, isOpen, editingHtml]);

  return (
    <div
      className="vb-toggle-card relative w-full my-3 border border-border/80 dark:border-white/10 rounded-xl bg-card dark:bg-[#1a1c20]/90 backdrop-blur-md text-foreground shadow-sm overflow-hidden"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, textarea, input')) return;
        clearSelection();
        setSelected(true);
        if (!isSelected) event.preventDefault();
      }}
      style={{
        outline: isSelected ? '2px solid #6366f1' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      <div className="flex items-start py-3 px-3.5">
        <button
          type="button"
          aria-label={isOpen ? 'Collapse toggle' : 'Expand toggle'}
          aria-expanded={isOpen}
          className="mt-1 me-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen((open) => !open);
          }}
        >
          <ChevronRight aria-hidden="true" className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        <div className="flex-1 min-w-0">
          <textarea
            ref={headingRef}
            aria-label="Toggle heading"
            value={heading}
            onChange={(event) => updateCardData({ heading: event.target.value })}
            placeholder="Toggle heading..."
            className="w-full text-base font-semibold bg-transparent outline-none resize-none placeholder:text-muted-foreground text-foreground"
            rows={1}
            onKeyDown={(event) => event.stopPropagation()}
          />
          {isOpen && (
            <div className="mt-2 pt-2 border-t border-border/60 dark:border-white/10">
              {editingHtml ? (
                <div>
                  <label htmlFor={`toggle-html-${nodeKey}`} className="block text-xs font-medium mb-1">
                    HTML source (review before applying)
                  </label>
                  <textarea
                    id={`toggle-html-${nodeKey}`}
                    aria-label="Toggle HTML source"
                    value={htmlDraft}
                    onChange={(event) => setHtmlDraft(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="w-full min-h-24 font-mono text-sm bg-transparent border rounded p-2 resize-y"
                    rows={Math.max(3, htmlDraft.split('\n').length)}
                  />
                  {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={(event) => {
                      event.stopPropagation();
                      commitHtmlEdit();
                    }} className="rounded border px-3 py-1 text-sm">Apply HTML changes</button>
                    <button type="button" onClick={(event) => {
                      event.stopPropagation();
                      setEditingHtml(false);
                      setSaveError('');
                    }} className="rounded border px-3 py-1 text-sm">Cancel</button>
                  </div>
                </div>
              ) : showHtmlPreview ? (
                <div>
                  <div className="vb-toggle-rich-preview text-sm" aria-label="Formatted toggle content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
                  <button type="button" className="mt-2 rounded border px-3 py-1 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      beginHtmlEdit();
                    }}>Edit HTML source</button>
                </div>
              ) : (
                <textarea
                  ref={contentRef}
                  aria-label="Toggle content"
                  value={content}
                  onChange={(event) => updateCardData({ content: event.target.value })}
                  onFocus={() => setIsPlainTextFocused(true)}
                  onBlur={() => setIsPlainTextFocused(false)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Toggle content..."
                  className="w-full text-sm text-foreground/90 bg-transparent outline-none resize-none placeholder:text-muted-foreground"
                  rows={2}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
