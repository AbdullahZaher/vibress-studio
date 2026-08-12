/**
 * Card selection helper.
 *
 * Clicking a card selects it via Lexical node selection, but Lexical
 * reconciles the DOM selection asynchronously after clicks on
 * `contenteditable="false"` decorator regions and can null the editor
 * selection. Re-asserting on the next tick makes the card selection stick
 * (verified by the Playwright E2E suite).
 */
export function assertCardSelection(
  clearSelection: () => void,
  setSelected: (v: boolean) => void
): void {
  const select = (): void => {
    clearSelection();
    setSelected(true);
  };
  select();
  window.setTimeout(select, 0);
}
