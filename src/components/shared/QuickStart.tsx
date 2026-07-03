/**
 * v3.0 ship: first-launch quick-start modal.
 *
 * Shown once (gated on `clause-control:post-watch:onboarded`) when the
 * app boots with no clients. Three-step orientation plus a "Load sample
 * data" button that seeds a fully-populated demo engagement so the v3.0
 * evidence surfaces (SoA, CAPA, audits, MR, KPIs, registers) are
 * explorable without hours of data entry.
 */
import { useState } from 'react';
import { Rocket, Building2, Radar, FileCheck2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Client } from '../../data/types';
import { loadSampleData } from '../../utils/sampleData';
import { pushToast } from '../../utils/toastBus';
import Modal from './Modal';

export default function QuickStart() {
  const [onboarded, setOnboarded] = useLocalStorage<boolean>('post-watch:onboarded', false);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [loading, setLoading] = useState(false);

  // Only greet genuinely fresh installs — an existing user upgrading to
  // v3.0 has clients and shouldn't see a beginner modal.
  const fresh = !onboarded && (!Array.isArray(clients) || clients.length === 0);
  if (!fresh) return null;

  const dismiss = () => setOnboarded(true);

  const seedDemo = () => {
    setLoading(true);
    const seeded = loadSampleData();
    setOnboarded(true);
    if (seeded) {
      pushToast('success', 'Sample engagement loaded. Reloading…');
      // Reload so every useLocalStorage hook re-reads the seeded keys —
      // same pattern as backup import.
      setTimeout(() => window.location.reload(), 700);
    } else {
      setLoading(false);
      pushToast('info', 'Sample data already present');
    }
  };

  const steps = [
    { Icon: Building2, title: 'Add a client', body: 'Everything — risks, scans, SoA, findings — hangs off a client record.' },
    { Icon: Radar, title: 'Run a WordPress scan', body: '57 outside-in checks against any WP site. Findings feed the CAPA register.' },
    { Icon: FileCheck2, title: 'Assess & evidence', body: 'Gap analysis → Statement of Applicability → corrective actions → audit-ready PDFs.' },
  ];

  return (
    <Modal
      open
      onClose={dismiss}
      title="Welcome to Post_Watch"
      subtitle="ISO 27001 engagement management + WordPress security auditing — all data stays on this device"
      size={520}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={dismiss} disabled={loading}>
            Start empty
          </button>
          <button type="button" className="btn btn-primary" onClick={seedDemo} disabled={loading}>
            <Rocket className="w-3.5 h-3.5" />
            {loading ? 'Loading…' : 'Load sample data'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map((s, i) => (
          <div key={s.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: 'rgba(0,217,163,0.12)',
              border: '1px solid rgba(0,217,163,0.28)',
              color: 'var(--mint)',
            }}>
              <s.Icon className="w-4 h-4" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
                {i + 1}. {s.title}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{s.body}</p>
            </div>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
          // Sample data creates one demo client with populated SoA, CAPA board, internal audit, management review, KPIs and registers. Delete it any time.
        </p>
      </div>
    </Modal>
  );
}
