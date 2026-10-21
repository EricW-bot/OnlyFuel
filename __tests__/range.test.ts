import { isLikelyOutsideCoverage } from '@/lib/coverage';
import { formatAgo } from '@/lib/timeAgo';
import {
  coerceRangeMarginPct,
  DEFAULT_RANGE_MARGIN_PCT,
  isRangeExpired,
  RANGE_EXPIRY_MS,
  toUsableRangeParam,
  usableRangeKm
} from '@/lib/range';

describe('usableRangeKm', () => {
  it('returns null (no limit) for blank or non-positive input', () => {
    expect(usableRangeKm('', 20)).toBeNull();
    expect(usableRangeKm(undefined, 20)).toBeNull();
    expect(usableRangeKm('abc', 20)).toBeNull();
    expect(usableRangeKm('0', 20)).toBeNull();
    expect(usableRangeKm('-5', 20)).toBeNull();
  });

  it('holds back the chosen safety margin', () => {
    expect(usableRangeKm('50', 20)).toBeCloseTo(40, 5);
    expect(usableRangeKm('50', 30)).toBeCloseTo(35, 5);
    expect(usableRangeKm('50', 10)).toBeCloseTo(45, 5);
  });

  it('falls back to the default margin for unknown values', () => {
    expect(coerceRangeMarginPct(55)).toBe(DEFAULT_RANGE_MARGIN_PCT);
    expect(coerceRangeMarginPct('x')).toBe(DEFAULT_RANGE_MARGIN_PCT);
    expect(usableRangeKm('50', 99)).toBeCloseTo(40, 5);
  });

  it('builds the string parameter used by the ranking functions', () => {
    expect(toUsableRangeParam('50', 20)).toBe('40');
    expect(toUsableRangeParam('', 20)).toBe('');
  });
});

describe('range expiry', () => {
  it('expires after the configured window', () => {
    const now = 1_000_000_000;
    expect(isRangeExpired(now - RANGE_EXPIRY_MS + 1000, now)).toBe(false);
    expect(isRangeExpired(now - RANGE_EXPIRY_MS - 1000, now)).toBe(true);
  });
});

describe('formatAgo', () => {
  it('formats elapsed time', () => {
    const now = 10_000_000;
    expect(formatAgo(now - 20_000, now)).toBe('just now');
    expect(formatAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatAgo(now - 2 * 86_400_000, now)).toBe('2 days ago');
  });
});

describe('isLikelyOutsideCoverage', () => {
  it('accepts NSW, ACT and Tasmania', () => {
    expect(isLikelyOutsideCoverage(-33.87, 151.21)).toBe(false); // Sydney
    expect(isLikelyOutsideCoverage(-35.28, 149.13)).toBe(false); // Canberra
    expect(isLikelyOutsideCoverage(-42.88, 147.33)).toBe(false); // Hobart
  });

  it('flags other regions', () => {
    expect(isLikelyOutsideCoverage(-27.47, 153.03)).toBe(true); // Brisbane
    expect(isLikelyOutsideCoverage(-31.95, 115.86)).toBe(true); // Perth
    expect(isLikelyOutsideCoverage(0, 0)).toBe(true);
  });
});
