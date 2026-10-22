import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Text, TouchableOpacity, View, type LayoutChangeEvent, useColorScheme } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { canUseLiquidGlass } from '@/components/ThemedGlassView';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { AppTab, RankedStation, SettingsFocusRequest, SettingsSection, TabDefinition } from '@/types';
import { loadUserPreferences, saveUserPreferences } from '@/services/preferencesStorage';
import { createThemedStyles, getPalette } from '@/theme/theme';
import { toUsableRangeParam, usableRangeKm } from '@/lib/range';
import { runTripAlgorithmValidation } from '@/lib/tripValidation';
import { getErrorMessage, normaliseBrands, normaliseFuelType, normaliseRangeKm } from '@/lib/utils';
import { FOREGROUND_REFRESH_AFTER_MS, getRoundTripStartMissingMessage, getTripAddressMissingMessage } from '@/lib/appHelpers';
import { FloatingBottomNav } from '@/components/FloatingBottomNav';
import { SettingsHeader } from '@/components/SettingsHeader';
import { MapStationModal } from '@/components/MapStationModal';
import { Toast } from '@/components/Toast';
import { PricesScreen } from '@/components/screens/PricesScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { useFocusEffect } from 'expo-router';
import { useLocation } from '@/hooks/useLocation';
import { useFuelData } from '@/hooks/useFuelData';
import { useSettingsForm } from '@/hooks/useSettingsForm';
import { useMapPreview } from '@/hooks/useMapPreview';
import { useSaveToast } from '@/hooks/useSaveToast';

type AppProps = {
  initialTab?: AppTab;
  hideBottomNav?: boolean;
  onNavigateToTab?: (tab: AppTab, section?: SettingsSection) => void;
  onSettingsSaved?: () => void;
  /** Opens and scrolls Settings to a section (used when Settings is its own route). */
  settingsFocus?: SettingsFocusRequest | null;
};

export default function App({
  initialTab = 'prices',
  hideBottomNav = false,
  onNavigateToTab,
  onSettingsSaved,
  settingsFocus
}: AppProps) {
  return (
    <SafeAreaProvider>
      <AppContent
        initialTab={initialTab}
        hideBottomNav={hideBottomNav}
        onNavigateToTab={onNavigateToTab}
        onSettingsSaved={onSettingsSaved}
        settingsFocus={settingsFocus}
      />
    </SafeAreaProvider>
  );
}

function AppContent({
  initialTab = 'prices',
  hideBottomNav = false,
  onNavigateToTab,
  onSettingsSaved,
  settingsFocus
}: AppProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const themeMode = colorScheme === 'dark' ? 'dark' : 'light';

  const [activeTabState, setActiveTabState] = useState<AppTab>(initialTab);
  // In NativeTabs mode, each route renders its own screen (and this app instance never needs to swap tiles).
  // Keep `activeTab` derived to avoid redundant internal state updates.
  const activeTab: AppTab = hideBottomNav ? initialTab : activeTabState;

  const [headerContentHeights, setHeaderContentHeights] = useState<Record<AppTab, number>>({
    prices: 100,
    settings: 100
  });
  // With the in-app bottom nav there is no route param, so keep the request locally.
  const [localSettingsFocus, setLocalSettingsFocus] = useState<SettingsFocusRequest | null>(null);
  const [mapStation, setMapStation] = useState<RankedStation | null>(null);
  const [expoMapsModule, setExpoMapsModule] = useState<typeof import('expo-maps') | null>(null);

  // In NativeTabs mode the Settings route is its own App instance. It only edits preferences;
  // the Prices route owns fetching, so this instance never loads prices.
  const isSettingsOnlyInstance = hideBottomNav && initialTab === 'settings';

  const { userLocation, fetchLocation } = useLocation();
  const fuelData = useFuelData();
  const settings = useSettingsForm({
    activeTab,
    userLocation,
    fetchLocation,
    setLoading: fuelData.setLoading,
    setErrorMsg: fuelData.setErrorMsg,
    fetchAndRankFuelDataRef: fuelData.fetchAndRankFuelDataRef,
    fetchAndRankTripDataRef: fuelData.fetchAndRankTripDataRef,
    onSettingsSaved,
    refreshAfterSave: !isSettingsOnlyInstance
  });
  // Stable across renders (useCallback in the hook); depend on this rather than
  // the `settings` object, whose identity changes every render.
  const { flushSettingsOnLeave, rehydrateFromStorage } = settings;

  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const styles = useMemo(() => createThemedStyles(palette), [palette]);

  const AppleMapsView = expoMapsModule?.AppleMaps?.View;
  const GoogleMapsView = expoMapsModule?.GoogleMaps?.View;
  const isNativeMapPreviewAvailable =
    (Platform.OS === 'ios' && !!AppleMapsView) || (Platform.OS === 'android' && !!GoogleMapsView);

  const mapPreview = useMapPreview({
    appMode: settings.appMode,
    useCurrentLocation: settings.useCurrentLocation,
    userLocation,
    selectedStartAddress: settings.selectedStartAddress,
    tripDestination: settings.tripDestination,
    tripStartAddress: settings.tripStartAddress,
    tripDestinationAddress: settings.tripDestinationAddress,
    mapStation,
    isNativeMapPreviewAvailable,
    palette
  });

  const { toast, toastVisible } = useSaveToast(activeTab);

  const bottomNavInset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 6;
  const bottomNavHeight = 58 + bottomNavInset;
  const scrollBottomPadding = hideBottomNav ? insets.bottom : bottomNavHeight + 8;
  const statusBarInset = insets.top;
  const headerTopOffset = statusBarInset;
  const topHeaderHeight = headerTopOffset + (headerContentHeights[activeTab] ?? 84);

  const bgRgbaSolid = themeMode === 'light' ? 'rgba(238, 242, 247, 1)' : 'rgba(15, 20, 25, 1)';
  const bgRgbaTransparent = themeMode === 'light' ? 'rgba(238, 242, 247, 0)' : 'rgba(15, 20, 25, 0)';

  const navigateToTab = useCallback(
    (tab: AppTab, section?: SettingsSection) => {
      if (activeTab === 'settings' && tab === 'prices') {
        flushSettingsOnLeave();
      }
      if (!hideBottomNav) {
        setLocalSettingsFocus(section ? { section, nonce: Date.now() } : null);
      }
      // When using NativeTabs, routing remounts the correct screen.
      // Avoid changing internal `activeTab` to reduce redundant renders/flicker.
      if (!hideBottomNav) {
        setActiveTabState(tab);
      }
      onNavigateToTab?.(tab, section);
    },
    [activeTab, hideBottomNav, onNavigateToTab, flushSettingsOnLeave]
  );

  useEffect(() => {
    if (__DEV__) {
      runTripAlgorithmValidation();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let cancelled = false;
    void import('expo-maps')
      .then((mod) => {
        if (!cancelled) {
          setExpoMapsModule(mod);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExpoMapsModule(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loads preferences, resolves the location, then ranks. Used for the first load, retry,
  // pull-to-refresh and returning to the foreground. A `silent` load keeps showing the current
  // results (an error appears as a banner above them) instead of swapping in the spinner.
  const loadIdRef = useRef(0);
  const runLoad = async (silent: boolean, allowCache = false) => {
    const loadId = ++loadIdRef.current;
    const superseded = () => loadId !== loadIdRef.current;
    try {
      if (!silent) {
        fuelData.setErrorMsg(null);
        fuelData.setLoading(true);
      }
      const prefs = await loadUserPreferences();
      if (superseded()) return;

      const fuelTypeNorm = normaliseFuelType(prefs.fuelType);
      const brandsNorm = normaliseBrands(prefs.selectedBrands);
      const usableRange = toUsableRangeParam(prefs.remainingRangeKm, prefs.rangeMarginPct);

      // Don't clobber edits the user is typing (single-instance mode) with the stored values.
      if (!silent || !settings.hasPendingSettingsChanges) {
        settings.hydrate(prefs);
      }
      fuelData.setAppliedFuelType(fuelTypeNorm);

      if (isSettingsOnlyInstance) {
        fuelData.setLoading(false);
        return;
      }

      const { success, errorMsg, permissionDenied, location: newLoc } = await fetchLocation(prefs.useCurrentLocation);
      if (superseded()) return;
      if (!success) {
        fuelData.setErrorMsg(errorMsg || 'Failed to get location', permissionDenied ? 'permission' : 'general');
        fuelData.setLoading(false);
        return;
      }
      const location = newLoc;

      if (prefs.appMode === 'oneWay') {
        const missingMessage = getTripAddressMissingMessage(
          prefs.tripStartAddress,
          prefs.tripDestinationAddress,
          prefs.useCurrentLocation
        );
        if (missingMessage) {
          fuelData.setErrorMsg(missingMessage, 'needsSettings');
          fuelData.setLoading(false);
          return;
        }

        const oneWayStart = prefs.useCurrentLocation
          ? {
            latitude: location?.coords.latitude ?? 0,
            longitude: location?.coords.longitude ?? 0
          }
          : prefs.tripStart;

        await fuelData.fetchAndRankTripDataRef.current(
          oneWayStart,
          prefs.tripDestination,
          prefs.fuelNeeded,
          prefs.fuelEconomy,
          fuelTypeNorm,
          brandsNorm,
          usableRange,
          { allowCache }
        );
      } else {
        const missingMessage = getRoundTripStartMissingMessage(prefs.tripStartAddress, prefs.useCurrentLocation);
        if (missingMessage) {
          fuelData.setErrorMsg(missingMessage, 'needsSettings');
          fuelData.setLoading(false);
          return;
        }

        const roundTripStart = prefs.useCurrentLocation
          ? {
            latitude: location?.coords.latitude ?? 0,
            longitude: location?.coords.longitude ?? 0
          }
          : prefs.tripStart;

        await fuelData.fetchAndRankFuelDataRef.current(
          roundTripStart.latitude,
          roundTripStart.longitude,
          prefs.fuelNeeded,
          prefs.fuelEconomy,
          fuelTypeNorm,
          brandsNorm,
          usableRange,
          { allowCache }
        );
      }
    } catch (err) {
      if (!superseded()) {
        fuelData.setErrorMsg(getErrorMessage(err, 'An error occurred while initializing.'));
        fuelData.setLoading(false);
      }
    }
  };

  const refreshInPlace = async (allowCache = false) => {
    fuelData.setRefreshing(true);
    try {
      await runLoad(true, allowCache);
    } finally {
      fuelData.setRefreshing(false);
    }
  };

  // Stable handles to the latest closures, for effects and memoised callbacks.
  const runLoadRef = useRef(runLoad);
  const refreshInPlaceRef = useRef(refreshInPlace);
  useLayoutEffect(() => {
    runLoadRef.current = runLoad;
    refreshInPlaceRef.current = refreshInPlace;
  });

  useEffect(() => {
    void runLoadRef.current(false);
    const activeLoadIdRef = loadIdRef;
    return () => {
      // Supersede any load still in flight when this instance unmounts.
      activeLoadIdRef.current += 1;
    };
  }, []);

  const locationBlocked = fuelData.errorKind === 'permission' && fuelData.errorMsg !== null;
  const locationBlockedRef = useRef(false);
  useLayoutEffect(() => {
    locationBlockedRef.current = locationBlocked;
  }, [locationBlocked]);

  // Prices go stale while the app sits in the background, and so does the user's position.
  useEffect(() => {
    if (isSettingsOnlyInstance) return;
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
      } else if (state === 'active' && backgroundedAt !== null) {
        const awayMs = Date.now() - backgroundedAt;
        backgroundedAt = null;
        // Coming back from the OS settings after fixing location access should retry straight away.
        if (awayMs >= FOREGROUND_REFRESH_AFTER_MS || locationBlockedRef.current) {
          void refreshInPlaceRef.current();
        }
      }
    });
    return () => subscription.remove();
  }, [isSettingsOnlyInstance]);

  const hasResults = fuelData.rankedStations.length > 0;
  const handleRetry = useCallback(() => {
    if (hasResults) {
      void refreshInPlaceRef.current();
    } else {
      void runLoadRef.current(false);
    }
  }, [hasResults]);

  const handleApplyRange = useCallback(async (rangeKm: string) => {
    await saveUserPreferences({ remainingRangeKm: normaliseRangeKm(rangeKm) });
    // Only the ranking changed, so reuse the stations fetched moments ago.
    await refreshInPlaceRef.current(true);
  }, []);

  const handleHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) {
        return;
      }
      setHeaderContentHeights((prev) => {
        const currentHeight = prev[activeTab] ?? 0;
        if (Math.abs(nextHeight - currentHeight) <= 1) {
          return prev;
        }
        return {
          ...prev,
          [activeTab]: nextHeight
        };
      });
    },
    [activeTab]
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'settings') {
        return;
      }
      // Pick up changes made elsewhere (e.g. the range set from the Prices screen).
      void rehydrateFromStorage();
      return () => {
        flushSettingsOnLeave();
      };
    }, [activeTab, flushSettingsOnLeave, rehydrateFromStorage])
  );

  const bottomNavTabs: TabDefinition[] = [
    { key: 'prices', label: 'Prices', icon: 'pricetag-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' }
  ];

  const { appMode, fuelNeeded, remainingRangeKm } = settings;
  const rangeChipLabel = usableRangeKm(remainingRangeKm, settings.rangeMarginPct) !== null ? `${remainingRangeKm} km range` : null;
  const { appliedFuelType } = fuelData;

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <MapStationModal
          visible={!!mapStation}
          mapStation={mapStation}
          palette={palette}
          styles={styles}
          appMode={appMode}
          oneWayStartPoint={mapPreview.oneWayStartPoint}
          tripDestination={settings.tripDestination}
          userLocation={userLocation}
          AppleMapsView={AppleMapsView}
          GoogleMapsView={GoogleMapsView}
          mapCameraPosition={mapPreview.mapCameraPosition}
          mapMarkers={mapPreview.mapMarkers}
          mapPolylines={mapPreview.mapPolylines}
          onClose={() => setMapStation(null)}
          onOpenExternal={mapPreview.openExternalMapForStation}
        />

        {activeTab === 'prices' && toast ? (
          <Toast
            message={toast.message}
            variant={toast.variant}
            visible={toastVisible}
            top={topHeaderHeight + 12}
            themeMode={themeMode}
          />
        ) : null}

        {activeTab === 'prices' ? (
          <PricesScreen
            palette={palette}
            styles={styles}
            topHeaderHeight={topHeaderHeight}
            scrollBottomPadding={scrollBottomPadding}
            themeMode={themeMode}
            errorMsg={fuelData.errorMsg}
            errorKind={fuelData.errorKind}
            loading={fuelData.loading}
            refreshing={fuelData.refreshing}
            rankedStations={fuelData.rankedStations}
            appMode={appMode}
            lastUpdatedAt={fuelData.lastUpdatedAt}
            routingEstimated={fuelData.routingEstimated}
            remainingRangeKm={remainingRangeKm}
            rangeMarginPct={settings.rangeMarginPct}
            onRefresh={() => void refreshInPlaceRef.current()}
            onRetry={handleRetry}
            onOpenSettings={() => navigateToTab('settings')}
            onApplyRange={handleApplyRange}
            onSelectStation={setMapStation}
          />
        ) : (
          <SettingsScreen
            palette={palette}
            styles={styles}
            themeMode={themeMode}
            topHeaderHeight={topHeaderHeight}
            settings={settings}
            focusRequest={settingsFocus ?? localSettingsFocus}
          />
        )}

        <View pointerEvents="none" style={[styles.headerVignette, { height: topHeaderHeight + 15 }]}>
          <LinearGradient
            colors={[bgRgbaSolid, bgRgbaSolid, bgRgbaTransparent]}
            locations={[0, Number((topHeaderHeight / (topHeaderHeight + 15)).toFixed(3)), 1]}
            style={{ flex: 1 }}
          />
        </View>

        <View pointerEvents="box-none" style={[styles.headerOverlayContainer, { top: headerTopOffset }]}>
          <View style={styles.headerPlainContent} onLayout={handleHeaderLayout}>
            {activeTab === 'prices' ? (
              <>
                <Text style={styles.title}>OnlyFuel</Text>
                <Text style={styles.subtitle}>{appMode === 'oneWay' ? 'One-way one-stop planner' : 'Round-trip nearby ranking'}</Text>
                <View style={styles.summarySingleRow}>
                  {canUseLiquidGlass ? (
                    <>
                      <TouchableOpacity onPress={() => navigateToTab('settings', 'fuelAndRange')} accessibilityRole="button" accessibilityLabel="Open fuel and range settings">
                        <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                          <Text style={[styles.summaryChipText]}>{fuelNeeded}L</Text>
                        </GlassView>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings', 'fuelAndRange')} accessibilityRole="button" accessibilityLabel="Open fuel and range settings">
                        <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                          <Text style={[styles.summaryChipText]}>{appliedFuelType}</Text>
                        </GlassView>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                          <Text style={[styles.summaryChipText]}>{appMode === 'oneWay' ? 'One-way' : 'Round-trip'}</Text>
                        </GlassView>
                      </TouchableOpacity>
                      {rangeChipLabel ? (
                        <TouchableOpacity onPress={() => navigateToTab('settings', 'fuelAndRange')} accessibilityRole="button" accessibilityLabel="Open fuel and range settings">
                          <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                            <Text style={[styles.summaryChipText]}>{rangeChipLabel}</Text>
                          </GlassView>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => navigateToTab('settings', 'fuelAndRange')} accessibilityRole="button" accessibilityLabel="Open fuel and range settings">
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipText}>{fuelNeeded}L</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings', 'fuelAndRange')} accessibilityRole="button" accessibilityLabel="Open fuel and range settings">
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipText}>{appliedFuelType}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipText}>{appMode === 'oneWay' ? 'One-way' : 'Round-trip'}</Text>
                        </View>
                      </TouchableOpacity>
                      {rangeChipLabel ? (
                        <TouchableOpacity onPress={() => navigateToTab('settings', 'fuelAndRange')} accessibilityRole="button" accessibilityLabel="Open fuel and range settings">
                          <View style={styles.summaryChip}>
                            <Text style={styles.summaryChipText}>{rangeChipLabel}</Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  )}
                </View>
              </>
            ) : (
              <SettingsHeader styles={styles} />
            )}
          </View>
        </View>

        {!hideBottomNav ? (
          <FloatingBottomNav
            tabs={bottomNavTabs}
            activeTab={activeTab}
            onTabPress={navigateToTab}
            bottomInset={bottomNavInset}
            selectedColor={palette.primary}
            unselectedColor={palette.metaHint}
            styles={styles}
          />
        ) : null}
      </SafeAreaView>
    </>
  );
}
