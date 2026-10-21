import type { Coordinates, FuelApiData } from '@/types';
import { haversineKm } from '@/lib/geo';

/** Fetched stations are reused for this long when only ranking inputs (e.g. the range) change. */
export const FUEL_DATA_CACHE_TTL_MS = 10 * 60 * 1000;

/** A new position this close to the cached one still counts as the same place. */
const SAME_PLACE_KM = 0.3;

/** Everything that decides which stations the API is asked for. Ranking inputs are deliberately absent. */
export type FuelDataRequest = {
  mode: 'roundTrip' | 'oneWay';
  start: Coordinates;
  destination?: Coordinates;
  fuelType: string;
  brands: string[];
};

type CacheEntry = { request: FuelDataRequest; data: FuelApiData; fetchedAt: number };

const sameBrands = (a: string[], b: string[]): boolean => {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((brand, index) => brand === right[index]);
};

const samePlace = (a: Coordinates | undefined, b: Coordinates | undefined): boolean => {
  if (!a || !b) return a === b;
  return haversineKm(a, b) <= SAME_PLACE_KM;
};

/**
 * Holds the most recent fetched station pool so changing only how stations are ranked
 * (range, litres, economy) doesn't repeat the token, API and location-radius requests.
 */
export function createFuelDataCache() {
  let entry: CacheEntry | null = null;

  return {
    read(request: FuelDataRequest, nowMs: number = Date.now()): { data: FuelApiData; fetchedAt: number } | null {
      if (!entry) return null;
      const cached = entry.request;
      const matches =
        nowMs - entry.fetchedAt <= FUEL_DATA_CACHE_TTL_MS &&
        cached.mode === request.mode &&
        cached.fuelType === request.fuelType &&
        sameBrands(cached.brands, request.brands) &&
        samePlace(cached.start, request.start) &&
        samePlace(cached.destination, request.destination);
      return matches ? { data: entry.data, fetchedAt: entry.fetchedAt } : null;
    },
    write(request: FuelDataRequest, data: FuelApiData, fetchedAt: number = Date.now()): void {
      entry = { request, data, fetchedAt };
    },
    clear(): void {
      entry = null;
    }
  };
}
