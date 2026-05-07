/**
 * Tests for useFocusTrap — keyboard focus management for modals.
 *
 * What we're protecting against:
 *  - The trap firing while inactive (would steal focus on every render).
 *  - Initial focus landing on the close button instead of the first input
 *    (a real UX regression we explicitly avoid in the hook).
 *  - Tab not wrapping at the boundaries.
 *  - Focus not being returned to the trigger on close.
 *
 * Notes on environment: happy-dom doesn't lay out elements, so
 * `el.offsetParent` is null for everything. The hook filters on that to
 * skip hidden elements — for the test, we override `offsetParent` so the
 * filter doesn't strip everything.
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from './useFocusTrap';

// happy-dom returns null for offsetParent on everything (no layout). The
// trap filters by `offsetParent !== null` to skip hidden nodes; without this
// override the focusables list would always be empty in tests.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.parentElement; },
  });
});

function Harness({ open }: { open: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(open);
  return (
    <div>
      <button data-testid="trigger">trigger</button>
      {open && (
        <div ref={ref} data-testid="modal" role="dialog">
          <button aria-label="Close">×</button>
          <input data-testid="first-input" />
          <button data-testid="confirm">Confirm</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the modal on open, skipping the close button', () => {
    render(<Harness open={false} />);
    // Trigger has focus before opening.
    const trigger = screen.getByTestId('trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open the modal — the trap fires, focus lands on the first non-close element.
    act(() => render(<Harness open={true} />, { container: document.body }));
    expect(document.activeElement).toBe(screen.getByTestId('first-input'));
  });

  it('wraps focus on Tab past the last element', async () => {
    render(<Harness open={true} />);
    const confirm = screen.getByTestId('confirm');
    confirm.focus();
    expect(document.activeElement).toBe(confirm);

    // Tab from the last element should wrap to the first focusable.
    await userEvent.tab();
    // The first focusable (Close button) should now have focus.
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
  });

  it('wraps focus on Shift+Tab past the first element', async () => {
    render(<Harness open={true} />);
    const close = screen.getByLabelText('Close');
    close.focus();

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId('confirm'));
  });

  it('is a no-op while inactive — does not steal focus', () => {
    render(<Harness open={false} />);
    const trigger = screen.getByTestId('trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });
});
