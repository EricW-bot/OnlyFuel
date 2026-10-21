import { normalisePositiveDecimal, sanitiseDecimalInput } from '@/lib/numberFormatting';
import { normaliseRangeKm, sanitiseAddressInput } from '@/lib/utils';

describe('sanitiseDecimalInput', () => {
  it('strips letters and symbols other than a single dot', () => {
    expect(sanitiseDecimalInput('a1b2-3,4e5')).toBe('12345');
    expect(sanitiseDecimalInput('1.2.3.4')).toBe('1.234');
    expect(sanitiseDecimalInput('$ 12.5 L')).toBe('12.5');
    expect(sanitiseDecimalInput('١٢٣')).toBe('');
  });

  it('caps the length', () => {
    expect(sanitiseDecimalInput('123456789012')).toBe('1234567');
  });
});

describe('normalisePositiveDecimal', () => {
  it('falls back for blank, dot-only, zero and negative-looking input', () => {
    expect(normalisePositiveDecimal('', '25')).toBe('25');
    expect(normalisePositiveDecimal('.', '25')).toBe('25');
    expect(normalisePositiveDecimal('0', '25')).toBe('25');
    expect(normalisePositiveDecimal('-5', '25')).toBe('5');
  });

  it('keeps valid values as typed', () => {
    expect(normalisePositiveDecimal('8.456', '10')).toBe('8.456');
    expect(normalisePositiveDecimal('10.0', '25')).toBe('10.0');
  });
});

describe('normaliseRangeKm', () => {
  it('returns blank for anything that is not a positive number', () => {
    expect(normaliseRangeKm('abc')).toBe('');
    expect(normaliseRangeKm('.')).toBe('');
    expect(normaliseRangeKm('0')).toBe('');
    expect(normaliseRangeKm(' 45 ')).toBe('45');
  });
});

describe('sanitiseAddressInput', () => {
  it('removes control characters and caps the length', () => {
    expect(sanitiseAddressInput('1 Test St\nSydney\u0000')).toBe('1 Test St Sydney ');
    expect(sanitiseAddressInput('a'.repeat(500))).toHaveLength(200);
  });
});
