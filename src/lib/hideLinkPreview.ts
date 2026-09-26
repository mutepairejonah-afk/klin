// Browsers show a link's destination at the bottom of the window when you
// hover it. That's the native status-bar preview — nothing in this app
// renders it, so it can't be styled or hidden with CSS; the only way to
// suppress it is to not have a real `href` present during a plain hover.
//
// This does that without breaking real navigation: the href is restored
// the instant there's an actual interaction — mousedown (covers left,
// middle, and right click, all of which fire mousedown first) or focusin
// (covers Tab+Enter and screen readers) — so "open in new tab", "copy
// link address", and keyboard/AT use all still see the real destination.
// Only a bare mouse hover with no interaction yet gets the href blanked.
const REAL_HREF = 'data-real-href';

function hide(a: HTMLAnchorElement) {
  if (a.hasAttribute(REAL_HREF)) return;
  const href = a.getAttribute('href');
  if (!href) return;
  a.setAttribute(REAL_HREF, href);
  a.removeAttribute('href');
}

function restore(a: HTMLAnchorElement) {
  const href = a.getAttribute(REAL_HREF);
  if (href == null) return;
  a.setAttribute('href', href);
  a.removeAttribute(REAL_HREF);
}

function closestAnchor(target: EventTarget | null, selector: string): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>(selector);
}

let installed = false;

export function installLinkPreviewGuard() {
  if (installed) return; // StrictMode double-invokes effects; guard against double-binding.
  installed = true;

  document.addEventListener('mouseover', (e) => {
    const a = closestAnchor(e.target, 'a[href]');
    if (a) hide(a);
  });
  document.addEventListener('mouseout', (e) => {
    const a = closestAnchor(e.target, `a[${REAL_HREF}]`);
    if (a) restore(a);
  });
  // Capture phase so the href is back in place before any click/navigation handler runs.
  document.addEventListener('mousedown', (e) => {
    const a = closestAnchor(e.target, `a[${REAL_HREF}]`);
    if (a) restore(a);
  }, true);
  document.addEventListener('focusin', (e) => {
    const a = closestAnchor(e.target, `a[${REAL_HREF}]`);
    if (a) restore(a);
  });
}
