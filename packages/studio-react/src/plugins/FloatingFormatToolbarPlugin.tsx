import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $patchStyleText } from '@lexical/selection';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  ChevronDown,
  Palette,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
} from 'lucide-react';
import { turnSelectedBlockInto, TurnIntoType } from './TurnIntoHelper';
import { FloatingLinkEditorPopover } from '../components/ui/FloatingLinkEditorPopover';

const NOTION_COLORS = [
  { name: 'Default', color: 'inherit', bg: 'transparent' },
  { name: 'Gray', color: '#64748b', bg: '#f1f5f9' },
  { name: 'Brown', color: '#92400e', bg: '#fef3c7' },
  { name: 'Orange', color: '#c2410c', bg: '#ffedd5' },
  { name: 'Yellow', color: '#a16207', bg: '#fef9c3' },
  { name: 'Green', color: '#15803d', bg: '#dcfce7' },
  { name: 'Blue', color: '#1d4ed8', bg: '#dbeafe' },
  { name: 'Purple', color: '#7e22ce', bg: '#f3e8ff' },
  { name: 'Pink', color: '#be185d', bg: '#fce7f3' },
  { name: 'Red', color: '#b91c1c', bg: '#fee2e2' },
];

function getDOMRangeRect(nativeSelection: Selection): DOMRect | null {
  if (nativeSelection.rangeCount === 0) return null;
  const domRange = nativeSelection.getRangeAt(0);
  const rect = domRange.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return rect;
}

function setFloatingElemPosition(targetRect: DOMRect | null, floatingElem: HTMLElement): void {
  if (targetRect === null) {
    floatingElem.style.opacity = '0';
    floatingElem.style.transform = 'translate(-10000px, -10000px)';
    return;
  }

  const floatingElemRect = floatingElem.getBoundingClientRect();
  let top = targetRect.top + window.scrollY - floatingElemRect.height - 10;
  let left = targetRect.left + window.scrollX + targetRect.width / 2 - floatingElemRect.width / 2;

  // Prevent overflowing viewport
  if (left < 10) left = 10;
  if (left + floatingElemRect.width > window.innerWidth - 10) {
    left = window.innerWidth - floatingElemRect.width - 10;
  }
  if (top < 10) {
    top = targetRect.bottom + window.scrollY + 10; // flip below if at top
  }

  floatingElem.style.opacity = '1';
  floatingElem.style.transform = `translate(${left}px, ${top}px)`;
}

export function FloatingFormatToolbarPlugin({ anchorElem = document.body }: { anchorElem?: HTMLElement }) {
  const [editor] = useLexicalComposerContext();
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'turnInto' | 'color' | null>(null);

  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePopup = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) ||
          rootElement === null ||
          !rootElement.contains(nativeSelection.anchorNode) ||
          nativeSelection.isCollapsed)
      ) {
        setIsTextSelected(false);
        setIsLinkEditorOpen(false);
        return;
      }

      setIsTextSelected(true);
      if ($isRangeSelection(selection)) {
        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
        setIsStrikethrough(selection.hasFormat('strikethrough'));
        setIsCode(selection.hasFormat('code'));

        // Check if selection is within a link
        const node = selection.anchor.getNode();
        const parent = node.getParent();
        if ($isLinkNode(parent)) {
          setIsLink(true);
          setCurrentLinkUrl(parent.getURL());
        } else if ($isLinkNode(node)) {
          setIsLink(true);
          setCurrentLinkUrl(node.getURL());
        } else {
          setIsLink(false);
          setCurrentLinkUrl('');
        }
      }
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener('selectionchange', updatePopup);
    return () => {
      document.removeEventListener('selectionchange', updatePopup);
    };
  }, [updatePopup]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      updatePopup();
    });
  }, [editor, updatePopup]);

  useEffect(() => {
    if (isTextSelected && toolbarRef.current) {
      const nativeSelection = window.getSelection();
      if (nativeSelection && !nativeSelection.isCollapsed) {
        const rootElement = editor.getRootElement();
        if (rootElement) {
          const rect = getDOMRangeRect(nativeSelection);
          setFloatingElemPosition(rect, toolbarRef.current);
        }
      }
    }
  }, [isTextSelected, anchorElem, editor, updatePopup, isLinkEditorOpen, openDropdown]);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLinkEditorOpen) {
          setIsLinkEditorOpen(false);
        } else if (openDropdown) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLinkEditorOpen, openDropdown]);

  if (!isTextSelected) {
    return null;
  }

  const handleTurnInto = (type: TurnIntoType) => {
    turnSelectedBlockInto(editor, type);
    setOpenDropdown(null);
  };

  const handleApplyColor = (color: string, bg: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          color: color === 'inherit' ? null : color,
          'background-color': bg === 'transparent' ? null : bg,
        });
      }
    });
    setOpenDropdown(null);
  };

  const handleLinkSubmit = (url: string) => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    setIsLinkEditorOpen(false);
  };

  const handleLinkRemove = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    setIsLinkEditorOpen(false);
  };

  return createPortal(
    <div
      ref={toolbarRef}
      className="notion-floating-format-popup"
      role="toolbar"
      aria-label="Text formatting toolbar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        opacity: 0,
        backgroundColor: 'var(--vb-studio-popover, #1e293b)',
        color: 'var(--vb-studio-popover-foreground, #f8fafc)',
        borderRadius: 'var(--vb-studio-radius-md, 8px)',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        boxShadow: 'var(--vb-studio-shadow-popover, 0 10px 25px -5px rgba(0, 0, 0, 0.3))',
        border: '1px solid var(--vb-studio-border, rgba(255, 255, 255, 0.12))',
        transition: 'opacity 0.15s ease-in-out',
        zIndex: 150,
        pointerEvents: 'auto',
      }}
    >
      {isLinkEditorOpen ? (
        <FloatingLinkEditorPopover
          initialUrl={currentLinkUrl}
          onApply={handleLinkSubmit}
          onRemove={handleLinkRemove}
          onCancel={() => setIsLinkEditorOpen(false)}
        />
      ) : (
        <>
          {/* Turn into selector */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="notion-format-btn"
              onClick={() => setOpenDropdown(openDropdown === 'turnInto' ? null : 'turnInto')}
              aria-haspopup="menu"
              aria-expanded={openDropdown === 'turnInto'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--vb-studio-foreground, #f8fafc)',
              }}
            >
              <span>Turn into</span>
              <ChevronDown size={12} />
            </button>

            {openDropdown === 'turnInto' && (
              <div
                className="studio-glassy-menu"
                role="menu"
                style={{
                  position: 'absolute',
                  top: '32px',
                  left: 0,
                  backgroundColor: 'var(--vb-studio-popover, #1e293b)',
                  border: '1px solid var(--vb-studio-border, #334155)',
                  borderRadius: 'var(--vb-studio-radius-md, 8px)',
                  padding: '4px',
                  width: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 200,
                  boxShadow: 'var(--vb-studio-shadow-popover, 0 10px 15px -3px rgba(0, 0, 0, 0.3))',
                }}
              >
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('paragraph')}>Text</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('h1')}><Heading1 size={13} /> Heading 1</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('h2')}><Heading2 size={13} /> Heading 2</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('h3')}><Heading3 size={13} /> Heading 3</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('check-list')}><CheckSquare size={13} /> To-do list</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('bullet-list')}><List size={13} /> Bullet list</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('number-list')}><ListOrdered size={13} /> Numbered list</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('quote')}><Quote size={13} /> Quote</button>
                <button className="notion-format-btn" style={dropdownItemStyle} onClick={() => handleTurnInto('code')}><Code size={13} /> Code</button>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--vb-studio-border, #334155)', margin: '0 2px' }} />

          {/* Formatting buttons */}
          <button
            type="button"
            title="Bold (Ctrl+B)"
            aria-label="Bold"
            aria-pressed={isBold}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
            className={`notion-format-btn ${isBold ? 'is-active' : ''}`}
            style={getFormatBtnStyle(isBold)}
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            title="Italic (Ctrl+I)"
            aria-label="Italic"
            aria-pressed={isItalic}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
            className={`notion-format-btn ${isItalic ? 'is-active' : ''}`}
            style={getFormatBtnStyle(isItalic)}
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            title="Underline (Ctrl+U)"
            aria-label="Underline"
            aria-pressed={isUnderline}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
            className={`notion-format-btn ${isUnderline ? 'is-active' : ''}`}
            style={getFormatBtnStyle(isUnderline)}
          >
            <Underline size={14} />
          </button>
          <button
            type="button"
            title="Strikethrough"
            aria-label="Strikethrough"
            aria-pressed={isStrikethrough}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
            className={`notion-format-btn ${isStrikethrough ? 'is-active' : ''}`}
            style={getFormatBtnStyle(isStrikethrough)}
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            title="Inline Code"
            aria-label="Inline Code"
            aria-pressed={isCode}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
            className={`notion-format-btn ${isCode ? 'is-active' : ''}`}
            style={getFormatBtnStyle(isCode)}
          >
            <Code size={14} />
          </button>
          <button
            type="button"
            title={isLink ? 'Edit Link' : 'Add Link'}
            aria-label={isLink ? 'Edit Link' : 'Add Link'}
            aria-pressed={isLink}
            onClick={() => setIsLinkEditorOpen(true)}
            className={`notion-format-btn ${isLink ? 'is-active' : ''}`}
            style={getFormatBtnStyle(isLink)}
          >
            <LinkIcon size={14} />
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--vb-studio-border, #334155)', margin: '0 2px' }} />

          {/* Color Palette */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              title="Text & Highlight Color"
              aria-label="Text & Highlight Color"
              aria-haspopup="menu"
              aria-expanded={openDropdown === 'color'}
              onClick={() => setOpenDropdown(openDropdown === 'color' ? null : 'color')}
              className={`notion-format-btn ${openDropdown === 'color' ? 'is-active' : ''}`}
              style={{
                padding: '4px 6px',
                color: 'var(--vb-studio-foreground, #f8fafc)',
              }}
            >
              <Palette size={14} />
            </button>

            {openDropdown === 'color' && (
              <div
                className="studio-glassy-menu"
                role="menu"
                aria-label="Color options"
                style={{
                  position: 'absolute',
                  top: '32px',
                  right: 0,
                  backgroundColor: 'var(--vb-studio-popover, #1e293b)',
                  border: '1px solid var(--vb-studio-border, #334155)',
                  borderRadius: 'var(--vb-studio-radius-md, 8px)',
                  padding: '6px',
                  width: '180px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '4px',
                  zIndex: 200,
                  boxShadow: 'var(--vb-studio-shadow-popover, 0 10px 15px -3px rgba(0, 0, 0, 0.3))',
                }}
              >
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => handleApplyColor(c.color, c.bg)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: '1px solid var(--vb-studio-border, #475569)',
                      backgroundColor: c.bg === 'transparent' ? 'var(--vb-studio-surface, #ffffff)' : c.bg,
                      color: c.color === 'inherit' ? 'var(--vb-studio-foreground, #000000)' : c.color,
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    A
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    anchorElem
  );
}

function getFormatBtnStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? 'var(--vb-studio-primary, #38bdf8)' : 'var(--vb-studio-foreground, #f8fafc)',
    backgroundColor: active ? 'var(--vb-studio-surface-muted, rgba(255, 255, 255, 0.1))' : 'transparent',
    minWidth: '28px',
    height: '28px',
    padding: '0 6px',
  };
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 8px',
  borderRadius: '4px',
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--vb-studio-foreground, #f8fafc)',
  width: '100%',
};
