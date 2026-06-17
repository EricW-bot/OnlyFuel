import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AppTab } from '@/types';
import { getSaveToast, subscribeSaveToast, type SaveOutcome } from '@/state/settingsSync';
import type { ToastVariant } from '@/components/Toast';

const SAVE_TOAST_CONFIG: Record<SaveOutcome, { message: string; variant: ToastVariant }> = {
  saved: { message: 'Successfully saved!', variant: 'success' },
  failed: { message: 'Failed to save...', variant: 'error' },
  nothing: { message: 'Nothing saved!', variant: 'info' }
};

type ToastState = { message: string; variant: ToastVariant } | null;

/**
 * Surfaces a transient toast on the Prices tab after settings are flushed on
 * leaving the Settings tab. The outcome travels across the two NativeTabs
 * `App` instances through the `settingsSync` store.
 */
export function useSaveToast(activeTab: AppTab): { toast: ToastState; toastVisible: boolean } {
  const saveToast = useSyncExternalStore(subscribeSaveToast, getSaveToast);
  const lastToastIdRef = useRef(0);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!saveToast || saveToast.id === lastToastIdRef.current || activeTab !== 'prices') {
      return;
    }
    lastToastIdRef.current = saveToast.id;
    setToast(SAVE_TOAST_CONFIG[saveToast.outcome]);
    setToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }, [saveToast, activeTab]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return { toast, toastVisible };
}
