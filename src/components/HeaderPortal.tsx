import { type ReactNode, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Shell renders empty #header-left / #header-right containers; individual
// pages portal their title and actions into them. Keeps <Header> generic
// while still letting each page own its own header content.
function usePortalTarget(id: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setEl(document.getElementById(id)); }, []);
  return el;
}

export function HeaderLeft({ children }: { children?: ReactNode }) {
  const el = usePortalTarget('header-left');
  return el ? createPortal(children, el) : null;
}
export function HeaderRight({ children }: { children?: ReactNode }) {
  const el = usePortalTarget('header-right');
  return el ? createPortal(children, el) : null;
}
