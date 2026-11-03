/** @deprecated Server consumers: import definitions from @vibress/studio-card-definitions.
 * Keep node and schemas on this entry point for legacy editor consumers.
 */
export * from '@vibress/studio-card-definitions';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-card-definitions';
import { $applyNodeReplacement, DecoratorNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';

// Generic Lexical StudioCardNode for Lexical Editor representation
export type SerializedStudioCardNode = Spread<
  {
    cardType: string;
    cardData: Record<string, unknown>;
  },
  SerializedLexicalNode
>;

export class StudioCardNode extends DecoratorNode<JSX.Element | string> {
  __cardType: string;
  __cardData: Record<string, unknown>;

  static getType(): string {
    return 'studio-card';
  }

  static clone(node: StudioCardNode): StudioCardNode {
    return new StudioCardNode(node.__cardType, node.__cardData, node.__key);
  }

  constructor(cardType: string, cardData: Record<string, unknown>, key?: NodeKey) {
    super(key);
    this.__cardType = cardType;
    this.__cardData = cardData;
  }

  getCardType(): string {
    return this.__cardType;
  }

  getCardData(): Record<string, unknown> {
    return this.__cardData;
  }

  setCardData(cardData: Record<string, unknown>): void {
    const writable = this.getWritable();
    writable.__cardData = cardData;
  }

  exportJSON(): SerializedStudioCardNode {
    return {
      type: 'studio-card',
      cardType: this.__cardType,
      cardData: this.__cardData,
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedStudioCardNode): StudioCardNode {
    // $applyNodeReplacement honors the editor's replacement config (e.g.
    // StudioCardNode -> ReactStudioCardNode). The replacement factory must
    // NOT reuse the original node's key (see $setNodeKey): a fresh key gives
    // the replacement its own node-map entry so it actually renders.
    return $applyNodeReplacement(
      $createStudioCardNode(serializedNode.cardType, serializedNode.cardData)
    ) as StudioCardNode;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = `studio-card studio-card-${this.__cardType}`;
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): JSX.Element | string {
    const def = STUDIO_CARD_DEFINITIONS[this.__cardType];
    if (def) {
      try {
        const validated = def.validate(this.__cardData);
        return def.renderHtml(validated);
      } catch {
        return `[Card: ${this.__cardType}]`;
      }
    }
    return `[Unknown Card: ${this.__cardType}]`;
  }
}

export function $createStudioCardNode(
  cardType: string,
  cardData: Record<string, unknown>
): StudioCardNode {
  return new StudioCardNode(cardType, cardData);
}

export function $isStudioCardNode(node: unknown): node is StudioCardNode {
  return node instanceof StudioCardNode;
}
