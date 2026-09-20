import { useCallback, useEffect, useRef, useState } from 'react';
import { computeRankedStations, computeTripRankedStations } from '@/lib/calculations';
import { beginRoutingSession } from '@/services/routingClient';
import { DEFAULT_FUEL_TYPE, NEARBY_RADIUS_KM, TRIP_SAMPLE_RADIUS_KM } from '@/constants';
import { fetchNearbyFuelData, getAccessToken } from '@/services/fuelApiClient';
import type { Coordinates, FuelApiData, RankedStation } from '@/types';
import { getErrorMessage, normaliseBrands, normaliseFuelType } from '@/lib/utils';
import { LIVE_DATA_TIMEOUT_MS } from '@/lib/appHelpers';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appliedFuelType, setAppliedFuelType] = useState(DEFAULT_FUEL_TYPE);

  const isMountedRef = useRef(true);
  const latestRankingRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processAndRank = useCallback(
    async (data: FuelApiData, userLat: number, userLon: number, neededStr: string, economyStr: string): Promise<number> => {
      const requestId = ++latestRankingRequestIdRef.current;
      const topStations = await computeRankedStations(data, userLat, userLon, neededStr, economyStr);

      if (!isMountedRef.current || requestId !== latestRankingRequestIdRef.current) {
        return -1;
      }

      if (topStations.length > 0) {
        setRankedStations(topStations);
      }
      setLoading(false);
      return topStations.length;
    },
    []
  );

  const fetchAndRankFuelData = useCallback(
    async (userLat: number, userLon: number, needed: string, economy: string, fuelTypeInput: string, brandsInput: string[]) => {
      const watchdog = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Live data timed out after ${LIVE_DATA_TIMEOUT_MS / 1000}s`));
        }, LIVE_DATA_TIMEOUT_MS);
      });

      const doWork = (async () => {
        beginRoutingSession();
        const requestFuelType = normaliseFuelType(fuelTypeInput);
        const requestBrands = normaliseBrands(brandsInput);

        const accessToken = await getAccessToken();

        const selectedData = await fetchNearbyFuelData(
          accessToken,
          requestBrands,
          userLat,
          userLon,
          NEARBY_RADIUS_KM,
          requestFuelType
        );

        if (!selectedData) {
          throw new Error('Nearby API returned no usable stations for the selected radius.');
        }

        setAppliedFuelType(requestFuelType);
        setErrorMsg(null);

        const rankedCount = await processAndRank(selectedData, userLat, userLon, needed, economy);
        if (rankedCount === -1) {
          return;
        }
        if (rankedCount === 0) {
          setLoading(false);
          setErrorMsg('No rankable stations were returned for that fuel type/radius. Existing results kept.');
          return;
        }
      })();

      try {
        await Promise.race([doWork, watchdog]);
      } catch (err) {
        const liveError = getErrorMessage(err, 'Live data request failed.');
        console.warn(`Live data failed: ${liveError}`);
        setLoading(false);
        setErrorMsg('Could not refresh live fuel prices right now. Please try again in a moment.');
      }
    },
    [processAndRank]
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

      for (const response of responses) {
        if (response.status !== 'fulfilled' || !response.value) continue;
        for (const station of response.value.stations) {
          if (!stationByCode.has(station.code)) {
            stationByCode.set(station.code, station);
          }
        }
        for (const price of response.value.prices) {
          const current = priceByCode.get(String(price.stationcode));
          if (!current || price.price < current.price) {
            priceByCode.set(String(price.stationcode), price);
          }
        }
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
        if (fallbackData) {
          for (const station of fallbackData.stations) {
            if (!stationByCode.has(station.code)) {
              stationByCode.set(station.code, station);
            }
          }
          for (const price of fallbackData.prices) {
            const current = priceByCode.get(String(price.stationcode));
            if (!current || price.price < current.price) {
              priceByCode.set(String(price.stationcode), price);
            }
          }
        }
      }

      return {
        stations: Array.from(stationByCode.values()),
        prices: Array.from(priceByCode.values())
      } as FuelApiData;
    },
    []
  );

  const fetchAndRankTripData = useCallback(
    async (start: Coordinates, destination: Coordinates, needed: string, economy: string, fuelTypeInput: string, brandsInput: string[]) => {
      const watchdog = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Live data timed out after ${LIVE_DATA_TIMEOUT_MS / 1000}s`));
        }, LIVE_DATA_TIMEOUT_MS);
      });

      const doWork = (async () => {
        beginRoutingSession();
        const requestId = ++latestRankingRequestIdRef.current;
        const normalizedFuelType = normaliseFuelType(fuelTypeInput);
        const normalizedBrands = normaliseBrands(brandsInput);
        const accessToken = await getAccessToken();
        const tripData = await fetchTripCandidatePool(
          accessToken,
          start,
          destination,
          normalizedFuelType,
          normalizedBrands
        );
        if (tripData.stations.length === 0) {
          throw new Error('No stations returned for trip sampling. Please retry in a moment.');
        }
        const topStations = await computeTripRankedStations({
          data: tripData,
          start,
          destination,
          neededStr: needed,
          economyStr: economy
        });

        if (!isMountedRef.current || requestId !== latestRankingRequestIdRef.current) {
          return;
        }

        setAppliedFuelType(normalizedFuelType);
        setErrorMsg(null);
        if (topStations.length > 0) {
          setRankedStations(topStations);
          setLoading(false);
          return;
        }

        setLoading(false);
        setErrorMsg(
          'No feasible one-stop stations found for this trip. Live routing may be unavailable, so try again shortly or broaden brands/fuel type.'
        );
      })();

      try {
        await Promise.race([doWork, watchdog]);
      } catch (err) {
        const liveError = getErrorMessage(err, 'Trip mode request failed.');
        console.warn(`Trip mode failed: ${liveError}`);
        setLoading(false);
        setErrorMsg('Could not refresh live trip routing right now. Please try again shortly.');
      }
    },
    [fetchTripCandidatePool]
  );

  const fetchAndRankFuelDataRef = useRef(fetchAndRankFuelData);
  fetchAndRankFuelDataRef.current = fetchAndRankFuelData;
  const fetchAndRankTripDataRef = useRef(fetchAndRankTripData);
  fetchAndRankTripDataRef.current = fetchAndRankTripData;

  return {
    rankedStations,
    loading,
    setLoading,
    errorMsg,
    setErrorMsg,
    refreshing,
    setRefreshing,
    appliedFuelType,
    setAppliedFuelType,
    fetchAndRankFuelDataRef,
    fetchAndRankTripDataRef
  };
}
