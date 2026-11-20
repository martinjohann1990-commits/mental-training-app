import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAppLock } from '@/stores/app-lock';
import { type AppLockMode, useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { AppText, Button, Icon } from './ui';

export function LockScreen({ title }: { title: string }) {
  const c = useColors();
  const { unlock, available, checkAvailability } = useAppLock();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void checkAvailability();
    // Beim Öffnen direkt die Abfrage starten.
    void unlock().then((r) => !r.ok && setMessage('Entsperren abgebrochen.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim ersten Anzeigen
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: c.background }}>
      <Icon name="lock-outline" size={56} color={c.accent} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText muted style={{ textAlign: 'center' }}>
        Mit Fingerabdruck, Gesichtserkennung oder Geräte-PIN entsperren.
      </AppText>
      {available === false && (
        <AppText muted style={{ textAlign: 'center' }}>
          Auf diesem Gerät ist keine Displaysperre eingerichtet – der Schutz ist deshalb nicht aktiv.
        </AppText>
      )}
      {message && <AppText style={{ color: c.danger }}>{message}</AppText>}
      <Button
        title="Entsperren"
        icon="fingerprint"
        onPress={async () => {
          const r = await unlock();
          setMessage(r.ok ? null : 'Entsperren fehlgeschlagen oder abgebrochen.');
        }}
      />
    </View>
  );
}

function needsLock(mode: AppLockMode, scope: 'photos' | 'app') {
  return scope === 'app' ? mode === 'app' : mode !== 'off';
}

/** Zeigt die Kinder erst nach dem Entsperren (falls für diesen Bereich eine Sperre aktiv ist). */
export function LockGate({ scope, children }: { scope: 'photos' | 'app'; children: ReactNode }) {
  const mode = useSettings((s) => s.appLock);
  const unlocked = useAppLock((s) => s.unlocked);
  if (!needsLock(mode, scope) || unlocked) return <>{children}</>;
  return <LockScreen title={scope === 'app' ? 'Satzwerk ist gesperrt' : 'Fototagebuch ist gesperrt'} />;
}

/** Sperrbildschirm als Overlay über der ganzen App (Navigation bleibt darunter erhalten). */
export function AppLockOverlay() {
  const mode = useSettings((s) => s.appLock);
  const unlocked = useAppLock((s) => s.unlocked);
  if (mode !== 'app' || unlocked) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LockScreen title="Satzwerk ist gesperrt" />
    </View>
  );
}
