import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  $getNearestNodeFromDOMNode,
  $createParagraphNode,
  $isRootOrShadowRoot,
  $isElementNode,
  LexicalNode,
} from 'lexical';
import { createPortal } from 'react-dom';
import {
  Plus,
  GripVertical,
  Copy,
  Trash2,
  Palette,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
} from 'lucide-react';
import { turnSelectedBlockInto, TurnIntoType } from './TurnIntoHelper';
import { $deepCloneNode } from '../utils/cloneNode';

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

export function BlockHandleGutterPlugin({ anchorElem = document.body }: { anchorElem?: HTMLElement }) {
  const [editor] = useLexicalComposerContext();
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<'turnInto' | 'color' | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Track hovered element
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (showMenu) return; // keep handle stable when menu is open

      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      const target = event.target as HTMLElement | null;
      if (!target || !rootElement.contains(target)) {
        if (handleRef.current && handleRef.current.contains(target)) {
          return;
        }
        setHoveredNodeKey(null);
        setTargetRect(null);
        return;
      }

      // Resolve the nearest Lexical node from the actual hover target.
      // A paragraph can be nested under a block decorator, so relying on
      // the first direct DOM child of root is not sufficient.
      // This DOM-to-node helper requires an active editor in Lexical 0.13.
      // EditorState.read deliberately clears that context; use a transaction
      // with no document mutation instead.
      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(target);
        if (!node) return;
        let topNode: LexicalNode = node;
        while (topNode.getParent() && !$isRootOrShadowRoot(topNode.getParent())) {
          const parent = topNode.getParent();
          if (parent) topNode = parent;
        }
        const blockElement = editor.getElementByKey(topNode.getKey());
        if (blockElement) {
          setHoveredNodeKey(topNode.getKey());
          setTargetRect(blockElement.getBoundingClientRect());
        }
      });
    },
    [editor, showMenu]
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  // A selection-based fallback keeps the block handle discoverable for
  // keyboard users and when DOM pointer events originate from nested editor
  // decorations. This uses only the supported public Lexical APIs.
  useEffect(() => editor.registerCommand(
    SELECTION_CHANGE_COMMAND,
    () => {
      if (showMenu) return false;
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;
      let node: LexicalNode = selection.anchor.getNode();
      while (node.getParent() && !$isRootOrShadowRoot(node.getParent())) {
        const parent = node.getParent();
        if (parent) node = parent;
      }
      const element = editor.getElementByKey(node.getKey());
      if (element && editor.getRootElement()?.contains(element)) {
        setHoveredNodeKey(node.getKey());
        setTargetRect(element.getBoundingClientRect());
      }
      return false;
    },
    COMMAND_PRIORITY_LOW,
  ), [editor, showMenu]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        handleRef.current &&
        !handleRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
        setActiveSubMenu(null);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Keyboard navigation & dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMenu) {
        setShowMenu(false);
        setActiveSubMenu(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMenu]);

  if (!targetRect || !hoveredNodeKey) {
    return null;
  }

  const handleInsertBelow = () => {
    editor.update(() => {
      const node = $getNodeByKey(hoveredNodeKey);
      if (node) {
        const paragraph = $createParagraphNode();
        node.insertAfter(paragraph);
        paragraph.select();
      }
    });
    editor.focus();
    setShowMenu(false);
  };

  /**
   * Fix STU-002: Clones the complete Lexical node and its children/state,
   * maintaining selection and undo/redo capabilities.
   */
  const handleDuplicate = () => {
    editor.update(() => {
      const node = $getNodeByKey(hoveredNodeKey);
      if (node) {
        const cloned = $deepCloneNode(node);
        node.insertAfter(cloned);
        if ('selectEnd' in cloned && typeof (cloned as { selectEnd?: () => void }).selectEnd === 'function') {
          (cloned as { selectEnd: () => void }).selectEnd();
        } else if ('select' in cloned && typeof (cloned as { select?: () => void }).select === 'function') {
          (cloned as { select: () => void }).select();
        }
      }
    });
    editor.focus();
    setShowMenu(false);
  };

  const handleMoveUp = () => {
    editor.update(() => {
      const node = $getNodeByKey(hoveredNodeKey);
      if (node) {
        const prev = node.getPreviousSibling();
        if (prev) {
          prev.insertBefore(node);
          if ('select' in node && typeof (node as { select?: () => void }).select === 'function') {
            (node as { select: () => void }).select();
          }
        }
      }
    });
    editor.focus();
    setShowMenu(false);
  };

  const handleMoveDown = () => {
    editor.update(() => {
      const node = $getNodeByKey(hoveredNodeKey);
      if (node) {
        const next = node.getNextSibling();
        if (next) {
          next.insertAfter(node);
          if ('select' in node && typeof (node as { select?: () => void }).select === 'function') {
            (node as { select: () => void }).select();
          }
        }
      }
    });
    editor.focus();
    setShowMenu(false);
  };

  const handleDelete = () => {
    editor.update(() => {
      const node = $getNodeByKey(hoveredNodeKey);
      if (node) {
        node.remove();
      }
    });
    editor.focus();
    setShowMenu(false);
    setHoveredNodeKey(null);
    setTargetRect(null);
  };

  const handleTurnInto = (type: TurnIntoType) => {
    turnSelectedBlockInto(editor, type, hoveredNodeKey ?? undefined);
    editor.focus();
    setShowMenu(false);
    setActiveSubMenu(null);
  };

  /**
   * Fix STU-003: Sets durable style attributes directly on Lexical TextNodes,
   * persisting across undo/redo, document serialization, and reload.
   */
  const handleApplyColor = (color: string, bg: string) => {
    editor.update(() => {
      const node = $getNodeByKey(hoveredNodeKey);
      if (node && $isElementNode(node)) {
        const textNodes = node.getAllTextNodes();
        for (const t of textNodes) {
          const curStyle = t.getStyle();
          const styleMap: Record<string, string> = {};
          if (curStyle) {
            curStyle.split(';').forEach((pair: string) => {
              const [k, v] = pair.split(':').map((s: string) => s?.trim());
              if (k && v) styleMap[k] = v;
            });
          }
          if (color !== 'inherit') styleMap['color'] = color;
          else delete styleMap['color'];
          if (bg !== 'transparent') styleMap['background-color'] = bg;
          else delete styleMap['background-color'];

          const newStyle = Object.entries(styleMap)
            .map(([k, v]) => `${k}: ${v}`)
            .join(';');
          t.setStyle(newStyle);
        }
      }
    });
    setShowMenu(false);
    setActiveSubMenu(null);
  };

  const rootElement = editor.getRootElement();
  const isRtl = rootElement?.dir === 'rtl' || document.documentElement.dir === 'rtl';

  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const scrollX = window.visualViewport?.pageLeft ?? window.scrollX;
  const scrollY = window.visualViewport?.pageTop ?? window.scrollY;

  const topPos = targetRect.top + scrollY;
  const leftPos = isRtl
    ? Math.min(scrollX + viewportWidth - 68, targetRect.right + scrollX + 8)
    : Math.max(scrollX + 8, targetRect.left + scrollX - 58);

  return createPortal(
    <div
      ref={handleRef}
      className="notion-block-handle-gutter"
      style={{
        position: 'absolute',
        top: `${topPos + 2}px`,
        left: `${leftPos}px`,
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        zIndex: 50,
        opacity: 0.9,
      }}
    >
      <button
        type="button"
        title="Click to add a block below"
        aria-label="Click to add a block below"
        onClick={handleInsertBelow}
        className="notion-block-handle-btn"
      >
        <Plus size={15} />
      </button>

      <button
        type="button"
        title="Click for block actions (move up, move down, color, duplicate, delete)"
        aria-label="Block actions"
        aria-haspopup="menu"
        aria-expanded={showMenu}
        onClick={() => setShowMenu(!showMenu)}
        className="notion-block-handle-btn"
        style={{
          cursor: 'pointer',
          backgroundColor: showMenu ? 'var(--vb-studio-surface-muted, #e2e8f0)' : 'transparent',
        }}
      >
        <GripVertical size={16} />
      </button>

      {/* Notion-style Block Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="notion-block-menu studio-glassy-menu"
          role="menu"
          aria-label="Block actions"
          style={{
            position: 'absolute',
            top: '32px',
            left: isRtl ? 'auto' : '0px',
            right: isRtl ? '0px' : 'auto',
            width: '220px',
            maxWidth: 'calc(100vw - 24px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '6px',
            backgroundColor: 'var(--vb-studio-popover, #ffffff)',
            color: 'var(--vb-studio-popover-foreground, #0f172a)',
            border: '1px solid var(--vb-studio-border, #e2e8f0)',
            borderRadius: 'var(--vb-studio-radius-lg, 12px)',
            boxShadow: 'var(--vb-studio-shadow-popover, 0 12px 32px -4px rgba(0,0,0,0.12))',
          }}
        >
          <div className="studio-slash-header">Block Actions</div>

          {/* Move Up / Move Down (WCAG 2.5.7 non-drag alternative) */}
          <button type="button" style={menuItemStyle} onClick={handleMoveUp}>
            <ArrowUp size={14} />
            <span>Move up</span>
          </button>

          <button type="button" style={menuItemStyle} onClick={handleMoveDown}>
            <ArrowDown size={14} />
            <span>Move down</span>
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--vb-studio-border, #e2e8f0)', margin: '4px 0' }} />

          <button
            type="button"
            style={menuItemStyle}
            onClick={() => setActiveSubMenu(activeSubMenu === 'turnInto' ? null : 'turnInto')}
            aria-haspopup="menu"
            aria-expanded={activeSubMenu === 'turnInto'}
          >
            <Sparkles size={14} />
            <span>Turn into</span>
            <span style={{ marginInlineStart: 'auto', fontSize: '11px', color: 'var(--vb-studio-foreground-subtle, #94a3b8)' }}>›</span>
          </button>

          {activeSubMenu === 'turnInto' && (
            <div style={subMenuContainerStyle} role="menu">
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('paragraph')}>Text (Paragraph)</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('h1')}><Heading1 size={13} /> Heading 1</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('h2')}><Heading2 size={13} /> Heading 2</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('h3')}><Heading3 size={13} /> Heading 3</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('check-list')}><CheckSquare size={13} /> To-do list</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('bullet-list')}><List size={13} /> Bulleted list</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('number-list')}><ListOrdered size={13} /> Numbered list</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('quote')}><Quote size={13} /> Quote</button>
              <button style={subMenuItemStyle} onClick={() => handleTurnInto('code')}><Code size={13} /> Code block</button>
            </div>
          )}

          <button
            type="button"
            style={menuItemStyle}
            onClick={() => setActiveSubMenu(activeSubMenu === 'color' ? null : 'color')}
            aria-haspopup="menu"
            aria-expanded={activeSubMenu === 'color'}
          >
            <Palette size={14} />
            <span>Color & Highlight</span>
            <span style={{ marginInlineStart: 'auto', fontSize: '11px', color: 'var(--vb-studio-foreground-subtle, #94a3b8)' }}>›</span>
          </button>

          {activeSubMenu === 'color' && (
            <div style={subMenuContainerStyle} role="menu">
              <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted, #94a3b8)' }}>Colors</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', padding: '4px 6px' }}>
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => handleApplyColor(c.color, c.bg)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '4px',
                      border: '1px solid var(--vb-studio-border, #e2e8f0)',
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
            </div>
          )}

          <div style={{ height: '1px', backgroundColor: 'var(--vb-studio-border, #e2e8f0)', margin: '4px 0' }} />

          <button type="button" style={menuItemStyle} onClick={handleDuplicate}>
            <Copy size={14} />
            <span>Duplicate</span>
          </button>

          <button type="button" style={{ ...menuItemStyle, color: 'var(--vb-studio-danger, #ef4444)' }} onClick={handleDelete}>
            <Trash2 size={14} />
            <span>Delete block</span>
          </button>
        </div>
      )}
    </div>,
    anchorElem
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '6px 8px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'start',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--vb-studio-foreground, #334155)',
  transition: 'background-color 0.15s ease',
};

const subMenuContainerStyle: React.CSSProperties = {
  backgroundColor: 'var(--vb-studio-surface-muted, #f8fafc)',
  border: '1px solid var(--vb-studio-border, #e2e8f0)',
  borderRadius: '6px',
  padding: '4px',
  marginTop: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const subMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 8px',
  borderRadius: '4px',
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'start',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--vb-studio-foreground, #0f172a)',
};
