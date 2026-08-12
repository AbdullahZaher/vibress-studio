import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, NodeKey } from 'lexical';

interface CardErrorBoundaryProps {
  nodeKey: NodeKey;
  children: React.ReactNode;
}

interface CardErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches a crash inside a single card editor so the rest of the editor
 * keeps working. The fallback offers to remove the broken card.
 */
export class CardErrorBoundary extends React.Component<
  CardErrorBoundaryProps,
  CardErrorBoundaryState
> {
  state: CardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Log safely (never leak card data into the log message).
    console.error('Vibress Studio: card editor crashed', {
      card: 'unknown',
      nodeKey: this.props.nodeKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <BrokenCardFallback
        nodeKey={this.props.nodeKey}
        onReset={() => this.setState({ hasError: false })}
      />
    );
  }
}

function BrokenCardFallback({
  nodeKey,
  onReset,
}: {
  nodeKey: NodeKey;
  onReset: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  const removeCard = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  };

  return (
    <div
      role="alert"
      className="relative w-full mb-4 border border-red-300 bg-red-50 rounded-md p-4 text-sm text-red-700"
    >
      <p className="font-medium mb-2">This card could not be rendered.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={removeCard}
          className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700"
        >
          Remove card
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-md text-xs font-medium hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
