import React, { useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type FadeInViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Wait before starting, e.g. to stagger list items. */
  delay?: number;
  duration?: number;
  /** Starting vertical offset the view slides up from. */
  offset?: number;
};

/** Fades and slides its children in once, when first mounted. */
export function FadeInView({ children, style, delay = 0, duration = 260, offset = 12 }: FadeInViewProps) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, progress, delay, duration]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });

  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
