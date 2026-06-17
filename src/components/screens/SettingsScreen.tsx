import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { canUseLiquidGlass } from '@/components/ThemedGlassView';
import { AddressSuggestionInput } from '@/components/AddressSuggestionInput';
import { RoundedNumericInput } from '@/components/RoundedNumericInput';
import { BRAND_OPTIONS, FUEL_TYPE_OPTIONS } from '@/constants';
import type { AppMode } from '@/types';
import type { createThemedStyles, getPalette } from '@/theme/theme';
import type { useSettingsForm } from '@/hooks/useSettingsForm';

type SettingsScreenProps = {
  palette: ReturnType<typeof getPalette>;
  styles: ReturnType<typeof createThemedStyles>;
  themeMode: 'light' | 'dark';
  topHeaderHeight: number;
  settings: ReturnType<typeof useSettingsForm>;
};

export function SettingsScreen({ palette, styles, themeMode, topHeaderHeight, settings }: SettingsScreenProps) {
  const {
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
    toggleBrandSelection
  } = settings;

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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.settingsPageContent, { paddingTop: 0, paddingBottom: 16 }]}
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
                    <TouchableOpacity
                      key={modeOption}
                      style={[styles.modeCard, selected && styles.modeCardSelected]}
                      onPress={() => setAppMode(modeOption)}
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
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Start Point Source</Text>
              <View style={[styles.sourceToggleRow, { marginBottom: 0 }]}>
                {[true, false].map((option) => {
                  const selected = useCurrentLocation === option;
                  return (
                    <TouchableOpacity
                      key={option ? 'use-location' : 'use-addresses'}
                      style={[styles.sourceToggleButton, selected && styles.sourceToggleButtonSelected]}
                      onPress={() => setUseCurrentLocation(option)}
                    >
                      <Text style={[styles.sourceToggleText, selected && styles.sourceToggleTextSelected]}>
                        {option ? 'Use my location' : 'Use start address'}
                      </Text>
                    </TouchableOpacity>
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

          {renderSettingsSection(
            <>
              <View style={styles.settingsSectionHeader}>
                <Ionicons name="car-sport-outline" size={16} color={palette.title} />
                <Text style={styles.settingsSectionTitle}>Vehicle & Fuel</Text>
              </View>
              <View style={styles.inlineInputsRow}>
                <View style={styles.inlineInputCol}>
                  <Text style={[styles.inputLabel, styles.inlineInputLabel]}>Fuel Needed (Litres)</Text>
                  <RoundedNumericInput
                    value={fuelNeeded}
                    onChangeText={setFuelNeeded}
                    inputStyle={styles.inlineInput}
                    keyboardAppearance={themeMode}
                    placeholder="e.g. 50"
                    placeholderTextColor={palette.placeholder}
                  />
                </View>
                <View style={styles.inlineInputCol}>
                  <Text style={[styles.inputLabel, styles.inlineInputLabel]}>Fuel Economy (L/100km)</Text>
                  <RoundedNumericInput
                    value={fuelEconomy}
                    onChangeText={setFuelEconomy}
                    inputStyle={styles.inlineInput}
                    keyboardAppearance={themeMode}
                    placeholder="e.g. 8.0"
                    placeholderTextColor={palette.placeholder}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Fuel Type</Text>
              <View style={styles.fuelTypeRow}>
                {FUEL_TYPE_OPTIONS.map((option) => {
                  const selected = fuelType === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.fuelTypeChip, selected && styles.fuelTypeChipSelected]}
                      onPress={() => setFuelType(option)}
                    >
                      <Text style={[styles.fuelTypeChipText, selected && styles.fuelTypeChipTextSelected]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Brands (Optional)</Text>
              <View style={[styles.fuelTypeRow, { marginBottom: 0 }]}>
                {BRAND_OPTIONS.map((option) => {
                  const selected = selectedBrands.includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.fuelTypeChip, selected && styles.fuelTypeChipSelected]}
                      onPress={() => toggleBrandSelection(option)}
                    >
                      <Text style={[styles.fuelTypeChipText, selected && styles.fuelTypeChipTextSelected]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
