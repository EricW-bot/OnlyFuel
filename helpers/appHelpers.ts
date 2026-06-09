import { Linking, Platform } from 'react-native';
import type { AppMode, Coordinates, RankedStation } from '../Interface';

export type MapExternalProvider = 'apple' | 'google';

export type ExternalMapTripContext = {
  appMode: AppMode;
  start: Coordinates | null;
  destination: Coordinates;
};

type OneWayExternalMapTripContext = {
  appMode: 'oneWay';
  start: Coordinates;
  destination: Coordinates;
};

type RoundTripExternalMapTripContext = {
  appMode: 'roundTrip';
  start: Coordinates;
  destination: Coordinates;
};

function formatCoordinates(coords: Coordinates): string {
  return `${coords.latitude},${coords.longitude}`;
}

function isOneWayTripContext(trip: ExternalMapTripContext | undefined): trip is OneWayExternalMapTripContext {
  return trip?.appMode === 'oneWay' && trip.start !== null;
}

function isRoundTripTripContext(trip: ExternalMapTripContext | undefined): trip is RoundTripExternalMapTripContext {
  return trip?.appMode === 'roundTrip' && trip.start !== null;
}

function buildAppleOneWayDirectionsUrl(start: Coordinates, station: Coordinates, destination: Coordinates): string {
  const params = new URLSearchParams({
    source: formatCoordinates(start),
    destination: formatCoordinates(destination),
    waypoint: formatCoordinates(station),
    mode: 'driving'
  });
  return `https://maps.apple.com/directions?${params.toString()}`;
}

function buildGoogleOneWayDirectionsUrl(start: Coordinates, station: Coordinates, destination: Coordinates): string {
  const params = new URLSearchParams({
    api: '1',
    origin: formatCoordinates(start),
    destination: formatCoordinates(destination),
    waypoints: formatCoordinates(station),
    travelmode: 'driving'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildAppleRoundTripDirectionsUrl(start: Coordinates, station: Coordinates, destination: Coordinates): string {
  const params = new URLSearchParams({
    source: formatCoordinates(start),
    destination: formatCoordinates(destination),
    waypoint: formatCoordinates(station),
    mode: 'driving'
  });
  return `https://maps.apple.com/directions?${params.toString()}`;
}

function buildGoogleRoundTripDirectionsUrl(start: Coordinates, station: Coordinates, destination: Coordinates): string {
  const params = new URLSearchParams({
    api: '1',
    origin: formatCoordinates(start),
    destination: formatCoordinates(destination),
    waypoints: formatCoordinates(station),
    travelmode: 'driving'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export const GOOGLE_MAPS_IOS_SCHEME = 'comgooglemaps://';

export const LOCATION_TIMEOUT_MS = 15000;
export const LIVE_DATA_TIMEOUT_MS = 180000;

export function getTripAddressMissingMessage(
  startAddress: string,
  destinationAddress: string,
  useGpsForStart: boolean
): string | null {
  const missing: string[] = [];
  if (!useGpsForStart && startAddress.trim().length === 0) {
    missing.push('start address');
  }
  if (destinationAddress.trim().length === 0) {
    missing.push('destination address');
  }
  if (missing.length === 0) {
    return null;
  }
  return `One-way mode needs ${missing.join(' and ')}. Please set the missing address(es) in Settings.`;
}

export function getRoundTripStartMissingMessage(startAddress: string, useGpsForStart: boolean): string | null {
  if (useGpsForStart || startAddress.trim().length > 0) {
    return null;
  }
  return 'Round-trip mode needs a start address when GPS start is off. Please set Start Address in Settings.';
}

export function buildWebMapEmbedUrl(
  stationLatitude: number,
  stationLongitude: number,
  currentLocation?: { latitude: number; longitude: number } | null
): string {
  const station = `${stationLatitude},${stationLongitude}`;
  if (currentLocation) {
    const origin = `${currentLocation.latitude},${currentLocation.longitude}`;
    return `https://maps.google.com/maps?output=embed&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(station)}`;
  }
  return `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(station)}`;
}

export function buildWebOneWayMapEmbedUrl(start: Coordinates, station: Coordinates, destination: Coordinates): string {
  const origin = `${start.latitude},${start.longitude}`;
  const stop = `${station.latitude},${station.longitude}`;
  const end = `${destination.latitude},${destination.longitude}`;
  return `https://maps.google.com/maps?output=embed&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(end)}&waypoints=${encodeURIComponent(stop)}`;
}

export function buildWebRoundTripMapEmbedUrl(start: Coordinates, station: Coordinates, destination: Coordinates): string {
  const origin = `${start.latitude},${start.longitude}`;
  const stop = `${station.latitude},${station.longitude}`;
  const end = `${destination.latitude},${destination.longitude}`;
  return `https://maps.google.com/maps?output=embed&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(end)}&waypoints=${encodeURIComponent(stop)}`;
}

export function buildExternalMapUrl(
  station: RankedStation,
  provider?: MapExternalProvider,
  platformOs: string = Platform.OS,
  trip?: ExternalMapTripContext
): string {
  const { latitude, longitude } = station.location;
  const label = encodeURIComponent(station.name);
  const query = `${latitude},${longitude}`;
  const useApple = provider ? provider === 'apple' : platformOs === 'ios';
  const stationCoords = station.location;

  if (isOneWayTripContext(trip)) {
    if (useApple) {
      return buildAppleOneWayDirectionsUrl(trip.start, stationCoords, trip.destination);
    }
    return buildGoogleOneWayDirectionsUrl(trip.start, stationCoords, trip.destination);
  }

  if (isRoundTripTripContext(trip)) {
    if (useApple) {
      return buildAppleRoundTripDirectionsUrl(trip.start, stationCoords, trip.destination);
    }
    return buildGoogleRoundTripDirectionsUrl(trip.start, stationCoords, trip.destination);
  }

  return useApple
    ? `https://maps.apple.com/?ll=${query}&q=${label}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildGoogleMapsIosAppUrl(station: RankedStation, trip?: ExternalMapTripContext): string {
  if (isOneWayTripContext(trip)) {
    return buildGoogleOneWayDirectionsUrl(trip.start, station.location, trip.destination);
  }
  const { latitude, longitude } = station.location;
  const query = `${latitude},${longitude}`;
  return `comgooglemaps://?daddr=${query}&directionsmode=driving`;
}

export async function openGoogleMapsForStation(station: RankedStation, trip?: ExternalMapTripContext): Promise<void> {
  if (isOneWayTripContext(trip)) {
    await Linking.openURL(buildGoogleOneWayDirectionsUrl(trip.start, station.location, trip.destination));
    return;
  }

  const webUrl = buildExternalMapUrl(station, 'google', Platform.OS, trip);
  try {
    const canOpen = await Linking.canOpenURL(GOOGLE_MAPS_IOS_SCHEME);
    if (canOpen) {
      await Linking.openURL(buildGoogleMapsIosAppUrl(station, trip));
      return;
    }
  } catch {
    // Fall back to the HTTPS Google Maps URL.
  }
  await Linking.openURL(webUrl);
}
