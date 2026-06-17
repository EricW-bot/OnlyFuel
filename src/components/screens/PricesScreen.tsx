import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { AppMode, RankedStation } from '@/types';
import type { createThemedStyles, getPalette } from '@/theme/theme';
import { StationCard } from '@/components/StationCard';

type PricesScreenProps = {
  palette: ReturnType<typeof getPalette>;
  styles: ReturnType<typeof createThemedStyles>;
  topHeaderHeight: number;
  scrollBottomPadding: number;
  errorMsg: string | null;
  loading: boolean;
  refreshing: boolean;
  rankedStations: RankedStation[];
  appMode: AppMode;
  onRefresh: () => void;
  onSelectStation: (station: RankedStation) => void;
};

export function PricesScreen({
  palette,
  styles,
  topHeaderHeight,
  scrollBottomPadding,
  errorMsg,
  loading,
  refreshing,
  rankedStations,
  appMode,
  onRefresh,
  onSelectStation
}: PricesScreenProps) {
  if (errorMsg) {
    return (
      <View style={[styles.centerBox, { paddingTop: topHeaderHeight }]}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centerBox, { paddingTop: topHeaderHeight }]}>
        <ActivityIndicator size="large" color={palette.primaryMuted} />
        <Text style={styles.loadingText}>Calculating optimal routes...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.listContainer, { paddingTop: topHeaderHeight + 8, paddingBottom: 0 }]}>
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
        contentContainerStyle={[
          styles.resultsListContent,
          rankedStations.length === 0 && styles.resultsListContentEmpty,
          { paddingBottom: scrollBottomPadding }
        ]}
      >
        {rankedStations.length === 0 ? (
          <Text style={styles.emptyText}>No stations available right now. Try recalculating.</Text>
        ) : (
          rankedStations.map((item, index) => (
            <React.Fragment key={`${item.code}-${index}`}>
              <StationCard
                item={item}
                index={index}
                appMode={appMode}
                palette={palette}
                styles={styles}
                onPress={onSelectStation}
              />
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </View>
  );
}
