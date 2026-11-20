import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDuration } from '@/domain/units';
import { buzz } from '@/lib/rest-alerts';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { AppText } from '../ui';

/** Sekündlich aktualisierte "jetzt"-Zeit. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function RestBar({
  rest,
  onAdjust,
  onSkip,
}: {
  rest: { endsAt: number; total: number };
  onAdjust: (delta: number) => void;
  onSkip: () => void;
}) {
  const c = useColors();
  const now = useNow();
  const remaining = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const progress = rest.total > 0 ? Math.min(1, remaining / rest.total) : 0;
  const firedFor = useRef<number | null>(null);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    // 3-2-1: kurzer Ton
    if (remaining > 0 && remaining <= 3 && lastTick.current !== remaining) {
      lastTick.current = remaining;
      buzz('tick');
    }
    if (remaining === 0 && firedFor.current !== rest.endsAt) {
      firedFor.current = rest.endsAt;
      // Nur piepen, wenn das Ende gerade erst erreicht wurde (nicht nach Rückkehr aus dem Hintergrund –
      // dann hat bereits die Benachrichtigung mit Ton gemeldet).
      if (Date.now() - rest.endsAt < 3000) buzz('end');
      onSkip();
    }
  }, [remaining, rest.endsAt, onSkip]);

  return (
    <View style={[styles.bar, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
      <View style={[styles.progress, { backgroundColor: c.accentMuted, width: `${progress * 100}%` }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Pause um 15 Sekunden verkürzen" onPress={() => onAdjust(-15)} style={styles.btn}>
        <AppText style={{ fontWeight: '700' }}>−15</AppText>
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <AppText variant="caption" muted>
          Pause
        </AppText>
        <AppText accessibilityLiveRegion="polite" style={{ fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
          {formatDuration(remaining)}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Pause um 15 Sekunden verlängern" onPress={() => onAdjust(15)} style={styles.btn}>
        <AppText style={{ fontWeight: '700' }}>+15</AppText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Pause überspringen" onPress={onSkip} style={[styles.btn, { backgroundColor: c.accent }]}>
        <AppText style={{ fontWeight: '800', color: c.onAccent }}>Weiter</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progress: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  btn: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md },
});
