/**
 * Tests for backup export/import — Sprint 18 adds the encrypted format,
 * so we want coverage that:
 *   - plain backups still round-trip
 *   - encrypted backups need the right passphrase to import
 *   - wrong passphrase produces a friendly error, not a crash
 *   - format detection tells the UI when to prompt for a passphrase
 *   - encrypted ciphertext doesn't leak the inner data in plaintext
 */
import { exportBackup, importBackup, detectBackupFormat } from './backup';

/**
 * jsdom-style downloads use createObjectURL/anchor clicks; we capture
 * the Blob the SUT hands to URL.createObjectURL so we can read the
 * exported contents back without touching the filesystem.
 */
let lastBlob: Blob | null = null;
beforeEach(() => {
  lastBlob = null;
  localStorage.clear();
  // happy-dom polyfill
  globalThis.URL.createObjectURL = (blob: Blob) => {
    lastBlob = blob;
    return 'blob:mock';
  };
  globalThis.URL.revokeObjectURL = () => { /* no-op */ };
});

async function fileFromLastExport(): Promise<File> {
  if (!lastBlob) throw new Error('no blob captured');
  const text = await lastBlob.text();
  return new File([text], 'backup.json', { type: 'application/json' });
}

describe('plain backup', () => {
  it('round-trips a single key', async () => {
    localStorage.setItem('clause-control:hello', JSON.stringify({ a: 1 }));
    await exportBackup();
    const file = await fileFromLastExport();
    localStorage.clear();
    const res = await importBackup(file);
    expect(res.imported).toBe(1);
    expect(JSON.parse(localStorage.getItem('clause-control:hello')!)).toEqual({ a: 1 });
  });

  it('detectBackupFormat returns plain', async () => {
    localStorage.setItem('clause-control:hello', JSON.stringify({ a: 1 }));
    await exportBackup();
    const file = await fileFromLastExport();
    expect(await detectBackupFormat(file)).toBe('plain');
  });
});

describe('encrypted backup', () => {
  it('round-trips with the correct passphrase', async () => {
    localStorage.setItem('clause-control:secret', JSON.stringify({ value: 'top-secret' }));
    await exportBackup({ passphrase: 'hunter2hunter2' });
    const file = await fileFromLastExport();

    localStorage.clear();
    const res = await importBackup(file, 'hunter2hunter2');
    expect(res.imported).toBe(1);
    expect(JSON.parse(localStorage.getItem('clause-control:secret')!)).toEqual({ value: 'top-secret' });
  });

  it('fails with a wrong passphrase', async () => {
    localStorage.setItem('clause-control:secret', JSON.stringify({ value: 'top-secret' }));
    await exportBackup({ passphrase: 'hunter2hunter2' });
    const file = await fileFromLastExport();

    await expect(importBackup(file, 'wrong-passphrase')).rejects.toThrow(/wrong passphrase|corrupt/i);
  });

  it('refuses to import an encrypted backup without a passphrase', async () => {
    localStorage.setItem('clause-control:secret', JSON.stringify({ value: 'top-secret' }));
    await exportBackup({ passphrase: 'hunter2hunter2' });
    const file = await fileFromLastExport();

    await expect(importBackup(file)).rejects.toThrow(/encrypted/i);
  });

  it('does not leak plaintext data in the exported file', async () => {
    localStorage.setItem('clause-control:secret', JSON.stringify({ marker: 'NEEDLE-XYZ' }));
    await exportBackup({ passphrase: 'hunter2hunter2' });
    const file = await fileFromLastExport();
    const text = await file.text();
    expect(text).not.toContain('NEEDLE-XYZ');
  });

  it('detectBackupFormat returns encrypted', async () => {
    localStorage.setItem('clause-control:secret', JSON.stringify({ a: 1 }));
    await exportBackup({ passphrase: 'hunter2hunter2' });
    const file = await fileFromLastExport();
    expect(await detectBackupFormat(file)).toBe('encrypted');
  });
});

describe('detectBackupFormat', () => {
  it('returns unknown for garbage', async () => {
    const file = new File(['not json'], 'x.json');
    expect(await detectBackupFormat(file)).toBe('unknown');
  });
});
