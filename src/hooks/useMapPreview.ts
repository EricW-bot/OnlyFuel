import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Linking, Platform } from 'react-native';
import type { LocationObject } from 'expo-location';
import type { AppMode, Coordinates, ExpoMapMarker, ExpoMapPolyline, RankedStation } from '@/types';
import type { AddressSuggestion } from '@/services/geocodingClient';
import {
  buildExternalMapUrl,
  ExternalMapTripContext,
  openGoogleMapsForStation
} from '@/lib/appHelpers';
import { fetchOneWayRouteGeometry, fetchRoundTripRouteGeometry } from '@/lib/routeGeometryHelpers';
import type { getPalette } from '@/theme/theme';

type UseMapPreviewArgs = {
  appMode: AppMode;
  useCurrentLocation: boolean;
  userLocation: LocationObject | null;
  selectedStartAddress: AddressSuggestion | null;
  tripDestination: Coordinates;
  tripStartAddress: string;
  tripDestinationAddress: string;
  mapStation: RankedStation | null;
  isNativeMapPreviewAvailable: boolean;
  palette: ReturnType<typeof getPalette>;
};

// Picks a zoom level from the lat/lon span of the points being framed.
const zoomForSpan = (span: number): number =>
  span > 1 ? 7 : span > 0.5 ? 8 : span > 0.2 ? 9 : span > 0.1 ? 10 : span > 0.05 ? 11 : span > 0.02 ? 12 : 13;

/**
 * Derives everything the station map preview needs (start points, markers,
 * polylines, camera framing) from the current trip settings + selected
 * station, and owns the live route-geometry fetches.
 */
export function useMapPreview({
  appMode,
  useCurrentLocation,
  userLocation,
  selectedStartAddress,
  tripDestination,
  tripStartAddress,
  tripDestinationAddress,
  mapStation,
  isNativeMapPreviewAvailable,
  palette
}: UseMapPreviewArgs) {
  const [oneWayRouteGeometry, setOneWayRouteGeometry] = useState<Coordinates[] | null>(null);
  const [roundTripRouteGeometry, setRoundTripRouteGeometry] = useState<Coordinates[] | null>(null);

  const stationMarker = useMemo<ExpoMapMarker | null>(() => {
    if (!mapStation) {
      return null;
    }
    return {
      id: 'station',
      coordinates: {
        latitude: mapStation.location.latitude,
        longitude: mapStation.location.longitude
      },
      title: mapStation.name,
      snippet: mapStation.address || 'Fuel station'
    };
  }, [mapStation]);

  const userMarker = useMemo<ExpoMapMarker | null>(() => {
    if (!userLocation) {
      return null;
    }
    return {
      id: 'user-location',
      coordinates: {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      },
      title: 'Your Location',
      snippet: 'Current position'
    };
  }, [userLocation]);

  const oneWayStartPoint = useMemo<Coordinates | null>(() => {
    if (appMode !== 'oneWay') {
      return null;
    }
    if (useCurrentLocation) {
      if (!userLocation) {
        return null;
      }
      return {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      };
    }
    return selectedStartAddress?.coordinates ?? null;
  }, [appMode, useCurrentLocation, userLocation, selectedStartAddress]);

  const roundTripStartPoint = useMemo<Coordinates | null>(() => {
    if (appMode !== 'roundTrip') {
      return null;
    }
    if (useCurrentLocation) {
      if (!userLocation) {
        return null;
      }
      return {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      };
    }
    return selectedStartAddress?.coordinates ?? null;
  }, [appMode, selectedStartAddress, useCurrentLocation, userLocation]);

  const openExternalMapForStation = useCallback(
    (station: RankedStation) => {
      let tripContext: ExternalMapTripContext | undefined = undefined;

      if (appMode === 'oneWay' && oneWayStartPoint) {
        tripContext = { appMode, start: oneWayStartPoint, destination: tripDestination };
      } else if (appMode === 'roundTrip' && roundTripStartPoint) {
        tripContext = { appMode, start: roundTripStartPoint, destination: roundTripStartPoint };
      }

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Apple Maps', 'Google Maps', 'Cancel'],
            cancelButtonIndex: 2,
            title: 'Open directions'
          },
          (buttonIndex) => {
            if (buttonIndex === 0) {
              void Linking.openURL(buildExternalMapUrl(station, 'apple', Platform.OS, tripContext));
            } else if (buttonIndex === 1) {
              void openGoogleMapsForStation(station, tripContext);
            }
          }
        );
        return;
      }
      void Linking.openURL(buildExternalMapUrl(station, undefined, Platform.OS, tripContext));
    },
    [appMode, oneWayStartPoint, roundTripStartPoint, tripDestination]
  );

  const destinationMarker = useMemo<ExpoMapMarker | null>(() => {
    if (appMode !== 'oneWay') {
      return null;
    }
    return {
      id: 'destination',
      coordinates: {
        latitude: tripDestination.latitude,
        longitude: tripDestination.longitude
      },
      title: 'Destination',
      snippet: tripDestinationAddress.trim() || 'Trip destination'
    };
  }, [appMode, tripDestination, tripDestinationAddress]);

  const roundTripStartMarker = useMemo<ExpoMapMarker | null>(() => {
    if (!roundTripStartPoint) {
      return null;
    }
    return {
      id: 'round-trip-start',
      coordinates: roundTripStartPoint,
      title: useCurrentLocation ? 'Start (GPS)' : 'Start',
      snippet: useCurrentLocation ? 'Current location' : tripStartAddress.trim() || 'Trip start'
    };
  }, [roundTripStartPoint, tripStartAddress, useCurrentLocation]);

  const startMarker = useMemo<ExpoMapMarker | null>(() => {
    if (!oneWayStartPoint) {
      return null;
    }
    return {
      id: 'trip-start',
      coordinates: oneWayStartPoint,
      title: useCurrentLocation ? 'Start (GPS)' : 'Start',
      snippet: useCurrentLocation ? 'Current location' : tripStartAddress.trim() || 'Trip start'
    };
  }, [oneWayStartPoint, useCurrentLocation, tripStartAddress]);

  useEffect(() => {
    let cancelled = false;
    const stationPoint = mapStation
      ? {
        latitude: mapStation.location.latitude,
        longitude: mapStation.location.longitude
      }
      : null;

    if (appMode !== 'oneWay' || !oneWayStartPoint || !stationPoint || !isNativeMapPreviewAvailable) {
      setOneWayRouteGeometry(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const geometry = await fetchOneWayRouteGeometry(oneWayStartPoint, stationPoint, tripDestination);
      if (!cancelled) {
        setOneWayRouteGeometry(geometry);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appMode, isNativeMapPreviewAvailable, mapStation, oneWayStartPoint, tripDestination]);

  useEffect(() => {
    let cancelled = false;
    const stationPoint = mapStation
      ? {
        latitude: mapStation.location.latitude,
        longitude: mapStation.location.longitude
      }
      : null;

    if (Platform.OS === 'web' || appMode !== 'roundTrip' || !roundTripStartPoint || !stationPoint) {
      setRoundTripRouteGeometry(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const geometry = await fetchRoundTripRouteGeometry(roundTripStartPoint, stationPoint);
      if (!cancelled) {
        setRoundTripRouteGeometry(geometry);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appMode, mapStation, roundTripStartPoint]);

  const mapMarkers = useMemo<ExpoMapMarker[]>(
    () =>
      appMode === 'oneWay'
        ? [startMarker, stationMarker, destinationMarker].filter((marker): marker is ExpoMapMarker => marker !== null)
        : [roundTripStartMarker, stationMarker, userMarker].filter((marker): marker is ExpoMapMarker => marker !== null),
    [appMode, destinationMarker, roundTripStartMarker, startMarker, stationMarker, userMarker]
  );

  const mapPolylines = useMemo<ExpoMapPolyline[]>(
    () =>
      appMode === 'oneWay' && oneWayStartPoint && mapStation
        ? [
          {
            id: 'one-way-route',
            coordinates: [
              ...(oneWayRouteGeometry ?? [
                oneWayStartPoint,
                {
                  latitude: mapStation.location.latitude,
                  longitude: mapStation.location.longitude
                },
                {
                  latitude: tripDestination.latitude,
                  longitude: tripDestination.longitude
                }
              ])
            ],
            color: palette.primary,
            width: 4
          }
        ]
        : appMode === 'roundTrip' && roundTripStartPoint && mapStation
          ? [
            {
              id: 'round-trip-route',
              coordinates: [
                ...(roundTripRouteGeometry ?? [
                  roundTripStartPoint,
                  {
                    latitude: mapStation.location.latitude,
                    longitude: mapStation.location.longitude
                  },
                  roundTripStartPoint
                ])
              ],
              color: palette.primary,
              width: 4
            }
          ]
          : [],
    [
      appMode,
      mapStation,
      oneWayRouteGeometry,
      oneWayStartPoint,
      palette.primary,
      roundTripRouteGeometry,
      roundTripStartPoint,
      tripDestination
    ]
  );

  const mapCameraPosition = useMemo(() => {
    if (!mapStation) {
      return {
        coordinates: { latitude: 0, longitude: 0 },
        zoom: 14
      };
    }

    if (appMode === 'oneWay' && oneWayStartPoint) {
      const latitudes = [oneWayStartPoint.latitude, mapStation.location.latitude, tripDestination.latitude];
      const longitudes = [oneWayStartPoint.longitude, mapStation.location.longitude, tripDestination.longitude];
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLon = Math.min(...longitudes);
      const maxLon = Math.max(...longitudes);
      const span = Math.max(maxLat - minLat, maxLon - minLon);

      return {
        coordinates: {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2
        },
        zoom: zoomForSpan(span)
      };
    }

    if (appMode === 'roundTrip' && roundTripStartPoint) {
      const latitudes = [roundTripStartPoint.latitude, mapStation.location.latitude];
      const longitudes = [roundTripStartPoint.longitude, mapStation.location.longitude];
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLon = Math.min(...longitudes);
      const maxLon = Math.max(...longitudes);
      const span = Math.max(maxLat - minLat, maxLon - minLon);

      return {
        coordinates: {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2
        },
        zoom: zoomForSpan(span)
      };
    }

    return {
      coordinates: {
        latitude: mapStation.location.latitude,
        longitude: mapStation.location.longitude
      },
      zoom: 14
    };
  }, [appMode, mapStation, oneWayStartPoint, roundTripStartPoint, tripDestination]);

  return {
    oneWayStartPoint,
    roundTripStartPoint,
    mapMarkers,
    mapPolylines,
    mapCameraPosition,
    openExternalMapForStation
  };
}
