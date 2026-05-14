/**
 * Tests for recovery-code generation + parsing.
 *
 * What we're protecting against:
 *  - Format stability: generated codes always match the
 *    8-group-of-4-hex shape — anything else would confuse the input UI.
 *  - parseRecoveryCode tolerant of common user input shapes (lowercase,
 *    extra whitespace, missing hyphens) but rejects garbage.
 *  - Generated codes have full byte entropy (no fixed prefix / pattern).
 */
import {
  generateRecoveryCode, parseRecoveryCode, looksLikeRecoveryCode, splitForDisplay,
  RECOVERY_CODE_PARAMS,
} from './recoveryCode';

describe('generateRecoveryCode', () => {
  it('produces 8 groups of 4 uppercase-hex chars separated by hyphens', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
  });

  it('two generated codes are not equal (entropy sanity)', () => {
    const a = generateRecoveryCode();
    const b = generateRecoveryCode();
    expect(a).not.toBe(b);
  });

  it('reports the canonical params', () => {
    expect(RECOVERY_CODE_PARAMS.BYTES).toBe(16);
    expect(RECOVERY_CODE_PARAMS.NUM_GROUPS).toBe(8);
  });
});

describe('parseRecoveryCode', () => {
  it('round-trips a freshly generated code unchanged', () => {
    const code = generateRecoveryCode();
    expect(parseRecoveryCode(code)).toBe(code);
  });

  it('tolerates lowercase + missing hyphens', () => {
    const code = generateRecoveryCode().toLowerCase().replace(/-/g, '');
    expect(parseRecoveryCode(code)).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
  });

  it('tolerates extra whitespace', () => {
    const code = generateRecoveryCode();
    const messy = '  ' + code.split('-').join('  ') + '\n';
    expect(parseRecoveryCode(messy)).toBe(code);
  });

  it('rejects wrong length', () => {
    expect(parseRecoveryCode('AAAA-BBBB')).toBeNull();
    expect(parseRecoveryCode('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-AAAA-BBBB-CCCC')).toBeNull();
  });

  it('rejects non-hex characters', () => {
    expect(parseRecoveryCode('GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MMMM-NNNN')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(parseRecoveryCode('')).toBeNull();
  });
});

describe('looksLikeRecoveryCode', () => {
  it('true for a generated code', () => {
    expect(looksLikeRecoveryCode(generateRecoveryCode())).toBe(true);
  });

  it('false for short / malformed input', () => {
    expect(looksLikeRecoveryCode('short')).toBe(false);
    expect(looksLikeRecoveryCode('not-a-code')).toBe(false);
  });
});

describe('splitForDisplay', () => {
  it('splits 8 groups into 2 rows of 4', () => {
    const code = generateRecoveryCode();
    const rows = splitForDisplay(code);
    expect(rows).toHaveLength(2);
    expect(rows[0].split(' ')).toHaveLength(4);
    expect(rows[1].split(' ')).toHaveLength(4);
  });
});
