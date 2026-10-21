/** Share of the dash range-to-empty that is withheld, since the indicator over-reports. */
export const RANGE_MARGIN_OPTIONS = [10, 20, 30] as const;
export const DEFAULT_RANGE_MARGIN_PCT = 20;

/** An entered range is dropped after this long; it is a "right now" value, not a preference. */
export const RANGE_EXPIRY_MS = 3 * 60 * 60 * 1000;

export const coerceRangeMarginPct = (value: unknown): number =>
  typeof value === 'number' && (RANGE_MARGIN_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_RANGE_MARGIN_PCT;

/**
 * Distance the user can safely drive on what is left in the tank, or `null` when
 * no range was entered (no limit).
 */
export const usableRangeKm = (rangeKm: string | undefined, marginPct: number): number | null => {
  const parsed = Number.parseFloat(rangeKm ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed * (1 - coerceRangeMarginPct(marginPct) / 100);
};

/** The value the ranking functions take: usable km as a string, or '' for no limit. */
export const toUsableRangeParam = (rangeKm: string | undefined, marginPct: number): string => {
  const usable = usableRangeKm(rangeKm, marginPct);
  return usable === null ? '' : String(usable);
};

export const isRangeExpired = (setAtMs: number, nowMs: number = Date.now()): boolean =>
  nowMs - setAtMs > RANGE_EXPIRY_MS;
