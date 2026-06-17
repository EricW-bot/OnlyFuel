import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { LocationObject } from 'expo-location';
import { BRAND_OPTIONS, DEFAULT_FUEL_TYPE, DEFAULT_TRIP_DESTINATION } from '@/constants';
import type { AppMode, AppTab, Coordinates, SettingsSnapshot } from '@/types';
import {
  fetchAddressSuggestions,
  resolveAddress,
  resolveAddressByPlaceId,
  type AddressSuggestion
} from '@/services/geocodingClient';
import { loadUserPreferences, saveUserPreferences } from '@/services/preferencesStorage';
import { getErrorMessage, normaliseBrands, normaliseFuelType } from '@/lib/utils';
import { getRoundTripStartMissingMessage, getTripAddressMissingMessage } from '@/lib/appHelpers';
import { roundToTwoDecimalPlaces } from '@/lib/numberFormatting';
import { useAddressPicker } from '@/hooks/useAddressPicker';
import { createSettingsSnapshot, hasSettingsSnapshotChanges } from '@/lib/settingsSnapshot';
import { publishSaveOutcome, type SaveResult } from '@/state/settingsSync';
import type { useLocation } from '@/hooks/useLocation';
import type { useFuelData } from '@/hooks/useFuelData';

type LoadedPreferences = Awaited<ReturnType<typeof loadUserPreferences>>;

type UseSettingsFormArgs = {
  activeTab: AppTab;
  userLocation: LocationObject | null;
  fetchLocation: ReturnType<typeof useLocation>['fetchLocation'];
  setLoading: ReturnType<typeof useFuelData>['setLoading'];
  setErrorMsg: ReturnType<typeof useFuelData>['setErrorMsg'];
  fetchAndRankFuelDataRef: ReturnType<typeof useFuelData>['fetchAndRankFuelDataRef'];
  fetchAndRankTripDataRef: ReturnType<typeof useFuelData>['fetchAndRankTripDataRef'];
  onSettingsSaved?: () => void;
};

/**
 * Owns the Settings form: all editable trip/vehicle state, the address
 * pickers, the saved-snapshot diffing that drives the "pending changes"
 * indicator, and the persistence + recalculation that runs on save.
 */
export function useSettingsForm({
  activeTab,
  userLocation,
  fetchLocation,
  setLoading,
  setErrorMsg,
  fetchAndRankFuelDataRef,
  fetchAndRankTripDataRef,
  onSettingsSaved
}: UseSettingsFormArgs) {
  const [appMode, setAppMode] = useState<AppMode>('roundTrip');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [fuelNeeded, setFuelNeeded] = useState('25');
  const [fuelEconomy, setFuelEconomy] = useState('10.0');
  const [fuelType, setFuelType] = useState(DEFAULT_FUEL_TYPE);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [tripDestination, setTripDestination] = useState<Coordinates>(DEFAULT_TRIP_DESTINATION);
  const [tripStartAddress, setTripStartAddress] = useState('');
  const [tripDestinationAddress, setTripDestinationAddress] = useState('');
  const [startSuggestions, setStartSuggestions] = useState<AddressSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingStart, setSearchingStart] = useState(false);
  const [searchingDestination, setSearchingDestination] = useState(false);
  const [isStartInputFocused, setIsStartInputFocused] = useState(false);
  const [isDestinationInputFocused, setIsDestinationInputFocused] = useState(false);
  const [selectedStartAddress, setSelectedStartAddress] = useState<AddressSuggestion | null>(null);
  const [selectedDestinationAddress, setSelectedDestinationAddress] = useState<AddressSuggestion | null>(null);
  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState<SettingsSnapshot | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const isSelectingSuggestionRef = useRef(false);
  const handleSaveSettingsRef = useRef<() => Promise<SaveResult>>(async () => ({ outcome: 'nothing' }));
  const hasPendingSettingsChangesRef = useRef(false);

  const isSettingsTabActive = activeTab === 'settings';

  const startShouldFetchSuggestions =
    isSettingsTabActive && !useCurrentLocation && (Platform.OS !== 'web' || isStartInputFocused);

  const destinationShouldFetchSuggestions =
    isSettingsTabActive && appMode === 'oneWay' && (Platform.OS !== 'web' || isDestinationInputFocused);

  const startAddressPicker = useAddressPicker({
    shouldFetch: startShouldFetchSuggestions,
    value: tripStartAddress,
    setValue: setTripStartAddress,
    selected: selectedStartAddress,
    setSelected: setSelectedStartAddress,
    suggestions: startSuggestions,
    setSuggestions: setStartSuggestions,
    searching: searchingStart,
    setSearching: setSearchingStart,
    isFocused: isStartInputFocused,
    setIsFocused: setIsStartInputFocused,
    isSelectingSuggestionRef,
    fetchAddressSuggestions,
    resolveAddress,
    resolveAddressByPlaceId
  });

  const destinationAddressPicker = useAddressPicker({
    shouldFetch: destinationShouldFetchSuggestions,
    value: tripDestinationAddress,
    setValue: setTripDestinationAddress,
    selected: selectedDestinationAddress,
    setSelected: setSelectedDestinationAddress,
    suggestions: destinationSuggestions,
    setSuggestions: setDestinationSuggestions,
    searching: searchingDestination,
    setSearching: setSearchingDestination,
    isFocused: isDestinationInputFocused,
    setIsFocused: setIsDestinationInputFocused,
    isSelectingSuggestionRef,
    fetchAddressSuggestions,
    resolveAddress,
    resolveAddressByPlaceId
  });

  const toggleBrandSelection = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = prev.includes(brand) ? prev.filter((value) => value !== brand) : [...prev, brand];
      return BRAND_OPTIONS.filter((option) => next.includes(option));
    });
  };

  const startAddressSelected = !!(selectedStartAddress && selectedStartAddress.label === tripStartAddress.trim());
  const destinationAddressSelected = !!(
    selectedDestinationAddress && selectedDestinationAddress.label === tripDestinationAddress.trim()
  );

  const startStatusText = useCurrentLocation
    ? 'Using current location'
    : tripStartAddress.trim().length === 0
      ? 'Start address required'
      : startAddressSelected
        ? 'Start address selected'
        : 'Select a start suggestion';

  const destinationStatusText =
    appMode !== 'oneWay'
      ? null
      : tripDestinationAddress.trim().length === 0
        ? 'Destination address required'
        : destinationAddressSelected
          ? 'Destination address selected'
          : 'Select a destination suggestion';

  const currentSettingsSnapshot = useMemo<SettingsSnapshot>(
    () =>
      createSettingsSnapshot({
        appMode,
        useCurrentLocation,
        fuelNeeded,
        fuelEconomy,
        fuelType,
        selectedBrands,
        tripStartAddress,
        tripDestinationAddress
      }),
    [appMode, useCurrentLocation, fuelNeeded, fuelEconomy, fuelType, selectedBrands, tripStartAddress, tripDestinationAddress]
  );

  const hasPendingSettingsChanges = useMemo(
    () => hasSettingsSnapshotChanges(savedSettingsSnapshot, currentSettingsSnapshot),
    [savedSettingsSnapshot, currentSettingsSnapshot]
  );

  // Hydrate the form from persisted preferences on initial load.
  const hydrate = useCallback((prefs: LoadedPreferences) => {
    const fuelTypeNorm = normaliseFuelType(prefs.fuelType);
    const brandsNorm = normaliseBrands(prefs.selectedBrands);

    setAppMode(prefs.appMode);
    setUseCurrentLocation(prefs.useCurrentLocation);
    setFuelNeeded(prefs.fuelNeeded);
    setFuelEconomy(prefs.fuelEconomy);
    setFuelType(fuelTypeNorm);
    setSelectedBrands(brandsNorm);
    setTripDestination(prefs.tripDestination);
    setTripStartAddress(prefs.tripStartAddress);
    setTripDestinationAddress(prefs.tripDestinationAddress);
    setSavedSettingsSnapshot(
      createSettingsSnapshot({
        appMode: prefs.appMode,
        useCurrentLocation: prefs.useCurrentLocation,
        fuelNeeded: prefs.fuelNeeded,
        fuelEconomy: prefs.fuelEconomy,
        fuelType: fuelTypeNorm,
        selectedBrands: brandsNorm,
        tripStartAddress: prefs.tripStartAddress,
        tripDestinationAddress: prefs.tripDestinationAddress
      })
    );
    setSelectedStartAddress(
      prefs.tripStartAddress.trim().length > 0
        ? {
          id: `saved-start-${prefs.tripStartAddress.trim().toLowerCase()}`,
          label: prefs.tripStartAddress.trim(),
          coordinates: prefs.tripStart
        }
        : null
    );
    setSelectedDestinationAddress(
      prefs.tripDestinationAddress.trim().length > 0
        ? {
          id: `saved-dest-${prefs.tripDestinationAddress.trim().toLowerCase()}`,
          label: prefs.tripDestinationAddress.trim(),
          coordinates: prefs.tripDestination
        }
        : null
    );
  }, []);

  const handleSaveSettings = async (): Promise<SaveResult> => {
    if (!hasPendingSettingsChanges || isSavingSettings) {
      return { outcome: 'nothing' };
    }
    setIsSavingSettings(true);

    const roundedFuelNeeded = roundToTwoDecimalPlaces(fuelNeeded);
    const roundedFuelEconomy = roundToTwoDecimalPlaces(fuelEconomy);
    setFuelNeeded(roundedFuelNeeded);
    setFuelEconomy(roundedFuelEconomy);
    const nextFuelType = normaliseFuelType(fuelType);
    const nextBrands = normaliseBrands(selectedBrands);
    setFuelType(nextFuelType);
    setSelectedBrands(nextBrands);

    const startAddress = tripStartAddress.trim();
    const destinationAddress = tripDestinationAddress.trim();

    const missingMessage =
      appMode === 'oneWay'
        ? getTripAddressMissingMessage(startAddress, destinationAddress, useCurrentLocation)
        : getRoundTripStartMissingMessage(startAddress, useCurrentLocation);
    if (missingMessage) {
      const missing: string[] = [];
      if (!useCurrentLocation && startAddress.length === 0) missing.push('start address');
      if (appMode === 'oneWay' && destinationAddress.length === 0) missing.push('destination address');
      setErrorMsg(missingMessage);
      setLoading(false);
      setIsSavingSettings(false);
      return { outcome: 'failed', reason: `missing ${missing.join(' and ')}` };
    }
    setErrorMsg(null);
    setLoading(true);

    let resolvedUserLocation = userLocation;
    if (useCurrentLocation && !resolvedUserLocation) {
      const res = await fetchLocation(true);
      if (!res.success) {
        setErrorMsg('Location permission is required when "Use my location" is enabled.');
        setLoading(false);
        setIsSavingSettings(false);
        return { outcome: 'failed', reason: 'location permission denied' };
      }
      resolvedUserLocation = res.location;
    }

    let nextTripStart = {
      latitude: resolvedUserLocation?.coords.latitude ?? 0,
      longitude: resolvedUserLocation?.coords.longitude ?? 0
    };
    let nextTripDestination = tripDestination;
    const hasResolvedCoords = (candidate: AddressSuggestion | null): boolean => {
      if (!candidate) return false;
      const { latitude, longitude } = candidate.coordinates;
      return Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
    };
    const ensureResolvedSelection = async (candidate: AddressSuggestion | null): Promise<AddressSuggestion | null> => {
      if (!candidate) return null;
      if (hasResolvedCoords(candidate)) {
        return candidate;
      }
      try {
        const byPlaceId = await resolveAddressByPlaceId(candidate.id);
        if (byPlaceId && hasResolvedCoords(byPlaceId)) {
          return byPlaceId;
        }
      } catch (err) {
        // Some Android keys are app-restricted and block Places Details requests.
        // Fall through to label-based geocoding so save/recalculate can still proceed.
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Place details fallback triggered: ${message}`);
      }
      try {
        return await resolveAddress(candidate.label);
      } catch {
        return null;
      }
    };

    try {
      if (!useCurrentLocation) {
        const resolvedStart = await ensureResolvedSelection(
          selectedStartAddress && selectedStartAddress.label === startAddress ? selectedStartAddress : null
        );
        if (!resolvedStart) {
          setErrorMsg('Please click a Start Address suggestion, then pick a valid result.');
          setLoading(false);
          setIsSavingSettings(false);
          return { outcome: 'failed', reason: 'start address not selected' };
        }
        setSelectedStartAddress(resolvedStart);
        nextTripStart = resolvedStart.coordinates;
      }

      if (appMode === 'oneWay') {
        const resolvedDestination = await ensureResolvedSelection(
          selectedDestinationAddress && selectedDestinationAddress.label === destinationAddress
            ? selectedDestinationAddress
            : null
        );
        if (!resolvedDestination) {
          setErrorMsg('Please click a Destination Address suggestion, then pick a valid result.');
          setLoading(false);
          setIsSavingSettings(false);
          return { outcome: 'failed', reason: 'destination address not selected' };
        }
        setSelectedDestinationAddress(resolvedDestination);
        nextTripDestination = resolvedDestination.coordinates;
      }

      await saveUserPreferences({
        appMode,
        useCurrentLocation,
        fuelNeeded: roundedFuelNeeded,
        fuelEconomy: roundedFuelEconomy,
        fuelType: nextFuelType,
        selectedBrands: nextBrands,
        tripDestination: nextTripDestination,
        tripStartAddress: startAddress,
        tripDestinationAddress: destinationAddress,
        tripStart: nextTripStart
      });
      setTripDestination(nextTripDestination);
      setSavedSettingsSnapshot(
        createSettingsSnapshot({
          appMode,
          useCurrentLocation,
          fuelNeeded: roundedFuelNeeded,
          fuelEconomy: roundedFuelEconomy,
          fuelType: nextFuelType,
          selectedBrands: nextBrands,
          tripStartAddress: startAddress,
          tripDestinationAddress: destinationAddress
        })
      );
      onSettingsSaved?.();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Address validation failed. Please try again.'));
      setLoading(false);
      setIsSavingSettings(false);
      return { outcome: 'failed', reason: 'address lookup failed' };
    }
    setIsStartInputFocused(false);
    setIsDestinationInputFocused(false);
    setStartSuggestions([]);
    setDestinationSuggestions([]);

    if (appMode === 'oneWay') {
      fetchAndRankTripDataRef.current(
        nextTripStart,
        nextTripDestination,
        roundedFuelNeeded,
        roundedFuelEconomy,
        nextFuelType,
        nextBrands
      );
    } else {
      fetchAndRankFuelDataRef.current(
        nextTripStart.latitude,
        nextTripStart.longitude,
        roundedFuelNeeded,
        roundedFuelEconomy,
        nextFuelType,
        nextBrands
      );
    }
    setIsSavingSettings(false);
    return { outcome: 'saved' };
  };

  handleSaveSettingsRef.current = handleSaveSettings;
  hasPendingSettingsChangesRef.current = hasPendingSettingsChanges;

  // Persist any pending settings changes when leaving the Settings tab and
  // publish the outcome so the Prices tab can surface a toast.
  const flushSettingsOnLeave = useCallback(() => {
    if (hasPendingSettingsChangesRef.current) {
      void handleSaveSettingsRef.current().then(publishSaveOutcome);
    } else {
      publishSaveOutcome({ outcome: 'nothing' });
    }
  }, []);

  return {
    // state
    appMode,
    setAppMode,
    useCurrentLocation,
    setUseCurrentLocation,
    fuelNeeded,
    setFuelNeeded,
    fuelEconomy,
    setFuelEconomy,
    fuelType,
    setFuelType,
    selectedBrands,
    tripDestination,
    tripStartAddress,
    tripDestinationAddress,
    startSuggestions,
    destinationSuggestions,
    searchingStart,
    searchingDestination,
    isStartInputFocused,
    setIsStartInputFocused,
    isDestinationInputFocused,
    setIsDestinationInputFocused,
    selectedStartAddress,
    selectedDestinationAddress,
    // derived
    startAddressSelected,
    destinationAddressSelected,
    startStatusText,
    destinationStatusText,
    hasPendingSettingsChanges,
    // pickers + refs + actions
    startAddressPicker,
    destinationAddressPicker,
    isSelectingSuggestionRef,
    toggleBrandSelection,
    hydrate,
    flushSettingsOnLeave
  };
}
