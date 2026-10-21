import { act, renderHook } from '@testing-library/react-native';
import { useFuelData } from '@/hooks/useFuelData';

const mockGetAccessToken = jest.fn(async () => 'token');
const mockFetchNearbyFuelData = jest.fn();

jest.mock('@/services/fuelApiClient', () => ({
  getAccessToken: () => mockGetAccessToken(),
  fetchNearbyFuelData: (...args: unknown[]) => mockFetchNearbyFuelData(...args)
}));
jest.mock('@/services/routingClient', () => ({
  beginRoutingSession: jest.fn(),
  getRoutingSessionSource: () => 'live',
  fetchRouteDistanceDuration: jest.fn(async () => ({ distanceKm: 1, durationMin: 2 })),
  fetchRouteVia: jest.fn(),
  planRouteDistanceDuration: jest.fn(),
  routeMetricsFromKnownDistanceKm: (distanceKm: number) => ({ distanceKm, durationMin: distanceKm })
}));

// Distances (km) come from the API, so ranking needs no routing.
const distances = [20, 12, 6, 3];
const apiData = {
  stations: distances.map((distance, index) => ({
    code: `S${index}`,
    name: `Station ${index}`,
    location: { latitude: -33.9, longitude: 151.2, distance }
  })),
  prices: distances.map((_, index) => ({ stationcode: `S${index}`, price: 150 + index * 10 }))
};

const fetchAt = (
  hook: ReturnType<typeof renderHook<ReturnType<typeof useFuelData>, unknown>>,
  range: string,
  options: { allowCache?: boolean } = {},
  fuelType = 'U91'
) =>
  act(async () => {
    await hook.result.current.fetchAndRankFuelDataRef.current(-33.9, 151.2, '40', '8', fuelType, [], range, options);
  });

describe('useFuelData station cache', () => {
  beforeEach(() => {
    mockGetAccessToken.mockClear();
    mockFetchNearbyFuelData.mockReset();
    mockFetchNearbyFuelData.mockResolvedValue(apiData);
  });

  it('re-ranks from cache without any network request when only the range changes', async () => {
    const hook = renderHook(() => useFuelData());

    await fetchAt(hook, '');
    expect(mockFetchNearbyFuelData).toHaveBeenCalledTimes(1);
    expect(hook.result.current.rankedStations).toHaveLength(4);

    await fetchAt(hook, '8', { allowCache: true });
    expect(mockFetchNearbyFuelData).toHaveBeenCalledTimes(1);
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
    expect(hook.result.current.rankedStations.map((s) => s.code).sort()).toEqual(['S2', 'S3']);

    await fetchAt(hook, '', { allowCache: true });
    expect(mockFetchNearbyFuelData).toHaveBeenCalledTimes(1);
    expect(hook.result.current.rankedStations).toHaveLength(4);
  });

  it('keeps showing when the prices were really fetched, not when they were re-ranked', async () => {
    const hook = renderHook(() => useFuelData());
    await fetchAt(hook, '');
    const fetchedAt = hook.result.current.lastUpdatedAt;

    await new Promise((resolve) => setTimeout(resolve, 20));
    await fetchAt(hook, '8', { allowCache: true });
    expect(hook.result.current.lastUpdatedAt).toBe(fetchedAt);
  });

  it('always refetches when the cache is not allowed (refresh, retry)', async () => {
    const hook = renderHook(() => useFuelData());
    await fetchAt(hook, '');
    await fetchAt(hook, '');
    expect(mockFetchNearbyFuelData).toHaveBeenCalledTimes(2);
  });

  it('refetches when the fuel type changed even if the cache is allowed', async () => {
    const hook = renderHook(() => useFuelData());
    await fetchAt(hook, '');
    await fetchAt(hook, '', { allowCache: true }, 'P95');
    expect(mockFetchNearbyFuelData).toHaveBeenCalledTimes(2);
  });
});
