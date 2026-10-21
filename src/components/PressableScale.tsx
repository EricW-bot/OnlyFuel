import React, { useState } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

/** Pressable that springs down slightly while pressed. Layout styles apply to the pressable itself. */
export function PressableScale({ style, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const springTo = (toValue: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        springTo(pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        springTo(1);
        onPressOut?.(event);
      }}
    />
  );
}
