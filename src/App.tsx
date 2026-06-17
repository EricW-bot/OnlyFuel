import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View, type LayoutChangeEvent, useColorScheme } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { canUseLiquidGlass } from '@/components/ThemedGlassView';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import type { AppTab, RankedStation, TabDefinition } from '@/types';
import { loadUserPreferences } from '@/services/preferencesStorage';
import { createThemedStyles, getPalette } from '@/theme/theme';
import { runTripAlgorithmValidation } from '@/lib/tripValidation';
import { getErrorMessage, normaliseBrands, normaliseFuelType } from '@/lib/utils';
import { getRoundTripStartMissingMessage, getTripAddressMissingMessage } from '@/lib/appHelpers';
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
  onNavigateToTab?: (tab: AppTab) => void;
  onSettingsSaved?: () => void;
};

export default function App({ initialTab = 'prices', hideBottomNav = false, onNavigateToTab, onSettingsSaved }: AppProps) {
  return (
    <SafeAreaProvider>
      <AppContent
        initialTab={initialTab}
        hideBottomNav={hideBottomNav}
        onNavigateToTab={onNavigateToTab}
        onSettingsSaved={onSettingsSaved}
      />
    </SafeAreaProvider>
  );
}

function AppContent({ initialTab = 'prices', hideBottomNav = false, onNavigateToTab, onSettingsSaved }: AppProps) {
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
  const [mapStation, setMapStation] = useState<RankedStation | null>(null);
  const [expoMapsModule, setExpoMapsModule] = useState<typeof import('expo-maps') | null>(null);

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
    onSettingsSaved
  });
  // Stable across renders (useCallback in the hook); depend on this rather than
  // the `settings` object, whose identity changes every render.
  const { flushSettingsOnLeave } = settings;

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
  // In NativeTabs mode, use the system safe-area bottom inset directly.
  // This prevents overscroll blank space while still leaving enough space
  // for the native tab bar.
  const scrollBottomPadding = hideBottomNav ? insets.bottom : bottomNavHeight + 8;
  const statusBarInset = Constants.statusBarHeight ?? 0;
  const headerTopOffset = statusBarInset;
  // Shaved off all remaining layout padding to force the solid line tightest to the top
  const topHeaderHeight = headerTopOffset + (headerContentHeights[activeTab] ?? 84);

  const bgRgbaSolid = themeMode === 'light' ? 'rgba(238, 242, 247, 1)' : 'rgba(15, 20, 25, 1)';
  const bgRgbaTransparent = themeMode === 'light' ? 'rgba(238, 242, 247, 0)' : 'rgba(15, 20, 25, 0)';

  const navigateToTab = useCallback(
    (tab: AppTab) => {
      if (activeTab === 'settings' && tab === 'prices') {
        flushSettingsOnLeave();
      }
      // When using NativeTabs, routing remounts the correct screen.
      // Avoid changing internal `activeTab` to reduce redundant renders/flicker.
      if (!hideBottomNav) {
        setActiveTabState(tab);
      }
      onNavigateToTab?.(tab);
    },
    [activeTab, hideBottomNav, onNavigateToTab, flushSettingsOnLeave]
  );

  const handleListRefresh = useCallback(async () => {
    fuelData.setRefreshing(true);
    try {
      let nextUserLocation = userLocation;
      if (settings.useCurrentLocation) {
        const res = await fetchLocation(false);
        if (res.location) {
          nextUserLocation = res.location;
        }
      }

      let nextTripStart = {
        latitude: nextUserLocation?.coords.latitude ?? 0,
        longitude: nextUserLocation?.coords.longitude ?? 0
      };

      if (!settings.useCurrentLocation) {
        if (!settings.selectedStartAddress?.coordinates) return;
        nextTripStart = settings.selectedStartAddress.coordinates;
      }

      if (settings.appMode === 'oneWay') {
        if (!settings.selectedDestinationAddress?.coordinates) return;
        await fuelData.fetchAndRankTripDataRef.current(
          nextTripStart,
          settings.selectedDestinationAddress.coordinates,
          settings.fuelNeeded,
          settings.fuelEconomy,
          fuelData.appliedFuelType,
          settings.selectedBrands
        );
      } else {
        await fuelData.fetchAndRankFuelDataRef.current(
          nextTripStart.latitude,
          nextTripStart.longitude,
          settings.fuelNeeded,
          settings.fuelEconomy,
          fuelData.appliedFuelType,
          settings.selectedBrands
        );
      }
    } catch {
      // Ignore errors on refresh
    } finally {
      fuelData.setRefreshing(false);
    }
  }, [userLocation, fetchLocation, fuelData, settings]);

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

  // Initial load: hydrate the form from storage, resolve location, then rank.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await loadUserPreferences();
        if (cancelled) return;

        const fuelTypeNorm = normaliseFuelType(prefs.fuelType);
        const brandsNorm = normaliseBrands(prefs.selectedBrands);

        settings.hydrate(prefs);
        fuelData.setAppliedFuelType(fuelTypeNorm);

        const { success, errorMsg, location: newLoc } = await fetchLocation(prefs.useCurrentLocation);
        if (cancelled) return;
        if (!success) {
          fuelData.setErrorMsg(errorMsg || 'Failed to get location');
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
            fuelData.setErrorMsg(missingMessage);
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
            brandsNorm
          );
        } else {
          const missingMessage = getRoundTripStartMissingMessage(prefs.tripStartAddress, prefs.useCurrentLocation);
          if (missingMessage) {
            fuelData.setErrorMsg(missingMessage);
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
            brandsNorm
          );
        }
      } catch (err) {
        if (!cancelled) {
          fuelData.setErrorMsg(getErrorMessage(err, 'An error occurred while initializing.'));
          fuelData.setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: setters and fetch refs are stable; hydrate is memoized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return () => {
        settings.flushSettingsOnLeave();
      };
    }, [activeTab, settings.flushSettingsOnLeave])
  );

  const bottomNavTabs: TabDefinition[] = [
    { key: 'prices', label: 'Prices', icon: 'pricetag-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' }
  ];

  const { appMode, fuelNeeded } = settings;
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
            errorMsg={fuelData.errorMsg}
            loading={fuelData.loading}
            refreshing={fuelData.refreshing}
            rankedStations={fuelData.rankedStations}
            appMode={appMode}
            onRefresh={handleListRefresh}
            onSelectStation={setMapStation}
          />
        ) : (
          <SettingsScreen
            palette={palette}
            styles={styles}
            themeMode={themeMode}
            topHeaderHeight={topHeaderHeight}
            settings={settings}
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
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                          <Text style={[styles.summaryChipText]}>{fuelNeeded}L</Text>
                        </GlassView>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                          <Text style={[styles.summaryChipText]}>{appliedFuelType}</Text>
                        </GlassView>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <GlassView style={styles.summaryChipGlass} glassEffectStyle="regular">
                          <Text style={[styles.summaryChipText]}>{appMode === 'oneWay' ? 'One-way' : 'Round-trip'}</Text>
                        </GlassView>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipText}>{fuelNeeded}L</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipText}>{appliedFuelType}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigateToTab('settings')} accessibilityRole="button" accessibilityLabel="Open settings">
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipText}>{appMode === 'oneWay' ? 'One-way' : 'Round-trip'}</Text>
                        </View>
                      </TouchableOpacity>
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
