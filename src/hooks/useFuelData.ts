import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { computeRankedStations, computeTripRankedStations } from '@/lib/calculations';
import { beginRoutingSession, getRoutingSessionSource } from '@/services/routingClient';
import { DEFAULT_FUEL_TYPE, NEARBY_RADIUS_KM, TRIP_SAMPLE_RADIUS_KM } from '@/constants';
import { fetchNearbyFuelData, getAccessToken } from '@/services/fuelApiClient';
import type { Coordinates, FuelApiData, RankedStation } from '@/types';
import { getErrorMessage, normaliseBrands, normaliseFuelType } from '@/lib/utils';
import { LIVE_DATA_TIMEOUT_MS } from '@/lib/appHelpers';
import { isLikelyOutsideCoverage, OUTSIDE_COVERAGE_MESSAGE } from '@/lib/coverage';
import { createFuelDataCache } from '@/lib/fuelDataCache';

export type FetchOptions = {
  /**
   * Reuse the stations fetched moments ago when only ranking inputs changed (e.g. the range).
   * Leave off for refreshes, so asking for fresh prices always gets them.
   */
  allowCache?: boolean;
};

/** Decides which recovery actions the Prices screen offers alongside an error. */
export type FuelErrorKind = 'general' | 'permission' | 'needsSettings' | 'coverage';

const NO_STATIONS_MESSAGE =
  'No stations found nearby for that fuel type and brand selection. Try another fuel type, or clear the brand filter in Settings.';

const noStationsInRangeMessage = (rangeStr: string): string => {
  const usableKm = Math.floor(Number.parseFloat(rangeStr) || 0);
  return `No stations found within about ${usableKm} km of drivable range (your entered range less your safety margin). Check the range in Settings, or call roadside assistance.`;
};

const hasRangeLimit = (rangeStr: string): boolean => Number.parseFloat(rangeStr) > 0;

const midpointBetween = (start: Coordinates, end: Coordinates): Coordinates => ({
  latitude: (start.latitude + end.latitude) / 2,
  longitude: (start.longitude + end.longitude) / 2
});

/**
 * Owns the fuel-data fetching + ranking concern: the ranked results, the
 * loading/error/refreshing flags, the applied fuel type, and the round-trip /
 * one-way fetch pipelines. Exposes stable refs to the fetch functions so
 * callers (initial load, settings save, pull-to-refresh) always invoke the
 * latest closure.
 */
export function useFuelData() {
  const [rankedStations, setRankedStations] = useState<RankedStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsgState] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<FuelErrorKind>('general');
  const [refreshing, setRefreshing] = useState(false);
  const [appliedFuelType, setAppliedFuelType] = useState(DEFAULT_FUEL_TYPE);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [routingEstimated, setRoutingEstimated] = useState(false);
  const [fuelDataCache] = useState(() => createFuelDataCache());

  const isMountedRef = useRef(true);
  const latestRankingRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setErrorMsg = useCallback((message: string | null, kind: FuelErrorKind = 'general') => {
    setErrorMsgState(message);
    setErrorKind(message ? kind : 'general');
  }, []);

  /** A newer request (or unmount) has superseded this one; its result must not touch state. */
  const isSuperseded = useCallback(
    (requestId: number) => !isMountedRef.current || requestId !== latestRankingRequestIdRef.current,
    []
  );

  // `fetchedAt` is when the prices were really fetched, so a re-rank from cache doesn't claim fresher data.
  const markFresh = useCallback((fetchedAt: number = Date.now()) => {
    setLastUpdatedAt(fetchedAt);
    setRoutingEstimated(getRoutingSessionSource() === 'estimated');
  }, []);

  /** Rejects after the live-data timeout; `cancel` stops the timer once the work settles. */
  const createWatchdog = useCallback(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const promise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Live data timed out after ${LIVE_DATA_TIMEOUT_MS / 1000}s`));
      }, LIVE_DATA_TIMEOUT_MS);
    });
    return {
      promise,
      cancel: () => {
        if (timer) clearTimeout(timer);
      }
    };
  }, []);

  const fetchAndRankFuelData = useCallback(
    async (
      userLat: number,
      userLon: number,
      needed: string,
      economy: string,
      fuelTypeInput: string,
      brandsInput: string[],
      rangeStr = '',
      options: FetchOptions = {}
    ) => {
      // Claim the request id up front so a slow, older response can never overwrite a newer one.
      const requestId = ++latestRankingRequestIdRef.current;
      const watchdog = createWatchdog();

      const doWork = (async () => {
        beginRoutingSession();
        const requestFuelType = normaliseFuelType(fuelTypeInput);
        const requestBrands = normaliseBrands(brandsInput);

        const cacheRequest = {
          mode: 'roundTrip' as const,
          start: { latitude: userLat, longitude: userLon },
          fuelType: requestFuelType,
          brands: requestBrands
        };
        const cached = options.allowCache ? fuelDataCache.read(cacheRequest) : null;

        let selectedData: FuelApiData | null;
        let fetchedAt = Date.now();
        if (cached) {
          selectedData = cached.data;
          fetchedAt = cached.fetchedAt;
        } else {
          const accessToken = await getAccessToken();
          selectedData = await fetchNearbyFuelData(
            accessToken,
            requestBrands,
            userLat,
            userLon,
            NEARBY_RADIUS_KM,
            requestFuelType
          );
          fetchedAt = Date.now();
          if (selectedData) fuelDataCache.write(cacheRequest, selectedData, fetchedAt);
        }
        if (isSuperseded(requestId)) return;

        if (!selectedData) {
          if (isLikelyOutsideCoverage(userLat, userLon)) {
            setRankedStations([]);
            setLoading(false);
            setErrorMsg(OUTSIDE_COVERAGE_MESSAGE, 'coverage');
            return;
          }
          throw new Error('Nearby API returned no usable stations for the selected radius.');
        }

        const topStations = await computeRankedStations(selectedData, userLat, userLon, needed, economy, rangeStr);
        if (isSuperseded(requestId)) return;

        setAppliedFuelType(requestFuelType);
        setLoading(false);

        if (topStations.length > 0) {
          setRankedStations(topStations);
          setErrorMsg(null);
          markFresh(fetchedAt);
          return;
        }

        if (hasRangeLimit(rangeStr)) {
          // A range limit makes old results wrong, not merely stale, so never keep them.
          setRankedStations([]);
          setErrorMsg(noStationsInRangeMessage(rangeStr));
          return;
        }
        // Nothing matched this fuel type/brand selection, so the previous list would be mislabelled.
        setRankedStations([]);
        setErrorMsg(NO_STATIONS_MESSAGE);
      })();

      try {
        await Promise.race([doWork, watchdog.promise]);
      } catch (err) {
        if (isSuperseded(requestId)) return;
        const liveError = getErrorMessage(err, 'Live data request failed.');
        console.warn(`Live data failed: ${liveError}`);
        setLoading(false);
        setErrorMsg('Could not refresh live fuel prices right now. Check your connection and try again.');
      } finally {
        watchdog.cancel();
      }
    },
    [createWatchdog, fuelDataCache, isSuperseded, markFresh, setErrorMsg]
  );

  const fetchTripCandidatePool = useCallback(
    async (
      accessToken: string,
      start: Coordinates,
      destination: Coordinates,
      fuelTypeInput: string,
      brandsInput: string[]
    ) => {
      const normalizedFuelType = normaliseFuelType(fuelTypeInput);
      const normalizedBrands = normaliseBrands(brandsInput);
      const samples: Coordinates[] = [start, midpointBetween(start, destination), destination];
      const responses = await Promise.allSettled(
        samples.map((sample) =>
          fetchNearbyFuelData(
            accessToken,
            normalizedBrands,
            sample.latitude,
            sample.longitude,
            TRIP_SAMPLE_RADIUS_KM,
            normalizedFuelType
          )
        )
      );

      const stationByCode = new Map<string, FuelApiData['stations'][number]>();
      const priceByCode = new Map<string, FuelApiData['prices'][number]>();

      const mergeInto = (data: FuelApiData) => {
        for (const station of data.stations) {
          if (!stationByCode.has(station.code)) {
            stationByCode.set(station.code, station);
          }
        }
        for (const price of data.prices) {
          const current = priceByCode.get(String(price.stationcode));
          if (!current || price.price < current.price) {
            priceByCode.set(String(price.stationcode), price);
          }
        }
      };

      for (const response of responses) {
        if (response.status === 'fulfilled' && response.value) mergeInto(response.value);
      }

      if (stationByCode.size === 0) {
        // If all sampled calls failed or returned empty, do one broader fallback around start.
        const fallbackData = await fetchNearbyFuelData(
          accessToken,
          normalizedBrands,
          start.latitude,
          start.longitude,
          TRIP_SAMPLE_RADIUS_KM * 2,
          normalizedFuelType
        );
        if (fallbackData) mergeInto(fallbackData);
      }

      return {
        stations: Array.from(stationByCode.values()),
        prices: Array.from(priceByCode.values())
      } as FuelApiData;
    },
    []
  );

  const fetchAndRankTripData = useCallback(
    async (
      start: Coordinates,
      destination: Coordinates,
      needed: string,
      economy: string,
      fuelTypeInput: string,
      brandsInput: string[],
      rangeStr = '',
      options: FetchOptions = {}
    ) => {
      const requestId = ++latestRankingRequestIdRef.current;
      const watchdog = createWatchdog();

      const doWork = (async () => {
        beginRoutingSession();
        const normalizedFuelType = normaliseFuelType(fuelTypeInput);
        const normalizedBrands = normaliseBrands(brandsInput);
        const cacheRequest = {
          mode: 'oneWay' as const,
          start,
          destination,
          fuelType: normalizedFuelType,
          brands: normalizedBrands
        };
        const cached = options.allowCache ? fuelDataCache.read(cacheRequest) : null;

        let tripData: FuelApiData;
        let fetchedAt = Date.now();
        if (cached) {
          tripData = cached.data;
          fetchedAt = cached.fetchedAt;
        } else {
          const accessToken = await getAccessToken();
          tripData = await fetchTripCandidatePool(accessToken, start, destination, normalizedFuelType, normalizedBrands);
          fetchedAt = Date.now();
          if (tripData.stations.length > 0) fuelDataCache.write(cacheRequest, tripData, fetchedAt);
        }
        if (isSuperseded(requestId)) return;
        if (tripData.stations.length === 0) {
          if (isLikelyOutsideCoverage(start.latitude, start.longitude)) {
            setRankedStations([]);
            setLoading(false);
            setErrorMsg(OUTSIDE_COVERAGE_MESSAGE, 'coverage');
            return;
          }
          throw new Error('No stations returned for trip sampling. Please retry in a moment.');
        }
        const topStations = await computeTripRankedStations({
          data: tripData,
          start,
          destination,
          neededStr: needed,
          economyStr: economy,
          rangeStr
        });

        if (isSuperseded(requestId)) return;

        setAppliedFuelType(normalizedFuelType);
        setLoading(false);
        if (topStations.length > 0) {
          setRankedStations(topStations);
          setErrorMsg(null);
          markFresh(fetchedAt);
          return;
        }

        setRankedStations([]);
        setErrorMsg(
          hasRangeLimit(rangeStr)
            ? noStationsInRangeMessage(rangeStr)
            : 'No feasible one-stop stations found for this trip. Live routing may be unavailable, so try again shortly or broaden brands/fuel type.'
        );
      })();

      try {
        await Promise.race([doWork, watchdog.promise]);
      } catch (err) {
        if (isSuperseded(requestId)) return;
        const liveError = getErrorMessage(err, 'Trip mode request failed.');
        console.warn(`Trip mode failed: ${liveError}`);
        setLoading(false);
        setErrorMsg('Could not refresh live trip routing right now. Check your connection and try again.');
      } finally {
        watchdog.cancel();
      }
    },
    [createWatchdog, fetchTripCandidatePool, fuelDataCache, isSuperseded, markFresh, setErrorMsg]
  );

  const fetchAndRankFuelDataRef = useRef(fetchAndRankFuelData);
  const fetchAndRankTripDataRef = useRef(fetchAndRankTripData);
  useLayoutEffect(() => {
    fetchAndRankFuelDataRef.current = fetchAndRankFuelData;
    fetchAndRankTripDataRef.current = fetchAndRankTripData;
  }, [fetchAndRankFuelData, fetchAndRankTripData]);

  return {
    rankedStations,
    loading,
    setLoading,
    errorMsg,
    errorKind,
    setErrorMsg,
    lastUpdatedAt,
    routingEstimated,
    refreshing,
    setRefreshing,
    appliedFuelType,
    setAppliedFuelType,
    fetchAndRankFuelDataRef,
    fetchAndRankTripDataRef
  };
}
