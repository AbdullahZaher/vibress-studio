export function MediaPickerError({ onRetry, onDismiss }: { onRetry: () => void; onDismiss: () => void }) {
  return <div role="alert">Could not select media. Existing media was preserved.
    <button type="button" onClick={onRetry}>Retry media selection</button>
    <button type="button" onClick={onDismiss}>Dismiss</button>
  </div>;
}
