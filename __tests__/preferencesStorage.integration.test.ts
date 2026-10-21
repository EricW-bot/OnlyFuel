/* eslint-disable import/first */
const storage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => (key in storage ? storage[key] : null)),
  setItem: jest.fn(async (key: string, value: string) => {
    storage[key] = value;
  })
}));

import { loadUserPreferences, saveUserPreferences } from '@/services/preferencesStorage';

describe('preferences storage integration', () => {
  beforeEach(() => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  });

  it('saves and reloads partial preferences with defaults merged', async () => {
    await saveUserPreferences({
      appMode: 'oneWay',
      fuelNeeded: '40',
      tripStartAddress: '1 Test St',
      tripDestinationAddress: '2 Destination Rd'
    });

    const loaded = await loadUserPreferences();
    expect(loaded.appMode).toBe('oneWay');
    expect(loaded.fuelNeeded).toBe('40');
    expect(loaded.fuelEconomy).toBe('10.0');
    expect(loaded.tripStartAddress).toBe('1 Test St');
    expect(loaded.tripDestinationAddress).toBe('2 Destination Rd');
  });

  it('persists, clears and sanitises the remaining range', async () => {
    expect((await loadUserPreferences()).remainingRangeKm).toBe('');

    await saveUserPreferences({ remainingRangeKm: '45' });
    expect((await loadUserPreferences()).remainingRangeKm).toBe('45');

    await saveUserPreferences({ remainingRangeKm: '0' });
    expect((await loadUserPreferences()).remainingRangeKm).toBe('');
  });

  it('expires an old range and keeps the original timestamp when re-saved unchanged', async () => {
    const realNow = Date.now;
    try {
      Date.now = () => 1_000_000;
      await saveUserPreferences({ remainingRangeKm: '30' });
      Date.now = () => 1_000_000 + 60_000;
      await saveUserPreferences({ remainingRangeKm: '30' });
      expect(JSON.parse(storage['fuelnearme.preferences']).remainingRangeSetAt).toBe(1_000_000);

      Date.now = () => 1_000_000 + 4 * 60 * 60 * 1000;
      expect((await loadUserPreferences()).remainingRangeKm).toBe('');
    } finally {
      Date.now = realNow;
    }
  });

  it('treats a range saved without a timestamp as cleared, and defaults the margin', async () => {
    storage['fuelnearme.preferences'] = JSON.stringify({ remainingRangeKm: '30', rangeMarginPct: 99 });
    const loaded = await loadUserPreferences();
    expect(loaded.remainingRangeKm).toBe('');
    expect(loaded.rangeMarginPct).toBe(20);
  });

  it('repairs corrupt numeric values from storage and on save', async () => {
    storage['fuelnearme.preferences'] = JSON.stringify({ fuelNeeded: 'abc', fuelEconomy: '.', remainingRangeKm: '12abc' });
    const loaded = await loadUserPreferences();
    expect(loaded.fuelNeeded).toBe('25');
    expect(loaded.fuelEconomy).toBe('10.0');
    // No timestamp, so the range is treated as expired.
    expect(loaded.remainingRangeKm).toBe('');

    await saveUserPreferences({ fuelNeeded: '40' });
    await saveUserPreferences({ fuelNeeded: '.' });
    expect((await loadUserPreferences()).fuelNeeded).toBe('40');
  });

  it('migrates legacy tripDestinationLabel into tripDestinationAddress', async () => {
    storage['fuelnearme.preferences'] = JSON.stringify({
      appMode: 'oneWay',
      tripDestinationLabel: 'Legacy Destination'
    });

    const loaded = await loadUserPreferences();
    expect(loaded.tripDestinationAddress).toBe('Legacy Destination');
  });

  it('recovers defaults from malformed storage JSON', async () => {
    storage['fuelnearme.preferences'] = '{invalid-json';
    const loaded = await loadUserPreferences();
    expect(loaded.appMode).toBe('roundTrip');
    expect(loaded.fuelType).toBe('E10');
  });

  it('coerces invalid shapes/types to safe defaults', async () => {
    storage['fuelnearme.preferences'] = JSON.stringify({
      appMode: 'unknown-mode',
      fuelType: 'BOGUS',
      selectedBrands: ['Shell', 'NotARealBrand'],
      tripStart: { latitude: 'bad', longitude: 'bad' },
      useCurrentLocation: 'yes'
    });
    const loaded = await loadUserPreferences();
    expect(loaded.appMode).toBe('roundTrip');
    expect(loaded.fuelType).toBe('E10');
    expect(loaded.selectedBrands).toEqual(['Shell']);
    expect(loaded.tripStart).toEqual({ latitude: -34.0429, longitude: 150.8156 });
    expect(loaded.useCurrentLocation).toBe(true);
  });
});
