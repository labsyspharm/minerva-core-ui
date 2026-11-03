/** True when a key event comes from a field the user is typing in. */
export function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}
