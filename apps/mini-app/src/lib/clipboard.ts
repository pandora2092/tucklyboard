export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Older embedded browsers may allow the synchronous copy command instead.
  }
  const previous = document.activeElement;
  const input = document.createElement('textarea');
  input.value = value;
  input.readOnly = true;
  input.setAttribute('aria-hidden', 'true');
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input.remove();
    if (previous instanceof HTMLElement && previous.isConnected) {
      previous.focus({ preventScroll: true });
    }
  }
}
