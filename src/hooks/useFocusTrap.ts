/**
 * useFocusTrap — keep keyboard focus inside a modal or drawer.
 *
 * Why we hand-roll instead of pulling focus-trap-react: the dependency adds
 * 5 kB gzipped and a peer-dep on focus-trap. Our needs are narrow:
 *   - On mount: move focus into the container (first focusable element, or
 *     a caller-specified one). Return focus to the previously-focused
 *     element when the modal closes.
 *   - On Tab / Shift+Tab: wrap focus around the focusable set.
 *   - That's it. No nested traps, no active-element observers, no portal
 *     pierce-through — modals here are simple.
 *
 * Usage:
 *   const ref = useFocusTrap(open);
 *   return <div ref={ref}>{...modal content...}</div>;
 *
 * The hook is a no-op when `open` is false, so it's cheap to mount inside a
 * conditionally-rendered modal.
 */
import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    // Remember who had focus before the modal opened so we can hand it back
    // on close. Stale by the time we cleanup if the user switched windows
    // mid-modal — that's fine, we just won't restore.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus inside the container. Prefer the first focusable that
    // isn't a close button — heuristic: skip elements whose aria-label
    // includes "Close" so we land on the actual primary input.
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const initial =
      focusables.find(el => !/close/i.test(el.getAttribute('aria-label') ?? '')) ??
      focusables[0] ??
      root;
    initial?.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const els = Array.from(root!.querySelectorAll<HTMLElement>(FOCUSABLE))
        // Filter out elements that are visually hidden / disabled at this moment.
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Only restore if the previously-focused element is still mounted.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}
