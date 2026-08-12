import { DecoratorNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';

export type SerializedStudioCardNode = Spread<
  {
    cardType: string;
    cardData: Record<string, unknown>;
  },
  SerializedLexicalNode
>;

/**
 * Generic Lexical node representing a Studio card in the editor. Lives in
 * `studio-nodes` (the Lexical node package) so that server-side renderers
 * (studio-renderer, studio-html, studio-markdown) never import Lexical.
 */
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
    return $createStudioCardNode(serializedNode.cardType, serializedNode.cardData);
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
