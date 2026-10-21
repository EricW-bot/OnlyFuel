import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FuelErrorKind } from '@/hooks/useFuelData';
import type { getPalette } from '@/theme/theme';

type FuelErrorNoticeProps = {
  message: string;
  kind: FuelErrorKind;
  /** `banner` sits above existing results; `panel` replaces an empty list. */
  variant: 'banner' | 'panel';
  palette: ReturnType<typeof getPalette>;
  onRetry: () => void;
  onOpenSettings: () => void;
};

type NoticeAction = { label: string; onPress: () => void; primary?: boolean };

/** An error plus the actions that can actually recover from it. */
export function FuelErrorNotice({ message, kind, variant, palette, onRetry, onOpenSettings }: FuelErrorNoticeProps) {
  const actions: NoticeAction[] =
    kind === 'permission'
      ? [
          { label: Platform.OS === 'ios' ? 'Open iPhone Settings' : 'Open app settings', onPress: () => void Linking.openSettings(), primary: true },
          { label: 'Use an address instead', onPress: onOpenSettings }
        ]
      : kind === 'needsSettings' || kind === 'coverage'
        ? [{ label: 'Open Settings', onPress: onOpenSettings, primary: true }]
        : [{ label: 'Try again', onPress: onRetry, primary: true }];

  const isPanel = variant === 'panel';
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        isPanel ? styles.panel : styles.banner,
        !isPanel && { backgroundColor: palette.cardBg, borderColor: palette.errorText }
      ]}
    >
      <View style={styles.messageRow}>
        <Ionicons name="alert-circle-outline" size={isPanel ? 28 : 18} color={palette.errorText} />
        <Text style={[styles.message, isPanel && styles.panelMessage, { color: palette.errorText }]}>{message}</Text>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            style={[
              styles.button,
              action.primary
                ? { backgroundColor: palette.primary, borderColor: palette.primary }
                : { backgroundColor: palette.chipBg, borderColor: palette.chipBorder }
            ]}
          >
            <Text style={[styles.buttonText, { color: action.primary ? '#ffffff' : palette.chipText }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  panel: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 8 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  message: { flex: 1, fontSize: 14, fontWeight: '600' },
  panelMessage: { fontSize: 16, textAlign: 'center', flex: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  button: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: '700' }
});
