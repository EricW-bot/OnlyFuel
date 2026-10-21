import { createFuelDataCache, FUEL_DATA_CACHE_TTL_MS, type FuelDataRequest } from '@/lib/fuelDataCache';
import type { FuelApiData } from '@/types';

const data: FuelApiData = {
  stations: [{ code: 'A', name: 'A', location: { latitude: -33.9, longitude: 151.2 } }],
  prices: [{ stationcode: 'A', price: 190 }]
};

const request: FuelDataRequest = {
  mode: 'roundTrip',
  start: { latitude: -33.9, longitude: 151.2 },
  fuelType: 'U91',
  brands: ['Shell', 'BP']
};

describe('fuel data cache', () => {
  it('returns the stored data, and when it was really fetched, for the same request', () => {
    const cache = createFuelDataCache();
    cache.write(request, data, 1000);
    expect(cache.read(request, 2000)).toEqual({ data, fetchedAt: 1000 });
  });

  it('ignores brand order and small position changes', () => {
    const cache = createFuelDataCache();
    cache.write(request, data, 1000);
    expect(cache.read({ ...request, brands: ['BP', 'Shell'] }, 2000)).not.toBeNull();
    // about 110 m north
    expect(cache.read({ ...request, start: { latitude: -33.899, longitude: 151.2 } }, 2000)).not.toBeNull();
  });

  it('misses when the user has moved on, or the fuel, brands or mode changed', () => {
    const cache = createFuelDataCache();
    cache.write(request, data, 1000);
    // about 1.1 km north
    expect(cache.read({ ...request, start: { latitude: -33.89, longitude: 151.2 } }, 2000)).toBeNull();
    expect(cache.read({ ...request, fuelType: 'P95' }, 2000)).toBeNull();
    expect(cache.read({ ...request, brands: ['Shell'] }, 2000)).toBeNull();
    expect(cache.read({ ...request, mode: 'oneWay', destination: request.start }, 2000)).toBeNull();
  });

  it('matches one-way requests only for the same destination', () => {
    const cache = createFuelDataCache();
    const trip: FuelDataRequest = { ...request, mode: 'oneWay', destination: { latitude: -33.5, longitude: 151.2 } };
    cache.write(trip, data, 1000);
    expect(cache.read(trip, 2000)).not.toBeNull();
    expect(cache.read({ ...trip, destination: { latitude: -34.0, longitude: 151.2 } }, 2000)).toBeNull();
  });

  it('expires after the TTL and can be cleared', () => {
    const cache = createFuelDataCache();
    cache.write(request, data, 1000);
    expect(cache.read(request, 1000 + FUEL_DATA_CACHE_TTL_MS)).not.toBeNull();
    expect(cache.read(request, 1000 + FUEL_DATA_CACHE_TTL_MS + 1)).toBeNull();
    cache.clear();
    expect(cache.read(request, 2000)).toBeNull();
  });
});
