// Native selects can retain :focus-visible after a mouse or touch selection.
// Track input method once for all controls, including controls in dialogs.
export function initializeFocus() {
  const root = document.documentElement;
  root.dataset.focusInput = 'pointer';
  document.addEventListener(
    'pointerdown',
    () => {
      root.dataset.focusInput = 'pointer';
    },
    true,
  );
  document.addEventListener(
    'keydown',
    event => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        root.dataset.focusInput = 'keyboard';
      }
    },
    true,
  );
}
