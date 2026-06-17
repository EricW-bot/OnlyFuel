import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { canUseLiquidGlass } from '@/components/ThemedGlassView';
import type { AppMode, RankedStation } from '@/types';
import type { createThemedStyles, getPalette } from '@/theme/theme';

type StationCardProps = {
  item: RankedStation;
  index: number;
  appMode: AppMode;
  palette: ReturnType<typeof getPalette>;
  styles: ReturnType<typeof createThemedStyles>;
  onPress: (station: RankedStation) => void;
};

export function StationCard({ item, index, appMode, palette, styles, onPress }: StationCardProps) {
  const cardContent = (
    <>
      <View style={styles.cardHeader}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName}>{item.name}</Text>
          <Text style={styles.stationAddress}>{item.address || 'Address unavailable'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={styles.statLabelRow}>
            <Ionicons name="pricetag-outline" size={12} color={palette.metaHint} />
            <Text style={styles.statLabel}>Pump Price</Text>
          </View>
          <Text style={styles.statValue}>{item.priceCents.toFixed(1)}¢</Text>
        </View>
        <View style={styles.statBox}>
          <View style={styles.statLabelRow}>
            <Ionicons name="navigate-outline" size={12} color={palette.metaHint} />
            <Text style={styles.statLabel}>{appMode === 'oneWay' ? 'Trip Route' : 'Route'}</Text>
          </View>
          <Text style={styles.statValue}>
            {appMode === 'oneWay'
              ? `${item.tripWithStopKm?.toFixed(1) ?? item.distanceKm.toFixed(1)} km`
              : `${item.distanceKm.toFixed(1)} km`}
            {appMode === 'oneWay' && item.detourKm !== undefined ? `\n(+${item.detourKm.toFixed(1)} detour)` : ''}
            {item.durationMin > 0 ? `\n(${Math.round(item.durationMin)} min)` : ''}
          </Text>
        </View>
        <View style={[styles.statBox, styles.highlightBox]}>
          <View style={styles.statLabelRow}>
            <Ionicons name="cash-outline" size={12} color={palette.metaHint} />
            <Text style={styles.statLabel}>Total Net Cost</Text>
          </View>
          <Text style={styles.costValue}>${item.totalCostDollars.toFixed(2)}</Text>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.cardShell}>
      <TouchableOpacity style={styles.cardTouchable} activeOpacity={0.9} onPress={() => onPress(item)}>
        {canUseLiquidGlass ? (
          <View style={styles.cardGlass}>
            <GlassView style={styles.cardGlassBackground} glassEffectStyle="regular" />
            <View style={styles.cardContent}>{cardContent}</View>
          </View>
        ) : (
          <View style={styles.card}>{cardContent}</View>
        )}
      </TouchableOpacity>
    </View>
  );
}
