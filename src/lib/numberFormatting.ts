export const MAX_NUMERIC_INPUT_LENGTH = 7;

/** Keeps only digits and a single '.', capped in length. Safe for typed and pasted text. */
export function sanitiseDecimalInput(text: string, maxLength = MAX_NUMERIC_INPUT_LENGTH): string {
  const stripped = text.replace(/[^0-9.]/g, '');
  const firstDot = stripped.indexOf('.');
  const deduped =
    firstDot === -1 ? stripped : stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, '');
  return deduped.slice(0, maxLength);
}

export function roundToTwoDecimalPlaces(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  // EPSILON avoids floating precision artifacts (e.g. 1.005).
  const rounded = Math.round((numeric + Number.EPSILON) * 100) / 100;
  return String(rounded);
}


/** Sanitised positive number as a string, or `fallback` when the value is blank/zero/invalid. */
export function normalisePositiveDecimal(value: string, fallback: string): string {
  const cleaned = sanitiseDecimalInput(value);
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? cleaned : fallback;
}
