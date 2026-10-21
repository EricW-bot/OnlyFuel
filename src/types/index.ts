export type Station = {
  brandid?: string;
  stationid?: string;
  brand?: string;
  code: string;
  name: string;
  address?: string;
  location: {
    distance?: number;
    latitude: number;
    longitude: number;
  };
  state?: string;
};

export type Price = {
  stationcode: string;
  fueltype?: string;
  price: number;
  lastupdated?: string;
  state?: string;
};

export type FuelApiData = {
  stations: Station[];
  prices: Price[];
};

export type RouteMetrics = {
  distanceKm: number;
  durationMin: number;
  /** For via-routes: distance of the first leg (start to the stop). */
  firstLegKm?: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type AppMode = 'roundTrip' | 'oneWay';
export type AppTab = 'prices' | 'settings';

/** Collapsible Settings sections that other screens can deep-link to. */
export type SettingsSection = 'fuelAndRange' | 'vehicleAndBrands';

/** Asks Settings to open and scroll to a section; `nonce` makes repeat requests distinct. */
export type SettingsFocusRequest = { section: SettingsSection; nonce: number };

export type TabDefinition = {
  key: AppTab;
  label: string;
  icon: 'pricetag-outline' | 'settings-outline';
};

export type RankedStation = Station & {
  priceCents: number;
  distanceKm: number;
  durationMin: number;
  totalCostDollars: number;
  baselineTripKm?: number;
  tripWithStopKm?: number;
  detourKm?: number;
};

export type ExpoMapMarker = {
  id: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  snippet?: string;
};

export type ExpoMapPolyline = {
  id: string;
  coordinates: {
    latitude: number;
    longitude: number;
  }[];
  color?: string;
  width?: number;
};

export type MapCameraPosition = {
  coordinates: Coordinates;
  zoom: number;
};

export type SettingsSnapshot = {
  appMode: AppMode;
  useCurrentLocation: boolean;
  fuelNeeded: string;
  fuelEconomy: string;
  remainingRangeKm: string;
  rangeMarginPct: number;
  fuelType: string;
  selectedBrands: string[];
  tripStartAddress: string;
  tripDestinationAddress: string;
};

export type SettingsSnapshotInput = {
  appMode: AppMode;
  useCurrentLocation: boolean;
  fuelNeeded: string;
  fuelEconomy: string;
  remainingRangeKm: string;
  rangeMarginPct: number;
  fuelType: string;
  selectedBrands: string[];
  tripStartAddress: string;
  tripDestinationAddress: string;
};
