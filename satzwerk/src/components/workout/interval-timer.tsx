import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeInterval, intervalStateAt } from '@/domain/interval';
import { formatDuration } from '@/domain/units';
import type { IntervalConfig } from '@/domain/workout';
import { useKeepScreenOn } from '@/hooks/use-keep-screen-on';
import { buzz } from '@/lib/rest-alerts';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { AppText, Button, TextField } from '../ui';
import { useNow } from './rest-bar';

function KeepAwake() {
  useKeepScreenOn();
  return null;
}

/**
 * Vollbild-Timer für EMOM / AMRAP / Intervalle. Die Zeit basiert auf Zeitstempeln,
 * läuft also korrekt weiter, auch wenn die App kurz im Hintergrund war.
 */
export function IntervalTimer({
  visible,
  config,
  exerciseName,
  onClose,
  onFinish,
}: {
  visible: boolean;
  config: IntervalConfig;
  exerciseName: string;
  onClose: () => void;
  onFinish: (totalReps: number | null) => void;
}) {
  const c = useColors();
  const now = useNow(200);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState('');
  const lastPhase = useRef<string>('');
  const lastRemaining = useRef<number>(-1);

  const elapsed = running && startedAt !== null ? pausedElapsed + (now - startedAt) / 1000 : pausedElapsed;
  // 3-2-1-Countdown vor dem Start
  const countdown = running ? Math.ceil(3 - elapsed) : 0;
  const state = intervalStateAt(config, Math.max(0, elapsed - 3));
  const phaseKey = `${state.phase}-${state.round}`;

  useEffect(() => {
    if (!running) return;
    if (countdown > 0 && lastRemaining.current !== countdown) {
      lastRemaining.current = countdown;
      buzz('tick');
      return;
    }
    if (countdown > 0) return;
    if (phaseKey !== lastPhase.current) {
      lastPhase.current = phaseKey;
      buzz(state.phase === 'done' ? 'end' : 'phase');
      return;
    }
    if (state.remaining <= 3 && state.remaining > 0 && lastRemaining.current !== state.remaining) {
      lastRemaining.current = state.remaining;
      buzz('tick');
    }
  }, [running, countdown, phaseKey, state.phase, state.remaining]);

  const start = () => {
    setStartedAt(Date.now());
    setRunning(true);
  };
  const pause = () => {
    setPausedElapsed(elapsed);
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    setPausedElapsed(0);
    setStartedAt(null);
    lastPhase.current = '';
    lastRemaining.current = -1;
  };

  // Fertig ist abgeleiteter Zustand: Zeit ist abgelaufen (läuft intern weiter, Anzeige bleibt bei 0).
  const done = state.phase === 'done' && countdown <= 0 && (running || pausedElapsed > 0);
  const phaseColor = state.phase === 'rest' ? c.success : c.accent;
  const needsReps = config.mode !== 'emom';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && running && !done && <KeepAwake />}
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{exerciseName}</AppText>
            <AppText muted>{describeInterval(config)}</AppText>
          </View>
          <Button title="Schließen" variant="ghost" small onPress={onClose} />
        </View>

        <View style={styles.center}>
          {countdown > 0 ? (
            <>
              <AppText muted variant="heading">
                Gleich geht’s los
              </AppText>
              <AppText style={[styles.big, { color: c.accent }]}>{countdown}</AppText>
            </>
          ) : (
            <>
              <AppText variant="heading" style={{ color: phaseColor, textTransform: 'uppercase', letterSpacing: 2 }}>
                {state.phase === 'done' ? 'Fertig' : state.phase === 'rest' ? 'Pause' : config.mode === 'amrap' ? 'So viele wie möglich' : 'Arbeit'}
              </AppText>
              <AppText accessibilityLiveRegion="polite" style={[styles.big, { color: c.text }]}>
                {formatDuration(state.remaining)}
              </AppText>
              {state.totalRounds > 1 && (
                <AppText variant="heading" muted>
                  Runde {Math.min(state.round, state.totalRounds)} / {state.totalRounds}
                </AppText>
              )}
              {config.mode === 'emom' && config.repsPerMinute && state.phase !== 'done' && (
                <AppText muted>{config.repsPerMinute} Wdh. pro Minute</AppText>
              )}
            </>
          )}
        </View>

        {done ? (
          <View style={{ gap: spacing.md }}>
            {needsReps && (
              <TextField
                label={config.mode === 'amrap' ? 'Geschaffte Wiederholungen gesamt' : 'Wiederholungen gesamt (optional)'}
                keyboardType="number-pad"
                value={reps}
                onChangeText={setReps}
              />
            )}
            <Button
              title="Ergebnis eintragen"
              icon="check"
              onPress={() => {
                const n = parseInt(reps, 10);
                onFinish(Number.isFinite(n) ? n : null);
                reset();
                setReps('');
              }}
            />
            <Button title="Nochmal" variant="secondary" onPress={reset} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {running ? (
              <Button title="Pause" icon="pause" variant="secondary" style={{ flex: 1 }} onPress={pause} />
            ) : (
              <Button title={pausedElapsed > 0 ? 'Fortsetzen' : 'Start'} icon="play" style={{ flex: 1 }} onPress={start} />
            )}
            {pausedElapsed > 0 && !running && <Button title="Zurücksetzen" variant="secondary" onPress={reset} />}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  big: { fontSize: 96, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 104 },
});
