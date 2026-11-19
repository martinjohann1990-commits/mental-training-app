import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type HistoryData, loadHistory } from '@/db/repo/history';

/** Historie laden; wird bei jedem Fokus des Screens aktualisiert. */
export function useHistory(): HistoryData | null {
  const [data, setData] = useState<HistoryData | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadHistory().then((d) => !cancelled && setData(d));
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return data;
}
