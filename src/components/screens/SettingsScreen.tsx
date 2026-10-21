import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { canUseLiquidGlass } from '@/components/ThemedGlassView';
import { AddressSuggestionInput } from '@/components/AddressSuggestionInput';
import { RoundedNumericInput } from '@/components/RoundedNumericInput';
import { PressableScale } from '@/components/PressableScale';
import { CollapsibleSectionContent } from '@/components/CollapsibleSectionContent';
import { LAYOUT_ANIMATION_MS, animateNextLayout, getReduceMotion } from '@/lib/motion';
import { BRAND_OPTIONS, FUEL_TYPE_OPTIONS } from '@/constants';
import { RANGE_MARGIN_OPTIONS, usableRangeKm } from '@/lib/range';
import { NumericDoneBar } from '@/components/NumericDoneBar';
import type { AppMode, SettingsFocusRequest, SettingsSection } from '@/types';
import type { createThemedStyles, getPalette } from '@/theme/theme';
import type { useSettingsForm } from '@/hooks/useSettingsForm';

type SettingsScreenProps = {
  palette: ReturnType<typeof getPalette>;
  styles: ReturnType<typeof createThemedStyles>;
  themeMode: 'light' | 'dark';
  topHeaderHeight: number;
  settings: ReturnType<typeof useSettingsForm>;
  /** Opens and scrolls to a section, e.g. when a fuel chip on the Prices screen is tapped. */
  focusRequest?: SettingsFocusRequest | null;
};

// ScrollView clamps scrollTo to its current content height, which is still growing while the
// expand animation runs. Wait for it to finish, or the scroll stops short of the section.
const SCROLL_SETTLE_BUFFER_MS = 40;
const SCROLL_NO_ANIMATION_DELAY_MS = 60;
const SECTION_SCROLL_MARGIN = 12;

export function SettingsScreen({ palette, styles, themeMode, topHeaderHeight, settings, focusRequest }: SettingsScreenProps) {
  const {
    appMode,
    setAppMode,
    useCurrentLocation,
    setUseCurrentLocation,
    fuelNeeded,
    setFuelNeeded,
    fuelEconomy,
    setFuelEconomy,
    remainingRangeKm,
    setRemainingRangeKm,
    rangeMarginPct,
    setRangeMarginPct,
    fuelType,
    setFuelType,
    selectedBrands,
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
    startAddressSelected,
    destinationAddressSelected,
    startStatusText,
    destinationStatusText,
    startAddressPicker,
    destinationAddressPicker,
    isSelectingSuggestionRef,
    toggleBrandSelection,
    pendingSections
  } = settings;

  // Fuel & Range holds the fields people change at the pump, so it starts open;
  // Vehicle & Brands is set-and-forget, so it starts collapsed.
  const [fuelAndRangeOpen, setFuelAndRangeOpen] = useState(true);
  const [vehicleAndBrandsOpen, setVehicleAndBrandsOpen] = useState(false);

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionYRef = useRef<Record<SettingsSection, number>>({ fuelAndRange: 0, vehicleAndBrands: 0 });
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToSection = useCallback((section: SettingsSection) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    const delay = getReduceMotion() ? SCROLL_NO_ANIMATION_DELAY_MS : LAYOUT_ANIMATION_MS + SCROLL_SETTLE_BUFFER_MS;
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      scrollRef.current?.scrollTo({
        y: Math.max(sectionYRef.current[section] - SECTION_SCROLL_MARGIN, 0),
        animated: !getReduceMotion()
      });
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // Deep link from the Prices screen: open the requested section (state reset on a new
  // request), then bring it into view once it has laid out.
  const [handledFocusNonce, setHandledFocusNonce] = useState<number | null>(null);
  if (focusRequest && focusRequest.nonce !== handledFocusNonce) {
    setHandledFocusNonce(focusRequest.nonce);
    if (focusRequest.section === 'fuelAndRange') {
      setFuelAndRangeOpen(true);
    } else {
      setVehicleAndBrandsOpen(true);
    }
  }
  useEffect(() => {
    if (focusRequest) scrollToSection(focusRequest.section);
  }, [focusRequest, scrollToSection]);

  const handleFuelAndRangeLayout = useCallback((event: LayoutChangeEvent) => {
    sectionYRef.current.fuelAndRange = event.nativeEvent.layout.y;
  }, []);
  const handleVehicleAndBrandsLayout = useCallback((event: LayoutChangeEvent) => {
    sectionYRef.current.vehicleAndBrands = event.nativeEvent.layout.y;
  }, []);

  const fuelAndRangeSummary = [
    `${fuelNeeded || '-'} L`,
    fuelType,
    remainingRangeKm ? `${remainingRangeKm} km range` : null
  ]
    .filter(Boolean)
    .join(' · ');
  const vehicleAndBrandsSummary = [
    `${fuelEconomy || '-'} L/100km`,
    selectedBrands.length > 0 ? `${selectedBrands.length} ${selectedBrands.length === 1 ? 'brand' : 'brands'}` : 'Any brand'
  ].join(' · ');

  const renderSettingsSection = (children: React.ReactNode) =>
    canUseLiquidGlass ? (
      <View style={styles.settingsSectionGlass}>
        <GlassView style={styles.settingsSectionGlassBackground} glassEffectStyle="regular" />
        <View style={styles.settingsSectionContent}>{children}</View>
      </View>
    ) : (
      <View style={styles.settingsSection}>{children}</View>
    );

  return (
    <View style={[styles.listContainer, { paddingTop: topHeaderHeight + 8, paddingBottom: 0 }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        style={{ flex: 1 }}
      >
        <NumericDoneBar palette={palette} />
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.settingsPageContent, { paddingTop: 0, paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          nestedScrollEnabled
        >
          {renderSettingsSection(
            <>
              <View style={styles.settingsSectionHeader}>
                <Ionicons name="map-outline" size={16} color={palette.title} />
                <Text style={styles.settingsSectionTitle}>Trip Mode</Text>
              </View>
              <Text style={styles.inputLabel}>Mode</Text>
              <View style={styles.modeCardRow}>
                {(['roundTrip', 'oneWay'] as AppMode[]).map((modeOption) => {
                  const selected = appMode === modeOption;
                  return (
                    <PressableScale
                      key={modeOption}
                      style={[styles.modeCard, selected && styles.modeCardSelected]}
                      onPress={() => {
                        animateNextLayout();
                        setAppMode(modeOption);
                      }}
                    >
                      <Ionicons
                        name={modeOption === 'roundTrip' ? 'repeat-outline' : 'navigate-outline'}
                        size={18}
                        color={selected ? palette.chipTextSelected : palette.chipText}
                      />
                      <Text style={[styles.modeCardTitle, selected && styles.fuelTypeChipTextSelected]}>
                        {modeOption === 'roundTrip' ? 'Round-trip' : 'One-way'}
                      </Text>
                      <Text style={[styles.modeCardHint, selected && styles.fuelTypeChipTextSelected]}>
                        {modeOption === 'roundTrip' ? 'Nearby station ranking' : 'Route-aware stop planning'}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Start Point Source</Text>
              <View style={[styles.sourceToggleRow, { marginBottom: 0 }]}>
                {[true, false].map((option) => {
                  const selected = useCurrentLocation === option;
                  return (
                    <PressableScale
                      key={option ? 'use-location' : 'use-addresses'}
                      style={[styles.sourceToggleButton, selected && styles.sourceToggleButtonSelected]}
                      onPress={() => {
                        animateNextLayout();
                        setUseCurrentLocation(option);
                      }}
                    >
                      <Text style={[styles.sourceToggleText, selected && styles.sourceToggleTextSelected]}>
                        {option ? 'Use my location' : 'Use start address'}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}

          {!useCurrentLocation ? (
            renderSettingsSection(
              <>
                <View style={styles.settingsSectionHeader}>
                  <Ionicons name="pin-outline" size={16} color={palette.title} />
                  <Text style={styles.settingsSectionTitle}>Start Address</Text>
                </View>
                <Text style={styles.inputLabel}>Start Address</Text>
                <AddressSuggestionInput
                  ui={{
                    value: tripStartAddress,
                    isFocused: isStartInputFocused,
                    suggestions: startSuggestions,
                    statusText: startStatusText,
                    statusOk: startAddressSelected,
                    metaHintText: searchingStart ? 'Searching addresses...' : null
                  }}
                  onChangeText={startAddressPicker.handleChangeText}
                  onFocus={() => setIsStartInputFocused(true)}
                  onBlur={startAddressPicker.handleBlur}
                  placeholder="Enter start address"
                  placeholderTextColor={palette.placeholder}
                  inputStyle={styles.input}
                  statusOkTextStyle={styles.addressStatusTextOk}
                  styles={styles}
                  keyPrefix="start"
                  onPressInSuggestion={() => {
                    isSelectingSuggestionRef.current = true;
                  }}
                  onSelectSuggestion={(suggestion) => {
                    startAddressPicker.applySuggestion(suggestion, 'list');
                  }}
                />
              </>
            )
          ) : null}

          {appMode === 'oneWay' ? (
            renderSettingsSection(
              <>
                <View style={styles.settingsSectionHeader}>
                  <Ionicons name="flag-outline" size={16} color={palette.title} />
                  <Text style={styles.settingsSectionTitle}>Destination</Text>
                </View>
                <Text style={styles.inputLabel}>Destination Address</Text>
                <AddressSuggestionInput
                  ui={{
                    value: tripDestinationAddress,
                    isFocused: isDestinationInputFocused,
                    suggestions: destinationSuggestions,
                    statusText: destinationStatusText ?? '',
                    statusOk: destinationAddressSelected,
                    metaHintText: searchingDestination ? 'Searching addresses...' : null
                  }}
                  onChangeText={destinationAddressPicker.handleChangeText}
                  onFocus={() => setIsDestinationInputFocused(true)}
                  onBlur={destinationAddressPicker.handleBlur}
                  placeholder="Enter destination address"
                  placeholderTextColor={palette.placeholder}
                  inputStyle={styles.input}
                  statusOkTextStyle={styles.addressStatusTextOk}
                  styles={styles}
                  keyPrefix="dest"
                  onPressInSuggestion={() => {
                    isSelectingSuggestionRef.current = true;
                  }}
                  onSelectSuggestion={(suggestion) => {
                    destinationAddressPicker.applySuggestion(suggestion, 'list');
                  }}
                />
              </>
            )
          ) : null}

          <View onLayout={handleFuelAndRangeLayout}>
            {renderSettingsSection(
              <CollapsibleSectionContent
                title="Fuel & Range"
                icon="speedometer-outline"
                summary={fuelAndRangeSummary}
                expanded={fuelAndRangeOpen}
                onToggle={() => {
                  setFuelAndRangeOpen(!fuelAndRangeOpen);
                  if (!fuelAndRangeOpen) scrollToSection('fuelAndRange');
                }}
                hasPendingChanges={pendingSections.fuelAndRange}
                palette={palette}
                styles={styles}
              >
                <Text style={styles.inputLabel}>Fuel Needed (Litres)</Text>
                <RoundedNumericInput
                  value={fuelNeeded}
                  onChangeText={setFuelNeeded}
                  inputStyle={styles.input}
                  keyboardAppearance={themeMode}
                  placeholder="e.g. 50"
                  placeholderTextColor={palette.placeholder}
                />

                <Text style={styles.inputLabel}>Remaining Range (km, Optional)</Text>
                <RoundedNumericInput
                  value={remainingRangeKm}
                  onChangeText={setRemainingRangeKm}
                  inputStyle={[styles.input, { marginBottom: 4 }]}
                  keyboardAppearance={themeMode}
                  placeholder="Leave blank for no limit"
                  placeholderTextColor={palette.placeholder}
                />
                  <Text style={[styles.metaHint, { marginBottom: 12 }]}>
                  {usableRangeKm(remainingRangeKm, rangeMarginPct) !== null
                    ? `Only showing stations within about ${Math.floor(usableRangeKm(remainingRangeKm, rangeMarginPct) ?? 0)} km.`
                    : 'Low on fuel? Enter the range your dash shows.'}{' '}
                  Dash estimates run optimistic, so we take a safety margin off it. The range clears itself after a few hours.
                </Text>

                <Text style={styles.inputLabel}>Range Safety Margin</Text>
                <View style={[styles.fuelTypeRow, { marginBottom: 4 }]}>
                  {RANGE_MARGIN_OPTIONS.map((option) => {
                    const selected = rangeMarginPct === option;
                    return (
                      <PressableScale
                        key={option}
                        style={[styles.fuelTypeChip, selected && styles.fuelTypeChipSelected]}
                        onPress={() => setRangeMarginPct(option)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.fuelTypeChipText, selected && styles.fuelTypeChipTextSelected]}>
                          {option}% {option === 10 ? 'light' : option === 20 ? 'standard' : 'cautious'}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
                <Text style={[styles.metaHint, { marginBottom: 12 }]}>
                  How much of the dash range to hold back. Go cautious if the estimate is often wrong, or the road is hilly.
                </Text>

                <Text style={styles.inputLabel}>Fuel Type</Text>
                <View style={[styles.fuelTypeRow, { marginBottom: 0 }]}>
                  {FUEL_TYPE_OPTIONS.map((option) => {
                    const selected = fuelType === option;
                    return (
                      <PressableScale
                        key={option}
                        style={[styles.fuelTypeChip, selected && styles.fuelTypeChipSelected]}
                        onPress={() => setFuelType(option)}
                      >
                        <Text style={[styles.fuelTypeChipText, selected && styles.fuelTypeChipTextSelected]}>{option}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </CollapsibleSectionContent>
            )}
          </View>

          <View onLayout={handleVehicleAndBrandsLayout}>
            {renderSettingsSection(
              <CollapsibleSectionContent
                title="Vehicle & Brands"
                icon="car-sport-outline"
                summary={vehicleAndBrandsSummary}
                expanded={vehicleAndBrandsOpen}
                onToggle={() => {
                  setVehicleAndBrandsOpen(!vehicleAndBrandsOpen);
                  if (!vehicleAndBrandsOpen) scrollToSection('vehicleAndBrands');
                }}
                hasPendingChanges={pendingSections.vehicleAndBrands}
                palette={palette}
                styles={styles}
              >
                <Text style={styles.inputLabel}>Fuel Economy (L/100km)</Text>
                <RoundedNumericInput
                  value={fuelEconomy}
                  onChangeText={setFuelEconomy}
                  inputStyle={styles.input}
                  keyboardAppearance={themeMode}
                  placeholder="e.g. 8.0"
                  placeholderTextColor={palette.placeholder}
                />

                <Text style={styles.inputLabel}>Brands (Optional)</Text>
                <View style={[styles.fuelTypeRow, { marginBottom: 0 }]}>
                  {BRAND_OPTIONS.map((option) => {
                    const selected = selectedBrands.includes(option);
                    return (
                      <PressableScale
                        key={option}
                        style={[styles.fuelTypeChip, selected && styles.fuelTypeChipSelected]}
                        onPress={() => toggleBrandSelection(option)}
                      >
                        <Text style={[styles.fuelTypeChipText, selected && styles.fuelTypeChipTextSelected]}>{option}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </CollapsibleSectionContent>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
