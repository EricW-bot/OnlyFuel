import { DEFAULT_FUEL_TYPE } from '@/constants';
import { sanitiseDecimalInput } from '@/lib/numberFormatting';

export const MAX_ADDRESS_LENGTH = 200;

/** Strips control characters (incl. newlines from pasted text) and caps length. */
export const sanitiseAddressInput = (text: string): string => {
  return text.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, MAX_ADDRESS_LENGTH);
};

export const getErrorMessage = (err: unknown, fallback: string): string => {
  return err instanceof Error ? err.message : fallback;
};

export const normaliseFuelType = (value: string): string => {
  const normalise = value.trim().toUpperCase();
  return normalise || DEFAULT_FUEL_TYPE;
};

export const normaliseBrands = (brands: string[]): string[] => {
  return brands.map((brand) => brand.trim()).filter((brand) => brand.length > 0);
};

/** Returns a trimmed positive number string, or '' (no range limit) for blank/invalid input. */
export const normaliseRangeKm = (value: string): string => {
  const cleaned = sanitiseDecimalInput(value);
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? cleaned : '';
};

export const sameOrderedStringArray = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};
