import React, { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isNodeSelection } from 'lexical';
import { createPortal } from 'react-dom';
import { $isReactStudioCardNode, ReactStudioCardNode } from '../nodes/ReactStudioCardNode';
import { Trash2, Maximize2, Minimize2, Move } from 'lucide-react';

export function FloatingCardActionToolbarPlugin({ anchorElem = document.body }: { anchorElem?: HTMLElement }) {
  const [editor] = useLexicalComposerContext();
  const [selectedNode, setSelectedNode] = useState<ReactStudioCardNode | null>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          if (nodes.length === 1 && $isReactStudioCardNode(nodes[0])) {
            const card = nodes[0] as ReactStudioCardNode;
            setSelectedNode(card);
            const dom = editor.getElementByKey(card.getKey());
            if (dom) {
              setCardRect(dom.getBoundingClientRect());
            }
            return;
          }
        }
        setSelectedNode(null);
        setCardRect(null);
      });
    });
  }, [editor]);

  if (!selectedNode) return null;

  const currentWidth = (selectedNode.getCardData().width as string) || 'regular';

  const handleWidthChange = (width: 'regular' | 'wide' | 'full') => {
    editor.update(() => {
      const data = selectedNode.getCardData();
      selectedNode.setCardData({ ...data, width });
    });
  };

  const handleDelete = () => {
    editor.update(() => {
      selectedNode.remove();
    });
    setSelectedNode(null);
  };

  const isRtl = editor.getRootElement()?.dir === 'rtl' || document.documentElement.dir === 'rtl';
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const scrollX = window.visualViewport?.pageLeft ?? window.scrollX;
  const scrollY = window.visualViewport?.pageTop ?? window.scrollY;

  let topPos = cardRect ? cardRect.top + scrollY - 36 : scrollY + 20;
  if (topPos < scrollY + 8 && cardRect) {
    topPos = cardRect.bottom + scrollY + 8;
  }

  let leftPos = cardRect
    ? (isRtl ? cardRect.right + scrollX - 220 : cardRect.left + scrollX)
    : scrollX + 20;

  const minLeft = scrollX + 8;
  const maxLeft = scrollX + viewportWidth - 228;
  if (leftPos > maxLeft) leftPos = maxLeft;
  if (leftPos < minLeft) leftPos = minLeft;

  return createPortal(
    <div
      className="floating-card-action-popup studio-glassy-menu animate-in fade-in zoom-in-95 duration-150"
      role="toolbar"
      aria-label="Card actions"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons || buttons.length === 0) return;
          const btnArray = Array.from(buttons);
          const currentIndex = btnArray.indexOf(document.activeElement as HTMLButtonElement);
          if (currentIndex === -1) return;
          e.preventDefault();
          const nextIndex =
            e.key === 'ArrowRight'
              ? (currentIndex + 1) % btnArray.length
              : (currentIndex - 1 + btnArray.length) % btnArray.length;
          btnArray[nextIndex]?.focus();
        } else if (e.key === 'Escape') {
          editor.getRootElement()?.focus();
        }
      }}
      style={{
        position: 'absolute',
        top: `${Math.round(topPos)}px`,
        left: `${Math.round(leftPos)}px`,
        maxWidth: 'calc(100vw - 16px)',
        backgroundColor: 'rgba(21, 23, 26, 0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        color: '#f8fafc',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '10px',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        zIndex: 160,
        fontSize: '12px',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', paddingRight: '4px', letterSpacing: '0.05em' }}>
        {selectedNode.getCardType()}
      </span>

      <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.12)', margin: '0 2px' }} />

      <button
        type="button"
        onClick={() => handleWidthChange('regular')}
        style={getBtnStyle(currentWidth === 'regular')}
        title="Regular width"
        aria-label="Regular width"
        aria-pressed={currentWidth === "regular"}
      >
        <Minimize2 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => handleWidthChange('wide')}
        style={getBtnStyle(currentWidth === 'wide')}
        title="Wide width"
        aria-label="Wide width"
        aria-pressed={currentWidth === "wide"}
      >
        <Move size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => handleWidthChange('full')}
        style={getBtnStyle(currentWidth === 'full')}
        title="Full screen width"
        aria-label="Full screen width"
        aria-pressed={currentWidth === "full"}
      >
        <Maximize2 size={14} aria-hidden="true" />
      </button>

      <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.12)', margin: '0 2px' }} />

      <button
        type="button"
        onClick={handleDelete}
        aria-label="Delete card"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#f87171',
          padding: '4px 7px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          fontWeight: 500,
          transition: 'all 0.15s ease',
        }}
      >
        <Trash2 size={12} /> Delete
      </button>
    </div>,
    anchorElem
  );
}

function getBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
    color: active ? '#60a5fa' : '#e2e8f0',
    border: 'none',
    padding: '4px 7px',
    minWidth: '32px',
    minHeight: '32px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
  };
}
