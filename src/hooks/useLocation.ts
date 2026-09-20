import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { getCurrentLocationWithTimeout } from '@/lib/locationHelpers';

// expo-location keeps one pending resolver per permission type natively, so a second
// concurrent request overwrites the first and leaves its promise unresolved forever.
// Both tabs mount an App instance at launch, so share a single in-flight request.
let foregroundPermissionRequest: Promise<Location.LocationPermissionResponse> | null = null;
const requestForegroundPermissionOnce = (): Promise<Location.LocationPermissionResponse> => {
  if (!foregroundPermissionRequest) {
    foregroundPermissionRequest = Location.requestForegroundPermissionsAsync().finally(() => {
      foregroundPermissionRequest = null;
    });
  }
  return foregroundPermissionRequest;
};

type RefreshLocationResult = {
  success: boolean;
  errorMsg?: string;
  location: Location.LocationObject | null;
};

export function useLocation() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  const fetchLocation = useCallback(async (requirePermission: boolean): Promise<RefreshLocationResult> => {
    try {
      if (requirePermission) {
        const { status } = await requestForegroundPermissionOnce();
        if (status !== 'granted') {
          return {
            success: false,
            errorMsg: 'Permission to access location was denied.',
            location: null
          };
        }
        const loc = await getCurrentLocationWithTimeout();
        setUserLocation(loc);
        return { success: true, location: loc };
      } else {
        // Soft fetch: only grab if permitted already, don't fail if not
        const permissions = await Location.getForegroundPermissionsAsync();
        if (permissions.status === 'granted') {
          const loc = await getCurrentLocationWithTimeout();
          if (loc) {
            setUserLocation(loc);
            return { success: true, location: loc };
          }
        }
        return { success: true, location: null };
      }
    } catch {
      if (requirePermission) {
        return {
          success: false,
          errorMsg: 'Could not get current location. Try again or use start address.',
          location: null
        };
      }
      return { success: true, location: null }; // Soft fail in address mode
    }
  }, []);

  return {
    userLocation,
    setUserLocation,
    fetchLocation
  };
}
