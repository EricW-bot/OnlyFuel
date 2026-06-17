import {
  buildExternalMapUrl,
  buildGoogleMapsIosAppUrl,
  buildWebMapEmbedUrl,
  buildWebOneWayMapEmbedUrl,
  getRoundTripStartMissingMessage,
  getTripAddressMissingMessage
} from '@/lib/appHelpers';
import type { RankedStation } from '@/types';

describe('appHelpers', () => {
  it('reports missing one-way addresses correctly', () => {
    expect(getTripAddressMissingMessage('12 King St', '34 Queen St', false)).toBeNull();
    expect(getTripAddressMissingMessage('', '34 Queen St', false)).toContain('start address');
    expect(getTripAddressMissingMessage('', '', false)).toContain('start address and destination address');
    expect(getTripAddressMissingMessage('', '34 Queen St', true)).toBeNull();
  });

  it('reports missing round-trip start address only when GPS is off', () => {
    expect(getRoundTripStartMissingMessage('12 King St', false)).toBeNull();
    expect(getRoundTripStartMissingMessage('', true)).toBeNull();
    expect(getRoundTripStartMissingMessage('', false)).toContain('Round-trip mode needs a start address');
  });

  it('builds web embed URL with or without current location', () => {
    const withCurrent = buildWebMapEmbedUrl(-33.86, 151.2, { latitude: -33.9, longitude: 151.21 });
    expect(withCurrent).toContain('output=embed');
    expect(withCurrent).toContain('saddr=');
    expect(withCurrent).toContain('daddr=');

    const withoutCurrent = buildWebMapEmbedUrl(-33.86, 151.2, null);
    expect(withoutCurrent).toContain('output=embed');
    expect(withoutCurrent).toContain('q=');
    expect(withoutCurrent).not.toContain('saddr=');
  });

  it('builds one-way embed URL including station waypoint', () => {
    const url = buildWebOneWayMapEmbedUrl(
      { latitude: -33.9, longitude: 151.1 },
      { latitude: -33.86, longitude: 151.2 },
      { latitude: -33.8, longitude: 151.25 }
    );
    expect(url).toContain('output=embed');
    expect(url).toContain('saddr=');
    expect(url).toContain('daddr=');
    expect(url).toContain('waypoints=');
  });

  it('builds external map URLs per platform', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;

    const iosUrl = buildExternalMapUrl(station, undefined, 'ios');
    const androidUrl = buildExternalMapUrl(station, undefined, 'android');

    expect(iosUrl).toContain('https://maps.apple.com/');
    expect(androidUrl).toContain('https://www.google.com/maps/search/');
  });

  it('builds provider-specific external map URLs on iOS', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;

    const appleUrl = buildExternalMapUrl(station, 'apple', 'ios');
    const googleUrl = buildExternalMapUrl(station, 'google', 'ios');

    expect(appleUrl).toContain('https://maps.apple.com/');
    expect(googleUrl).toContain('https://www.google.com/maps/search/');
  });

  it('builds Google Maps iOS app scheme URL with driving directions', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;

    const url = buildGoogleMapsIosAppUrl(station);

    expect(url).toBe('comgooglemaps://?daddr=-33.86,151.2&directionsmode=driving');
  });

  it('builds one-way Apple Maps directions URL with start, waypoint, and destination', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;
    const trip = {
      appMode: 'oneWay' as const,
      start: { latitude: -33.9, longitude: 151.1 },
      destination: { latitude: -33.8, longitude: 151.25 }
    };

    const url = buildExternalMapUrl(station, 'apple', 'ios', trip);

    expect(url).toContain('https://maps.apple.com/directions');
    expect(url).toContain('source=-33.9%2C151.1');
    expect(url).toContain('destination=-33.8%2C151.25');
    expect(url).toContain('waypoint=-33.86%2C151.2');
    expect(url).toContain('mode=driving');
  });

  it('builds one-way Google Maps directions URL with origin, waypoint, and destination', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;
    const trip = {
      appMode: 'oneWay' as const,
      start: { latitude: -33.9, longitude: 151.1 },
      destination: { latitude: -33.8, longitude: 151.25 }
    };

    const url = buildExternalMapUrl(station, 'google', 'ios', trip);

    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain('origin=-33.9%2C151.1');
    expect(url).toContain('destination=-33.8%2C151.25');
    expect(url).toContain('waypoints=-33.86%2C151.2');
    expect(url).toContain('travelmode=driving');
  });

  it('builds round-trip Apple Maps directions URL with start, waypoint, and destination back to start', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;
    const trip = {
      appMode: 'roundTrip' as const,
      start: { latitude: -33.9, longitude: 151.1 },
      destination: { latitude: -33.9, longitude: 151.1 }
    };

    const url = buildExternalMapUrl(station, 'apple', 'ios', trip);

    expect(url).toContain('https://maps.apple.com/directions');
    expect(url).toContain('source=-33.9%2C151.1');
    expect(url).toContain('destination=-33.9%2C151.1');
    expect(url).toContain('waypoint=-33.86%2C151.2');
    expect(url).toContain('mode=driving');
  });

  it('builds round-trip Google Maps directions URL with origin, waypoint, and destination back to origin', () => {
    const station = {
      code: '123',
      name: 'Test Station',
      location: { latitude: -33.86, longitude: 151.2 },
      priceCents: 199.9,
      distanceKm: 5,
      durationMin: 10,
      totalCostDollars: 52
    } as RankedStation;
    const trip = {
      appMode: 'roundTrip' as const,
      start: { latitude: -33.9, longitude: 151.1 },
      destination: { latitude: -33.9, longitude: 151.1 }
    };

    const url = buildExternalMapUrl(station, 'google', 'ios', trip);

    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain('origin=-33.9%2C151.1');
    expect(url).toContain('destination=-33.9%2C151.1');
    expect(url).toContain('waypoints=-33.86%2C151.2');
    expect(url).toContain('travelmode=driving');
  });
});
