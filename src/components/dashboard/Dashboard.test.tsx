/**
 * Smoke test for the Dashboard — proves the page mounts against synthetic
 * localStorage state without crashing, and that the welcome / metric strip
 * branch matches the actual presence of data.
 *
 * Intentionally light-touch. We're not testing every metric; we're proving
 * that:
 *  - A first-launch user sees the welcome card (the 3-step CTA).
 *  - A user with data sees the metric strip instead.
 *  - Recent-scan tiles are real <button>s (the Sprint-10 QA fix), with the
 *    expected `aria-label` so assistive tech announces them.
 *  - Clicking a recent-scan tile fires `onOpenReport` with the report's id
 *    (the deep-link contract).
 *
 * This is the template for any future component test — copy this file, swap
 * the component + fixtures, you're done.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import type { AuditReport } from '../../data/auditTypes';

const KEY = (k: string) => `clause-control:${k}`;
function seed<T>(key: string, value: T) {
  window.localStorage.setItem(KEY(key), JSON.stringify(value));
}

function fakeReport(over: Partial<AuditReport> = {}): AuditReport {
  return {
    id: 'rep-1',
    targetUrl: 'https://example.com',
    domain: 'example.com',
    startedAt: '2026-04-30T10:00:00Z',
    completedAt: '2026-04-30T10:01:00Z',
    score: 88,
    checks: [],
    clientId: 'unassigned',
    ...over,
  };
}

describe('<Dashboard />', () => {
  it('shows the first-launch welcome card when storage is empty', () => {
    const onNavigate = vi.fn();
    const onOpenReport = vi.fn();
    render(<Dashboard onNavigate={onNavigate} onOpenReport={onOpenReport} />);

    expect(screen.getByText(/Three steps to a first report/i)).toBeInTheDocument();
    // The metric strip's "WP scans · all time" header should NOT be on the
    // page when the welcome card is shown.
    expect(screen.queryByText(/WP scans · all time/i)).not.toBeInTheDocument();
  });

  it('shows the metric strip once any scan has been recorded', () => {
    seed<AuditReport[]>('wp-audit-reports', [fakeReport()]);
    render(<Dashboard onNavigate={vi.fn()} onOpenReport={vi.fn()} />);

    expect(screen.getByText(/WP scans · all time/i)).toBeInTheDocument();
    expect(screen.queryByText(/Three steps to a first report/i)).not.toBeInTheDocument();
  });

  it('renders a recent-scan row as a button with an accessible label', () => {
    seed<AuditReport[]>('wp-audit-reports', [fakeReport({ score: 73, domain: 'lawfirm.test' })]);
    render(<Dashboard onNavigate={vi.fn()} onOpenReport={vi.fn()} />);

    const tile = screen.getByRole('button', { name: /View scan for lawfirm\.test, score 73 out of 100/i });
    expect(tile).toBeInTheDocument();
    expect(tile.tagName).toBe('BUTTON');
  });

  it('fires onOpenReport with the matching id when a recent-scan tile is clicked', async () => {
    const onOpenReport = vi.fn();
    seed<AuditReport[]>('wp-audit-reports', [fakeReport({ id: 'rep-deep-link', score: 91 })]);
    render(<Dashboard onNavigate={vi.fn()} onOpenReport={onOpenReport} />);

    const tile = screen.getByRole('button', { name: /View scan for example\.com/i });
    await userEvent.click(tile);

    expect(onOpenReport).toHaveBeenCalledWith('rep-deep-link');
  });
});
