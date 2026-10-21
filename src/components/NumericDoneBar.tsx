import React from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { getPalette } from '@/theme/theme';

/** Links numeric inputs to the Done bar; the iOS decimal pad has no return key of its own. */
export const NUMERIC_ACCESSORY_ID = 'numeric-done-bar';

type NumericDoneBarProps = {
  palette: ReturnType<typeof getPalette>;
};

export function NumericDoneBar({ palette }: NumericDoneBarProps) {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
      <View style={[styles.bar, { backgroundColor: palette.cardBg, borderTopColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={[styles.done, { color: palette.primary }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  done: {
    fontSize: 17,
    fontWeight: '700'
  }
});
