import type { SettingsSnapshot, SettingsSnapshotInput } from '@/types';
import { normaliseBrands, normaliseFuelType, sameOrderedStringArray } from '@/lib/utils';

export function createSettingsSnapshot(input: SettingsSnapshotInput): SettingsSnapshot {
  return {
    appMode: input.appMode,
    useCurrentLocation: input.useCurrentLocation,
    fuelNeeded: input.fuelNeeded.trim(),
    fuelEconomy: input.fuelEconomy.trim(),
    fuelType: normaliseFuelType(input.fuelType),
    selectedBrands: normaliseBrands(input.selectedBrands),
    tripStartAddress: input.tripStartAddress.trim(),
    tripDestinationAddress: input.tripDestinationAddress.trim()
  };
}

export function hasSettingsSnapshotChanges(
  saved: SettingsSnapshot | null,
  current: SettingsSnapshot
): boolean {
  if (!saved) return false;
  return !(
    saved.appMode === current.appMode &&
    saved.useCurrentLocation === current.useCurrentLocation &&
    saved.fuelNeeded === current.fuelNeeded &&
    saved.fuelEconomy === current.fuelEconomy &&
    saved.fuelType === current.fuelType &&
    sameOrderedStringArray(saved.selectedBrands, current.selectedBrands) &&
    saved.tripStartAddress === current.tripStartAddress &&
    saved.tripDestinationAddress === current.tripDestinationAddress
  );
}
