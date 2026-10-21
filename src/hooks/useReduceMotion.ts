import { useSyncExternalStore } from 'react';
import { getReduceMotion, subscribeReduceMotion } from '@/lib/motion';

/** True when the OS "Reduce Motion" accessibility setting is on. */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribeReduceMotion, getReduceMotion);
}
