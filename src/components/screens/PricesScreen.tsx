import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { AppMode, RankedStation } from '@/types';
import type { createThemedStyles, getPalette } from '@/theme/theme';
import type { FuelErrorKind } from '@/hooks/useFuelData';
import { useNow } from '@/hooks/useNow';
import { formatAgo } from '@/lib/timeAgo';
import { StationCard } from '@/components/StationCard';
import { FadeInView } from '@/components/FadeInView';
import { FuelErrorNotice } from '@/components/FuelErrorNotice';
import { LowFuelBar } from '@/components/LowFuelBar';
import { NumericDoneBar } from '@/components/NumericDoneBar';

type PricesScreenProps = {
  palette: ReturnType<typeof getPalette>;
  styles: ReturnType<typeof createThemedStyles>;
  themeMode: 'light' | 'dark';
  topHeaderHeight: number;
  scrollBottomPadding: number;
  errorMsg: string | null;
  errorKind: FuelErrorKind;
  loading: boolean;
  refreshing: boolean;
  rankedStations: RankedStation[];
  appMode: AppMode;
  lastUpdatedAt: number | null;
  /** Live routing failed, so distances are straight-line estimates. */
  routingEstimated: boolean;
  remainingRangeKm: string;
  rangeMarginPct: number;
  onRefresh: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  onApplyRange: (rangeKm: string) => Promise<void>;
  onSelectStation: (station: RankedStation) => void;
};

export function PricesScreen({
  palette,
  styles,
  themeMode,
  topHeaderHeight,
  scrollBottomPadding,
  errorMsg,
  errorKind,
  loading,
  refreshing,
  rankedStations,
  appMode,
  lastUpdatedAt,
  routingEstimated,
  remainingRangeKm,
  rangeMarginPct,
  onRefresh,
  onRetry,
  onOpenSettings,
  onApplyRange,
  onSelectStation
}: PricesScreenProps) {
  const now = useNow();
  const hasResults = rankedStations.length > 0;

  if (loading && !hasResults) {
    return (
      <View style={[styles.centerBox, { paddingTop: topHeaderHeight }]}>
        <FadeInView style={{ alignItems: 'center' }} offset={0} duration={400}>
          <ActivityIndicator size="large" color={palette.primaryMuted} />
          <Text style={styles.loadingText}>Calculating optimal routes...</Text>
        </FadeInView>
      </View>
    );
  }

  const statusParts: string[] = [];
  if (lastUpdatedAt !== null) statusParts.push(`Updated ${formatAgo(lastUpdatedAt, now)}`);
  if (routingEstimated) statusParts.push('distances estimated (live routing unavailable)');

  return (
    <View style={[styles.listContainer, { paddingTop: topHeaderHeight + 8, paddingBottom: 0 }]}>
      <NumericDoneBar palette={palette} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primaryMuted}
            colors={[palette.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={'on-drag'}
        contentContainerStyle={[styles.resultsListContent, { paddingBottom: scrollBottomPadding }]}
      >
        <LowFuelBar
          palette={palette}
          themeMode={themeMode}
          activeRangeKm={remainingRangeKm}
          marginPct={rangeMarginPct}
          onApply={onApplyRange}
        />

        {errorMsg && hasResults ? (
          <FuelErrorNotice
            message={errorMsg}
            kind={errorKind}
            variant="banner"
            palette={palette}
            onRetry={onRetry}
            onOpenSettings={onOpenSettings}
          />
        ) : null}

        {hasResults && !errorMsg && statusParts.length > 0 ? (
          <Text style={[styles.metaHint, { marginBottom: 10 }]}>{statusParts.join(' · ')}</Text>
        ) : null}
        {hasResults && errorMsg && lastUpdatedAt !== null ? (
          <Text style={[styles.metaHint, { marginBottom: 10 }]}>Showing results from {formatAgo(lastUpdatedAt, now)}</Text>
        ) : null}

        {!hasResults && errorMsg ? (
          <FuelErrorNotice
            message={errorMsg}
            kind={errorKind}
            variant="panel"
            palette={palette}
            onRetry={onRetry}
            onOpenSettings={onOpenSettings}
          />
        ) : null}

        {!hasResults && !errorMsg ? (
          <FadeInView>
            <Text style={styles.emptyText}>No stations available right now. Pull down to refresh.</Text>
          </FadeInView>
        ) : null}

        {rankedStations.map((item, index) => (
          <React.Fragment key={`${item.code}-${index}`}>
            <StationCard
              item={item}
              index={index}
              appMode={appMode}
              palette={palette}
              styles={styles}
              distanceIsEstimate={routingEstimated}
              onPress={onSelectStation}
            />
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}
