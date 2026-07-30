/* Small utility to lock body scroll and compensate for scrollbar disappearance
   using padding-right fallback when `scrollbar-gutter` is not supported.
*/
const KEY = '__ars_body_scroll_lock_count';

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  const doc: any = document;
  const prev = doc[KEY] || 0;
  doc[KEY] = prev + 1;

  if (prev === 0) {
    // If browser doesn't support stable scrollbar gutter, add padding compensation
    const supportsGutter = typeof CSS !== 'undefined' && (CSS as any).supports && (CSS as any).supports('scrollbar-gutter', 'stable');
    if (!supportsGutter) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        const body = document.body;
        const currentPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
        body.setAttribute('data-ars-scroll-padding', String(currentPadding));
      }
    }
    document.body.style.overflow = 'hidden';
  }
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  const doc: any = document;
  const prev = doc[KEY] || 0;
  const next = Math.max(0, prev - 1);
  doc[KEY] = next;

  if (next === 0) {
    document.body.style.overflow = '';
    const body = document.body;
    const prevPadding = body.getAttribute('data-ars-scroll-padding');
    if (prevPadding != null) {
      body.style.paddingRight = prevPadding;
      body.removeAttribute('data-ars-scroll-padding');
    } else {
      body.style.paddingRight = '';
    }
  }
}

export function isScrollLocked() {
  if (typeof document === 'undefined') return false;
  const doc: any = document;
  return (doc[KEY] || 0) > 0;
}
