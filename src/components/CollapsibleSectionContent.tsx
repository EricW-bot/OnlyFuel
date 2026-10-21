import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/PressableScale';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { animateNextLayout } from '@/lib/motion';
import type { createThemedStyles, getPalette } from '@/theme/theme';

// The header is the same height whether or not the summary line is showing, and the chevron sits in
// a fixed-size box. If the chevron's frame changed on toggle, the LayoutAnimation run by
// animateNextLayout would re-apply its pre-animation rotation when it finished, leaving it flipped.
const HEADER_MIN_HEIGHT = 36;
const CHEVRON_BOX_SIZE = 24;

type CollapsibleSectionContentProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** One-line recap of the current values, shown while collapsed. */
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  /** Shows a dot on the header when the section holds unsaved edits. */
  hasPendingChanges?: boolean;
  palette: ReturnType<typeof getPalette>;
  styles: ReturnType<typeof createThemedStyles>;
  children: React.ReactNode;
};

/** Header (icon, title, chevron) plus body for a settings section the user can collapse. */
export function CollapsibleSectionContent({
  title,
  icon,
  summary,
  expanded,
  onToggle,
  hasPendingChanges = false,
  palette,
  styles,
  children
}: CollapsibleSectionContentProps) {
  const reduceMotion = useReduceMotion();
  const [rotation] = useState(() => new Animated.Value(expanded ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      rotation.setValue(expanded ? 1 : 0);
      return;
    }
    const animation = Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, reduceMotion, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <>
      <PressableScale
        onPress={() => {
          animateNextLayout();
          onToggle();
        }}
        pressedScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${title}${hasPendingChanges ? ', unsaved changes' : ''}`}
        accessibilityHint={expanded ? 'Collapses this section' : 'Expands this section'}
        accessibilityState={{ expanded }}
        hitSlop={8}
        style={[styles.settingsSectionHeader, { minHeight: HEADER_MIN_HEIGHT, marginBottom: expanded ? 10 : 0 }]}
      >
        <Ionicons name={icon} size={16} color={palette.title} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.settingsSectionTitle}>{title}</Text>
            {hasPendingChanges ? (
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.primary }} />
            ) : null}
          </View>
          {!expanded ? (
            <Text style={[styles.metaHint, { marginTop: 2 }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <View style={{ width: CHEVRON_BOX_SIZE, height: CHEVRON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-down" size={18} color={palette.metaHint} />
          </Animated.View>
        </View>
      </PressableScale>
      {expanded ? children : null}
    </>
  );
}
