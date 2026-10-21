import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BRAND_OPTIONS,
  DEFAULT_FUEL_TYPE,
  DEFAULT_TRIP_DESTINATION,
  DEFAULT_TRIP_START,
  FUEL_TYPE_OPTIONS
} from '@/constants';
import type { AppMode, Coordinates } from '@/types';
import { type ThemeMode } from '@/theme/theme';
import { normaliseRangeKm, sanitiseAddressInput } from '@/lib/utils';
import { normalisePositiveDecimal } from '@/lib/numberFormatting';
import { coerceRangeMarginPct, DEFAULT_RANGE_MARGIN_PCT, isRangeExpired } from '@/lib/range';

const PREFERENCES_KEY = 'fuelnearme.preferences';

export type StoredUserPreferences = {
  themeMode: ThemeMode;
  appMode: AppMode;
  useCurrentLocation: boolean;
  fuelNeeded: string;
  fuelEconomy: string;
  remainingRangeKm: string;
  /** When the range was last changed (ms); used to expire it. */
  remainingRangeSetAt: number;
  rangeMarginPct: number;
  fuelType: string;
  selectedBrands: string[];
  tripStart: Coordinates;
  tripDestination: Coordinates;
  tripStartAddress: string;
  tripDestinationAddress: string;
};

const DEFAULTS: StoredUserPreferences = {
  themeMode: 'light',
  appMode: 'roundTrip',
  useCurrentLocation: true,
  fuelNeeded: '25',
  fuelEconomy: '10.0',
  remainingRangeKm: '',
  remainingRangeSetAt: 0,
  rangeMarginPct: DEFAULT_RANGE_MARGIN_PCT,
  fuelType: DEFAULT_FUEL_TYPE,
  selectedBrands: [],
  tripStart: DEFAULT_TRIP_START,
  tripDestination: DEFAULT_TRIP_DESTINATION,
  tripStartAddress: '',
  tripDestinationAddress: ''
};

function coerceThemeMode(value: unknown): ThemeMode {
  return value === 'dark' || value === 'light' ? value : DEFAULTS.themeMode;
}

function coerceAppMode(value: unknown): AppMode {
  if (value === 'roundTrip' || value === 'oneWay') {
    return value;
  }
  // Legacy migration from previous mode names.
  if (value === 'nearby') {
    return 'roundTrip';
  }
  if (value === 'trip') {
    return 'oneWay';
  }
  return DEFAULTS.appMode;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function coerceFuelType(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_FUEL_TYPE;
  const t = value.trim().toUpperCase();
  return FUEL_TYPE_OPTIONS.includes(t) ? t : DEFAULT_FUEL_TYPE;
}

function coerceBrands(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(BRAND_OPTIONS);
  return value.filter((item): item is string => typeof item === 'string' && allowed.has(item));
}

function coerceCoordinates(value: unknown, fallback: Coordinates): Coordinates {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const { latitude, longitude } = value as { latitude?: unknown; longitude?: unknown };
  const parsedLat = typeof latitude === 'number' ? latitude : Number.parseFloat(String(latitude ?? ''));
  const parsedLon = typeof longitude === 'number' ? longitude : Number.parseFloat(String(longitude ?? ''));
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return fallback;
  }

  return {
    latitude: parsedLat,
    longitude: parsedLon
  };
}

function coerceAddress(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return sanitiseAddressInput(value).trim();
}

function coerceNumberString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? normalisePositiveDecimal(value, fallback) : fallback;
}

function coerceStoredRange(raw: Partial<StoredUserPreferences>): Pick<StoredUserPreferences, 'remainingRangeKm' | 'remainingRangeSetAt'> {
  const rangeKm = typeof raw.remainingRangeKm === 'string' ? normaliseRangeKm(raw.remainingRangeKm) : '';
  const setAt = typeof raw.remainingRangeSetAt === 'number' && Number.isFinite(raw.remainingRangeSetAt) ? raw.remainingRangeSetAt : 0;
  // A range with no timestamp (saved before expiry existed) or an old one is treated as cleared.
  if (rangeKm === '' || setAt === 0 || isRangeExpired(setAt)) {
    return { remainingRangeKm: '', remainingRangeSetAt: 0 };
  }
  return { remainingRangeKm: rangeKm, remainingRangeSetAt: setAt };
}

function mergeWithDefaults(raw: Partial<StoredUserPreferences> | null): StoredUserPreferences {
  if (!raw) return { ...DEFAULTS };
  const legacyRaw = raw as Partial<StoredUserPreferences> & { tripDestinationLabel?: unknown };
  return {
    themeMode: coerceThemeMode(raw.themeMode),
    appMode: coerceAppMode(raw.appMode),
    useCurrentLocation: coerceBoolean(raw.useCurrentLocation, DEFAULTS.useCurrentLocation),
    fuelNeeded: coerceNumberString(raw.fuelNeeded, DEFAULTS.fuelNeeded),
    fuelEconomy: coerceNumberString(raw.fuelEconomy, DEFAULTS.fuelEconomy),
    ...coerceStoredRange(raw),
    rangeMarginPct: coerceRangeMarginPct(raw.rangeMarginPct),
    fuelType: coerceFuelType(raw.fuelType),
    selectedBrands: coerceBrands(raw.selectedBrands),
    tripStart: coerceCoordinates(raw.tripStart, DEFAULTS.tripStart),
    tripDestination: coerceCoordinates(raw.tripDestination, DEFAULTS.tripDestination),
    tripStartAddress: coerceAddress(raw.tripStartAddress),
    tripDestinationAddress: coerceAddress(raw.tripDestinationAddress ?? legacyRaw.tripDestinationLabel)
  };
}

export async function loadUserPreferences(): Promise<StoredUserPreferences> {
  try {
    const json = await AsyncStorage.getItem(PREFERENCES_KEY);
    let parsed: Partial<StoredUserPreferences> | null = null;
    if (json) {
      const data: unknown = JSON.parse(json);
      parsed = typeof data === 'object' && data !== null ? (data as Partial<StoredUserPreferences>) : null;
    }

    const merged = mergeWithDefaults(parsed);

    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function nextStoredRange(
  partial: Partial<StoredUserPreferences>,
  current: StoredUserPreferences
): Pick<StoredUserPreferences, 'remainingRangeKm' | 'remainingRangeSetAt'> {
  if (partial.remainingRangeKm === undefined) {
    return { remainingRangeKm: current.remainingRangeKm, remainingRangeSetAt: current.remainingRangeSetAt };
  }
  const rangeKm = normaliseRangeKm(partial.remainingRangeKm);
  if (rangeKm === '') {
    return { remainingRangeKm: '', remainingRangeSetAt: 0 };
  }
  // Re-saving the same value keeps its original timestamp so it still expires on schedule.
  return {
    remainingRangeKm: rangeKm,
    remainingRangeSetAt: rangeKm === current.remainingRangeKm && current.remainingRangeSetAt > 0 ? current.remainingRangeSetAt : Date.now()
  };
}

export async function saveUserPreferences(partial: Partial<StoredUserPreferences>): Promise<void> {
  const current = await loadUserPreferences();
  const next: StoredUserPreferences = {
    themeMode: partial.themeMode !== undefined ? coerceThemeMode(partial.themeMode) : current.themeMode,
    appMode: partial.appMode !== undefined ? coerceAppMode(partial.appMode) : current.appMode,
    useCurrentLocation:
      partial.useCurrentLocation !== undefined ? coerceBoolean(partial.useCurrentLocation, true) : current.useCurrentLocation,
    fuelNeeded: partial.fuelNeeded !== undefined ? coerceNumberString(partial.fuelNeeded, current.fuelNeeded) : current.fuelNeeded,
    fuelEconomy:
      partial.fuelEconomy !== undefined ? coerceNumberString(partial.fuelEconomy, current.fuelEconomy) : current.fuelEconomy,
    ...nextStoredRange(partial, current),
    rangeMarginPct:
      partial.rangeMarginPct !== undefined ? coerceRangeMarginPct(partial.rangeMarginPct) : current.rangeMarginPct,
    fuelType: partial.fuelType !== undefined ? coerceFuelType(partial.fuelType) : current.fuelType,
    selectedBrands: partial.selectedBrands !== undefined ? coerceBrands(partial.selectedBrands) : current.selectedBrands,
    tripStart: partial.tripStart !== undefined ? coerceCoordinates(partial.tripStart, current.tripStart) : current.tripStart,
    tripDestination:
      partial.tripDestination !== undefined
        ? coerceCoordinates(partial.tripDestination, current.tripDestination)
        : current.tripDestination,
    tripStartAddress:
      partial.tripStartAddress !== undefined ? coerceAddress(partial.tripStartAddress) : current.tripStartAddress,
    tripDestinationAddress:
      partial.tripDestinationAddress !== undefined
        ? coerceAddress(partial.tripDestinationAddress)
        : current.tripDestinationAddress
  };
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
}
