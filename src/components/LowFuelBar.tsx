import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FadeInView } from '@/components/FadeInView';
import { RoundedNumericInput } from '@/components/RoundedNumericInput';
import { usableRangeKm } from '@/lib/range';
import { normaliseRangeKm } from '@/lib/utils';
import type { getPalette } from '@/theme/theme';

type LowFuelBarProps = {
  palette: ReturnType<typeof getPalette>;
  themeMode: 'light' | 'dark';
  /** The range currently applied ('' when none). */
  activeRangeKm: string;
  marginPct: number;
  onApply: (rangeKm: string) => Promise<void>;
};

/** One-tap way to say "I'm nearly empty" and only see stations that can be reached. */
export function LowFuelBar({ palette, themeMode, activeRangeKm, marginPct, onApply }: LowFuelBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const draftUsable = usableRangeKm(draft, marginPct);
  const activeUsable = usableRangeKm(activeRangeKm, marginPct);

  const apply = async (value: string) => {
    setBusy(true);
    try {
      await onApply(normaliseRangeKm(value));
      setEditing(false);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <FadeInView style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]} duration={180} offset={6}>
        <Text style={[styles.label, { color: palette.inputLabel }]}>Range left on your dash (km)</Text>
        <RoundedNumericInput
          value={draft}
          onChangeText={setDraft}
          inputStyle={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.inputText }]}
          keyboardAppearance={themeMode}
          placeholder="e.g. 25"
          palette={palette}
          placeholderTextColor={palette.placeholder}
        />
        <Text style={[styles.hint, { color: palette.metaHint }]}>
          {draftUsable !== null
            ? `Showing stations within about ${Math.floor(draftUsable)} km (${marginPct}% safety margin, since dash estimates run optimistic).`
            : 'Only stations you can reach on that range will be shown.'}
        </Text>
        <View style={styles.row}>
          <TouchableOpacity
            disabled={draftUsable === null || busy}
            onPress={() => void apply(draft)}
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: draftUsable === null || busy ? 0.5 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Show reachable stations</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            disabled={busy}
            onPress={() => {
              setEditing(false);
              setDraft('');
            }}
            accessibilityRole="button"
            style={styles.textButton}
          >
            <Text style={[styles.textButtonLabel, { color: palette.metaHint }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
    );
  }

  if (activeUsable !== null) {
    return (
      <View style={[styles.activeBar, { backgroundColor: palette.chipSelectedBg, borderColor: palette.chipSelectedBorder }]}>
        <Ionicons name="speedometer-outline" size={18} color={palette.chipTextSelected} />
        <Text style={[styles.activeText, { color: palette.chipTextSelected }]} numberOfLines={2}>
          Within about {Math.floor(activeUsable)} km ({activeRangeKm} km range)
        </Text>
        <TouchableOpacity
          disabled={busy}
          onPress={() => void apply('')}
          accessibilityRole="button"
          accessibilityLabel="Clear range limit"
          hitSlop={8}
        >
          {busy ? (
            <ActivityIndicator color={palette.chipTextSelected} />
          ) : (
            <Text style={[styles.clear, { color: palette.chipTextSelected }]}>Clear</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => setEditing(true)}
      accessibilityRole="button"
      style={[styles.trigger, { backgroundColor: palette.chipBg, borderColor: palette.chipBorder }]}
    >
      <Ionicons name="speedometer-outline" size={16} color={palette.chipText} />
      <Text style={[styles.triggerText, { color: palette.chipText }]}>Low on fuel? Show only stations in range</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14, alignSelf: 'flex-start' },
  triggerText: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14, gap: 8 },
  label: { fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  hint: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  primaryButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  textButton: { paddingVertical: 12, paddingHorizontal: 8 },
  textButtonLabel: { fontSize: 15, fontWeight: '600' },
  activeBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  activeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  clear: { fontSize: 14, fontWeight: '800' }
});
